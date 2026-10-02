-- NIVL · 0048 — Competición entre amigos: ligas privadas, duelos semanales,
-- foto fija diaria (daily_scorecards) y última apertura (last_open_on).
--
-- Chat 5 (lógica de juego), revisión de seguridad del Chat 3. Aditiva y
-- compatible con 1.0.7: tablas y RPC nuevas; friends_board,
-- elite_group_board y las firmas existentes no se tocan. NO toca
-- export_my_data (la exportación consolidada es la 0060 del Chat 3).
-- Sin XP en juego: la competición mide, no paga. Las fórmulas replican
-- src/lib/competition.ts (si tocas una, toca la otra).
--
-- Huella: to_regclass('public.daily_scorecards') is not null

begin;

-- ── Tablas ─────────────────────────────────────────────────────────────

create table if not exists public.private_leagues (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 40 and name !~ '[\r\n\t]'),
  created_at timestamptz not null default now()
);

create table if not exists public.league_members (
  league_id uuid not null references public.private_leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);
create index if not exists league_members_user on public.league_members(user_id);

create table if not exists public.duels (
  id uuid primary key default gen_random_uuid(),
  challenger uuid not null references auth.users(id) on delete cascade,
  opponent uuid not null references auth.users(id) on delete cascade,
  -- Lunes local del retador (safe_tz): la semana del duelo.
  week_start date not null,
  status text not null default 'pending' check (status in ('pending','accepted','declined','done','cancelled')),
  result jsonb,
  created_at timestamptz not null default now(),
  check (challenger <> opponent)
);
-- Un duelo por pareja y semana, se rete quien se rete.
create unique index if not exists duels_pareja_semana
  on public.duels (least(challenger, opponent), greatest(challenger, opponent), week_start);

alter table public.private_leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.duels enable row level security;
revoke all on public.private_leagues, public.league_members, public.duels from anon, authenticated;
-- Lectura solo de lo propio; toda escritura va por RPC.
grant select on public.private_leagues, public.league_members, public.duels to authenticated;

-- Pertenencia SIN sondeo (revisión Chat 3): las políticas solo preguntan por
-- el propio usuario; _es_miembro queda para uso interno (revocada).
create or replace function public._es_miembro(p_league uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.league_members m where m.league_id = p_league and m.user_id = p_user);
$$;
create or replace function public._soy_miembro(p_league uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.league_members m where m.league_id = p_league and m.user_id = auth.uid());
$$;
revoke all on function public._soy_miembro(uuid) from public, anon;
grant execute on function public._soy_miembro(uuid) to authenticated;
revoke all on function public._es_miembro(uuid, uuid) from public, anon, authenticated;
drop policy if exists "ligas: solo miembros" on public.private_leagues;
drop policy if exists "miembros: solo de mis ligas" on public.league_members;
create policy "ligas: solo miembros" on public.private_leagues for select to authenticated using (public._soy_miembro(id));
create policy "miembros: solo de mis ligas" on public.league_members for select to authenticated using (public._soy_miembro(league_id));

drop policy if exists "duelos: solo las partes" on public.duels;
create policy "duelos: solo las partes" on public.duels for select to authenticated
  using (auth.uid() in (challenger, opponent));

-- ── Utilidades internas (revocadas al cliente) ─────────────────────────

create or replace function public._son_amigos(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friendships f where f.status = 'accepted'
    and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a)));
$$;

create or replace function public._bloqueo_entre(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.social_blocks s
    where (s.blocker = a and s.blocked = b) or (s.blocker = b and s.blocked = a));
$$;

-- Bloqueo O suspensión (social_pair_allowed exige auth.uid() en la pareja).
create or replace function public._pareja_ok(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select a = b or (not public._bloqueo_entre(a, b)
    and not exists (select 1 from public.social_profile_reviews r where r.user_id in (a, b) and r.status = 'suspended'));
$$;
revoke all on function public._pareja_ok(uuid, uuid) from public, anon, authenticated;


-- Foto fija diaria (revisión de nivl-game-balancer): lo programado de cada día
-- se congela en el servidor cuando ese día se cierra, para que desactivar o
-- borrar una misión fallada no reescriba la semana. La escribe un trigger al
-- avanzar profiles.last_day_processed, así funciona con cualquier cliente
-- (también 1.0.7). XP BASE por dificultad (game.ts XP_BY_DIFFICULTY).
create table if not exists public.daily_scorecards (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  programadas_xp integer not null default 0 check (programadas_xp >= 0),
  cumplidas_xp integer not null default 0 check (cumplidas_xp >= 0),
  primary key (user_id, day)
);
alter table public.daily_scorecards enable row level security;
revoke all on public.daily_scorecards from anon, authenticated;

-- Desactivar una misión el MISMO día en que se iba a fallar tampoco la borra
-- de ese día: se guarda cuándo se desactivó y ese día sigue contando
-- (revisión Chat 3 / nivl-game-balancer). Borrarla del todo sí la saca: es
-- renunciar a su historial, un precio que no compensa.
alter table public.quests add column if not exists deactivated_at timestamptz;
create or replace function public._quest_deactivated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.active is distinct from old.active then
    new.deactivated_at := case when new.active then null else now() end;
  elsif new.deactivated_at is distinct from old.deactivated_at then
    new.deactivated_at := old.deactivated_at; -- no se edita a mano
  end if;
  return new;
end $$;
revoke all on function public._quest_deactivated_at() from public, anon, authenticated;
drop trigger if exists quests_deactivated_at on public.quests;
create trigger quests_deactivated_at before update on public.quests
  for each row execute function public._quest_deactivated_at();

create or replace function public._xp_base(p_dificultad text) returns integer
language sql immutable as $$
  select case p_dificultad when 'trivial' then 10 when 'facil' then 25 when 'media' then 50
    when 'dificil' then 100 when 'epica' then 250 else 0 end;
$$;

-- Lo programado y cumplido de UN día con las misiones tal como están AHORA.
-- Mismo criterio que friends_board (0032): sin penalizaciones, bonus ni
-- hábitos adquiridos; salud solo con consentimiento; no antes del alta.
create or replace function public._dia_en_vivo(p_user uuid, p_dia date)
returns table (programadas_xp integer, cumplidas_xp integer)
language sql stable security definer set search_path = public as $$
  select coalesce(sum(public._xp_base(q.difficulty)), 0)::integer,
         coalesce(sum(public._xp_base(q.difficulty)) filter (where c.id is not null), 0)::integer
  from public.quests q
  join public.profiles p on p.id = q.user_id
  left join public.completions c on c.user_id = p_user and c.quest_id = q.id and c.date = p_dia
  where q.user_id = p_user and not q.is_penalty and not q.is_bonus and q.acquired_at is null
    and (q.active or (q.deactivated_at is not null and (q.deactivated_at at time zone public.safe_tz(p.timezone))::date >= p_dia))
    and (not public.health_row('quests', to_jsonb(q)) or public.health_consent_active(p_user))
    and extract(isodow from p_dia)::integer = any (q.days_of_week)
    and p_dia >= (q.created_at at time zone public.safe_tz(p.timezone))::date;
$$;

create or replace function public._scorecard_al_cerrar() returns trigger
language plpgsql security definer set search_path = public as $$
declare d date;
begin
  if new.last_day_processed is not null
     and (old.last_day_processed is null or new.last_day_processed > old.last_day_processed) then
    -- Como mucho 60 días hacia atrás por cierre (ausencias largas).
    d := greatest(coalesce(old.last_day_processed + 1, new.last_day_processed), new.last_day_processed - 59);
    while d <= new.last_day_processed loop
      insert into public.daily_scorecards(user_id, day, programadas_xp, cumplidas_xp)
        select new.id, d, s.programadas_xp, s.cumplidas_xp from public._dia_en_vivo(new.id, d) s
        on conflict (user_id, day) do nothing;
      d := d + 1;
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists profiles_scorecard_al_cerrar on public.profiles;
create trigger profiles_scorecard_al_cerrar after update of last_day_processed on public.profiles
  for each row execute function public._scorecard_al_cerrar();

-- Marcador entre dos fechas locales (incluidas): días cerrados desde la foto
-- fija; el resto en vivo, y del día en curso solo cuenta como programado lo
-- ya cumplido (aún no se ha fallado nada).
create or replace function public._marcador(p_user uuid, p_desde date, p_hasta date)
returns table (programadas_xp integer, cumplidas_xp integer, dias_activos integer, xp integer)
language plpgsql stable security definer set search_path = public as $$
declare v_hoy date; d date; v_p integer := 0; v_c integer := 0; v_dp integer; v_dc integer;
begin
  select (now() at time zone public.safe_tz(p.timezone))::date into v_hoy from public.profiles p where p.id = p_user;
  d := p_desde;
  while d <= least(p_hasta, v_hoy) loop
    select sc.programadas_xp, sc.cumplidas_xp into v_dp, v_dc
      from public.daily_scorecards sc where sc.user_id = p_user and sc.day = d;
    if not found then
      select x.programadas_xp, x.cumplidas_xp into v_dp, v_dc from public._dia_en_vivo(p_user, d) x;
      if d = v_hoy then v_dp := v_dc; end if;
    end if;
    v_p := v_p + coalesce(v_dp, 0); v_c := v_c + coalesce(v_dc, 0);
    d := d + 1;
  end loop;
  programadas_xp := v_p; cumplidas_xp := v_c;
  select count(distinct c.date)::integer into dias_activos
    from public.completions c join public.quests q on q.id = c.quest_id and not q.is_penalty
    where c.user_id = p_user and c.date between p_desde and p_hasta;
  select (coalesce((select sum(least(c.xp_awarded, 500)) from public.completions c join public.quests q on q.id = c.quest_id and not q.is_penalty
             where c.user_id = p_user and c.date between p_desde and p_hasta), 0)
        + coalesce((select sum(l.xp) from public.xp_daily_ledger l where l.user_id = p_user and l.day between p_desde and p_hasta), 0))::integer
    into xp;
  return next;
end $$;

-- competition.ts → indiceDisciplina (XP base; prior 0,7 con peso 250) y velocidad (tope 2).
create or replace function public._indice(p_cumplidas_xp integer, p_programadas_xp integer) returns integer
language sql immutable as $$
  select round(100.0 * (least(greatest(p_cumplidas_xp, 0), greatest(p_programadas_xp, 0)) + 0.7 * 250)
               / (greatest(p_programadas_xp, 0) + 250))::integer;
$$;
create or replace function public._velocidad(p_xp integer, p_dias integer, p_base integer, p_dias_base integer default 28) returns numeric
language sql immutable as $$
  select case when p_dias <= 0 or p_base <= 0 then 1
    else round(least(2, (greatest(p_xp, 0)::numeric / p_dias) / (p_base::numeric / greatest(p_dias_base, 1))), 2) end;
$$;

revoke all on function public._xp_base(text), public._indice(integer, integer), public._velocidad(integer, integer, integer, integer)
  from public, anon;
revoke all on function public._son_amigos(uuid, uuid), public._bloqueo_entre(uuid, uuid),
  public._marcador(uuid, date, date), public._dia_en_vivo(uuid, date), public._scorecard_al_cerrar()
  from public, anon, authenticated;

-- ── Ligas ──────────────────────────────────────────────────────────────

create or replace function public.league_create(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); v_id uuid; v_name text;
begin
  if u is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  v_name := left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 40);
  if char_length(v_name) < 2 then raise exception 'Nombre de liga demasiado corto' using errcode = '22023'; end if;
  if (select count(*) from public.private_leagues where owner = u) >= 5 then
    raise exception 'Máximo 5 ligas propias' using errcode = '22023';
  end if;
  if (select count(*) from public.private_leagues where owner = u and created_at > now() - interval '1 day') >= 3 then
    raise exception 'Máximo 3 ligas nuevas al día' using errcode = '22023';
  end if;
  insert into public.private_leagues(owner, name) values (u, v_name) returning id into v_id;
  insert into public.league_members(league_id, user_id) values (v_id, u);
  return v_id;
end $$;

-- Entrar en una liga exige CONSENTIMIENTO (revisión Chat 3, P1-3): el dueño
-- invita a un amigo suyo y el invitado acepta; la invitación caduca a los 7
-- días. Al aceptar se comprueba que no haya bloqueo ni suspensión con NINGÚN
-- miembro: aceptar es consentir que los miembros vean sus métricas.
create table if not exists public.league_invites (
  league_id uuid not null references public.private_leagues(id) on delete cascade,
  invitee uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (league_id, invitee)
);
alter table public.league_invites enable row level security;
revoke all on public.league_invites from anon, authenticated;

create or replace function public.league_invite(p_league uuid, p_friend uuid) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  perform 1 from public.private_leagues where id = p_league and owner = u for update;
  if not found then raise exception 'Solo el dueño invita' using errcode = '42501'; end if;
  if not public._son_amigos(u, p_friend) or not public._pareja_ok(u, p_friend) then
    raise exception 'Solo amigos' using errcode = '42501';
  end if;
  if public._es_miembro(p_league, p_friend) then return; end if;
  if (select count(*) from public.league_members where league_id = p_league)
     + (select count(*) from public.league_invites where league_id = p_league and created_at > now() - interval '7 days') >= 20 then
    raise exception 'La liga está llena (20)' using errcode = '22023';
  end if;
  insert into public.league_invites(league_id, invitee) values (p_league, p_friend)
    on conflict (league_id, invitee) do update set created_at = now();
end $$;

create or replace function public.league_accept(p_league uuid) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  delete from public.league_invites where league_id = p_league and invitee = u and created_at > now() - interval '7 days';
  if not found then raise exception 'Invitación no disponible' using errcode = '42501'; end if;
  perform 1 from public.private_leagues where id = p_league for update;
  if exists (select 1 from public.league_members m where m.league_id = p_league and not public._pareja_ok(m.user_id, u)) then
    raise exception 'No se puede entrar' using errcode = '42501';
  end if;
  if (select count(*) from public.league_members where league_id = p_league) >= 20 then
    raise exception 'La liga está llena (20)' using errcode = '22023';
  end if;
  insert into public.league_members(league_id, user_id) values (p_league, u) on conflict do nothing;
end $$;

create or replace function public.league_decline(p_league uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.league_invites where league_id = p_league and invitee = auth.uid();
$$;

-- Mis invitaciones vigentes: nombre de la liga y alias aprobado de quien invita.
create or replace function public.my_league_invites()
returns table (league_id uuid, nombre text, de text, caduca timestamptz)
language sql stable security definer set search_path = public as $$
  select i.league_id, left(regexp_replace(pl.name, '[\r\n\t]', ' ', 'g'), 40),
         public.social_public_name(pl.owner), i.created_at + interval '7 days'
  from public.league_invites i join public.private_leagues pl on pl.id = i.league_id
  where i.invitee = auth.uid() and i.created_at > now() - interval '7 days'
    and public._pareja_ok(pl.owner, auth.uid())
  order by i.created_at desc limit 20;
$$;

create or replace function public.league_leave(p_league uuid) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  delete from public.league_members where league_id = p_league and user_id = u;
  -- Si el dueño se va, la liga se disuelve.
  delete from public.private_leagues where id = p_league and owner = u;
end $$;

-- Tablero de la semana en curso. Solo para miembros; sin uuid ajenos: alias,
-- retrato aprobado (en su carpeta) y métricas. Sin datos de salud ni de dinero.
-- Si alguien bloqueó a quien consulta (o al revés), no aparece.
create or replace function public.league_board(p_league uuid)
returns table (es_yo boolean, alias text, retrato text, indice integer, velocidad numeric, dias_activos integer, sin_datos boolean)
language plpgsql stable security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  if not public._es_miembro(p_league, u) then
    raise exception 'No eres de esta liga' using errcode = '42501';
  end if;
  return query
  with m as (
    select lm.user_id,
      case when lm.user_id = u then p.name else public.social_public_name(lm.user_id) end as name,
      case when lm.user_id = u then p.avatar_url when r.status = 'approved' and r.approved_avatar = p.avatar_url then p.avatar_url end as avatar_url,
      (now() at time zone public.safe_tz(p.timezone))::date as hoy,
      date_trunc('week', (now() at time zone public.safe_tz(p.timezone)))::date as lunes
    from public.league_members lm join public.profiles p on p.id = lm.user_id
    left join public.social_profile_reviews r on r.user_id = lm.user_id
    where lm.league_id = p_league and (lm.user_id = u or (p.social_visible and public._pareja_ok(u, lm.user_id)))
    limit 20
  )
  select m.user_id = u, left(m.name, 40),
    case when m.avatar_url like m.user_id::text || '/%' then m.avatar_url end,
    public._indice(s.cumplidas_xp, s.programadas_xp),
    public._velocidad(s.xp, greatest(1, (m.hoy - m.lunes) + 1), b.xp),
    s.dias_activos, s.programadas_xp < 150
  from m
  cross join lateral public._marcador(m.user_id, m.lunes, m.lunes + 6) s
  cross join lateral public._marcador(m.user_id, m.lunes - 28, m.lunes - 1) b;
end $$;

-- Para el coach (Chat 3, L5): mis ligas y mi posición. Solo las mías, sin uuid
-- de otros, nombre acotado. Como mucho 10 ligas.
create or replace function public.my_league_standing()
returns table (league_id uuid, nombre text, puesto integer, miembros integer, indice integer, velocidad numeric)
language plpgsql stable security definer set search_path = public as $$
declare u uuid := auth.uid(); l record;
begin
  if u is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  for l in select pl.id, left(regexp_replace(pl.name, '[

	]', ' ', 'g'), 40) as nombre
           from public.private_leagues pl join public.league_members lm on lm.league_id = pl.id and lm.user_id = u
           order by pl.created_at limit 10 loop
    return query
    with b as materialized (select * from public.league_board(l.id)),
         y as (select * from b where b.es_yo)
    select l.id, l.nombre::text,
      (1 + count(*) filter (where not b.sin_datos and (b.indice, b.velocidad, b.dias_activos) > (y.indice, y.velocidad, y.dias_activos)))::integer,
      count(*)::integer, max(y.indice), max(y.velocidad)
    from b cross join y;
  end loop;
end $$;

-- ── Duelos semanales ───────────────────────────────────────────────────

create or replace function public.duel_challenge(p_opponent uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); v_id uuid; v_lunes date;
begin
  if u is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  if not public._son_amigos(u, p_opponent) or not public._pareja_ok(u, p_opponent) then
    raise exception 'Solo entre amigos' using errcode = '42501';
  end if;
  if (select count(*) from public.duels where challenger = u and status = 'pending') >= 3 then
    raise exception 'Máximo 3 retos pendientes' using errcode = '22023';
  end if;
  if (select count(*) from public.duels where u in (challenger, opponent) and status in ('pending', 'accepted')) >= 5 then
    raise exception 'Máximo 5 duelos activos' using errcode = '22023';
  end if;
  select date_trunc('week', (now() at time zone public.safe_tz(p.timezone)))::date into v_lunes
    from public.profiles p where p.id = u;
  insert into public.duels(challenger, opponent, week_start) values (u, p_opponent, v_lunes)
    on conflict do nothing returning id into v_id;
  if v_id is null then raise exception 'Ya hay un duelo esta semana' using errcode = '22023'; end if;
  return v_id;
end $$;

create or replace function public.duel_respond(p_duel uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  update public.duels set status = case when p_accept then 'accepted' else 'declined' end
    where id = p_duel and opponent = u and status = 'pending' and public._pareja_ok(challenger, opponent);
  if not found then raise exception 'Duelo no disponible' using errcode = '42501'; end if;
end $$;

-- Mis duelos con el marcador en vivo; al pasar la semana se resuelve una sola
-- vez (result idempotente). Gana la disciplina, desempatan los días activos.
create or replace function public._duelos_anular_bloqueados(u uuid) returns void
language sql security definer set search_path = public as $$
  update public.duels set status = 'cancelled', result = jsonb_build_object('retador', 'anulado')
  where u in (challenger, opponent) and status in ('pending', 'accepted') and not public._pareja_ok(challenger, opponent);
$$;
revoke all on function public._duelos_anular_bloqueados(uuid) from public, anon, authenticated;

create or replace function public.my_duels()
returns table (id uuid, soy_retador boolean, rival text, week_start date, status text,
               mi_indice integer, su_indice integer, mis_dias integer, sus_dias integer, resultado text)
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); d record; a record; b record; ia integer; ib integer; r text;
begin
  if u is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  perform public._duelos_anular_bloqueados(u);
  for d in select * from public.duels x where u in (x.challenger, x.opponent)
           and x.week_start >= (now()::date - 35) order by x.week_start desc limit 20 loop
    select * into a from public._marcador(u, d.week_start, d.week_start + 6);
    select * into b from public._marcador(case when d.challenger = u then d.opponent else d.challenger end, d.week_start, d.week_start + 6);
    ia := public._indice(a.cumplidas_xp, a.programadas_xp); ib := public._indice(b.cumplidas_xp, b.programadas_xp);
    r := null;
    if d.status in ('accepted', 'done') and public._pareja_ok(d.challenger, d.opponent) and now()::date > d.week_start + 7 then
      r := case when a.programadas_xp < 150 or b.programadas_xp < 150 then 'sin_datos'
                when ia > ib then 'gano' when ia < ib then 'pierdo'
                when a.dias_activos > b.dias_activos then 'gano' when a.dias_activos < b.dias_activos then 'pierdo'
                else 'empate' end;
      if d.status = 'accepted' then
        -- Se guarda desde el punto de vista del retador.
        update public.duels set status = 'done', result = jsonb_build_object('retador',
          case when d.challenger = u then r else
            case r when 'gano' then 'pierdo' when 'pierdo' then 'gano' else r end end)
          where public.duels.id = d.id and public.duels.status = 'accepted';
      end if;
    end if;
    id := d.id; soy_retador := d.challenger = u;
    rival := (select case when public._pareja_ok(d.challenger, d.opponent) then public.social_public_name(p.id) end from public.profiles p where p.id = case when d.challenger = u then d.opponent else d.challenger end);
    week_start := d.week_start; status := d.status; mi_indice := ia; su_indice := ib;
    mis_dias := a.dias_activos; sus_dias := b.dias_activos; resultado := r;
    return next;
  end loop;
end $$;

revoke all on function public.league_create(text), public.league_invite(uuid, uuid), public.league_accept(uuid), public.league_decline(uuid), public.my_league_invites(), public.league_leave(uuid),
  public.league_board(uuid), public.my_league_standing(), public.duel_challenge(uuid), public.duel_respond(uuid, boolean),
  public.my_duels() from public, anon;
grant execute on function public.league_create(text), public.league_invite(uuid, uuid), public.league_accept(uuid), public.league_decline(uuid), public.my_league_invites(), public.league_leave(uuid),
  public.league_board(uuid), public.my_league_standing(), public.duel_challenge(uuid), public.duel_respond(uuid, boolean),
  public.my_duels() to authenticated;

-- ── Última apertura (plan de avisos, docs/game-v2/PLAN-AVISOS.md) ───────
-- El ritual necesita saber cuándo se abrió la app por última vez para no
-- escribir a quien lleva una semana fuera (caducidad 7/30 días) y respetar
-- el tope de 1 push al día. Fecha LOCAL del usuario (safe_tz). La escribe
-- touch_open(), que el cliente llama al abrir; null = cliente antiguo.
alter table public.profiles add column if not exists last_open_on date;

create or replace function public.touch_open() returns date
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); v_hoy date;
begin
  if u is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  select (now() at time zone public.safe_tz(p.timezone))::date into v_hoy from public.profiles p where p.id = u;
  update public.profiles set last_open_on = v_hoy
    where id = u and last_open_on is distinct from v_hoy;
  return v_hoy;
end $$;
revoke all on function public.touch_open() from public, anon;
grant execute on function public.touch_open() to authenticated;

-- ── Tipos de evento generales (sobre require_health_write de 0035) ──────
-- Se conserva todo lo que ya permitía y se añaden duel_won, duel_lost,
-- duel_draw y league_joined (sin datos de salud).
CREATE OR REPLACE FUNCTION public.require_health_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare u uuid:=new.user_id; is_health boolean; parent_table text; parent_key text; parent_owned boolean;
begin
  -- Deleting the account remains available after withdrawal. Cascades may
  -- clear nullable references while auth.users is already gone; no new data
  -- can survive that transaction (all owner FKs cascade from auth.users).
  if pg_trigger_depth()>1 and not exists(select 1 from auth.users where id=u) then return new; end if;
  if tg_op='UPDATE' then
    if new.user_id is distinct from old.user_id then raise exception 'No se puede cambiar el titular' using errcode='42501'; end if;
    -- Narrow redaction-only escape for the service erasure RPC after an
    -- explicitly requested pending job. Every economic field must be identical.
    if tg_table_name in ('money_plan','budgets','transactions','category_rules') then
      if auth.role()='service_role' and old.health_note and not new.health_note
        and exists(select 1 from public.health_erasure_jobs where user_id=u and status='pending') then
        if tg_table_name in ('money_plan','budgets') then
          if new.rationale is null and (to_jsonb(new)-array['rationale','health_note'])=(to_jsonb(old)-array['rationale','health_note']) then return new; end if;
        elsif tg_table_name='transactions' then
          if new.description='Descripción retirada' and (to_jsonb(new)-array['description','health_note'])=(to_jsonb(old)-array['description','health_note']) then return new; end if;
        elsif tg_table_name='category_rules' then
          if not new.active and new.pattern='__nivl_removed_'||new.id::text
            and (to_jsonb(new)-array['pattern','active','health_note'])=(to_jsonb(old)-array['pattern','active','health_note']) then return new; end if;
        end if;
      end if;
    end if;
    if tg_table_name='completions' then
      if auth.role()='service_role' and new.evidence_url is null
        and (to_jsonb(new)-'evidence_url')=(to_jsonb(old)-'evidence_url')
        and exists(select 1 from public.health_erasure_jobs where user_id=u and status='pending') then return new; end if;
    end if;
  end if;
  -- RLS on a child alone does not enforce ownership of its referenced parent.
  select x.t,x.k into parent_table,parent_key from (values
    ('completions','quests','quest_id'),('quest_photos','quests','quest_id'),
    ('rule_checks','rules','rule_id'),('rule_breaks','rules','rule_id'),
    ('dungeon_tasks','dungeons','dungeon_id'),('gym_exercises','gym_days','gym_day_id'),
    ('gym_sessions','gym_days','gym_day_id'),('gym_lifts','gym_sessions','session_id'),
    ('day_blocks','day_plans','plan_id'),('coach_messages','coach_threads','thread_id')
  ) x(child,t,k) where x.child=tg_table_name;
  if parent_table is not null and to_jsonb(new)->>parent_key is not null then
    execute format('select exists(select 1 from public.%I where id=$1 and user_id=$2)',parent_table)
      into parent_owned using (to_jsonb(new)->>parent_key)::uuid,u;
    if not parent_owned then raise exception 'Referencia ajena' using errcode='42501'; end if;
  end if;
  if tg_table_name='events' then
    -- Old client APIs pass titles rather than IDs. Preserve known provenance
    -- when they copy a health-tagged mission, rule, campaign or goal.
    if exists(select 1 from public.quests q where q.user_id=u and q.title=new.payload->>'quest' and public.health_row('quests',to_jsonb(q)))
      or exists(select 1 from public.rules r where r.user_id=u and r.text=new.payload->>'rule' and public.health_row('rules',to_jsonb(r)))
      or exists(select 1 from public.dungeons d where d.user_id=u and d.title=new.payload->>'dungeon' and public.health_row('dungeons',to_jsonb(d)))
      or exists(select 1 from public.goals g where g.user_id=u and g.title=new.payload->>'goal' and public.health_row('goals',to_jsonb(g))) then new.health_data:=true; end if;
  end if;
  is_health:=public.health_row(tg_table_name,to_jsonb(new));
  if tg_op='UPDATE' then is_health:=is_health or public.health_row(tg_table_name,to_jsonb(old)); end if;
  if is_health then
    perform public.assert_health_write(u);
    -- A health-derived record cannot be laundered by clearing its marker.
    if to_jsonb(new) ? 'health_data' then new:=jsonb_populate_record(new,jsonb_build_object('health_data',true)); end if;
    if to_jsonb(new) ? 'health_note' then new:=jsonb_populate_record(new,jsonb_build_object('health_note',true)); end if;
  end if;
  if tg_table_name='events' then
    if not is_health then
      if new.type not in ('quest_completed','bonus_earned','habit_acquired','dungeon_task','dungeon_cleared','goal_achieved','rule_broken','penalty','stone_used','stone_earned','streak_lost','level_up','freeze_on','freeze_off','commitment_signed','onboarding_goal','trial_started','creator_referral','pro_interest','duel_won','duel_lost','duel_draw','league_joined') then
        perform public.assert_health_write(u);
        new.health_data:=true;
      else new.payload:=public.general_event_payload(new.payload);
      end if;
    end if;
  end if;
  return new;
end $function$
;

commit;

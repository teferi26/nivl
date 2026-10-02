-- PROPUESTA (Chat 5) · Competición entre amigos: ligas privadas y duelos semanales.
-- NO es una migración aplicada. El número lo asigna el coordinador. Revisión y
-- pruebas en rollback: Chat 3 (requisitos-seguridad.md §5).
--
-- Aditiva y compatible con 1.0.7: tablas y RPC nuevas; friends_board y
-- elite_group_board no se tocan. Sin XP en juego: solo se mide.
-- Las fórmulas replican src/lib/competition.ts (indiceDisciplina, velocidad,
-- resolverDuelo). Si tocas una, toca la otra.
--
-- Pendiente de integrar en la misma migración (lo hace el coordinador sobre la
-- última versión de require_health_write, 0035): añadir 'duel_won',
-- 'duel_lost', 'duel_draw', 'league_joined' a la lista de eventos generales.

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

create policy "ligas: solo miembros" on public.private_leagues for select to authenticated
  using (exists (select 1 from public.league_members m where m.league_id = id and m.user_id = auth.uid()));
create policy "miembros: solo de mis ligas" on public.league_members for select to authenticated
  using (exists (select 1 from public.league_members m where m.league_id = league_members.league_id and m.user_id = auth.uid()));
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
  where q.user_id = p_user and q.active and not q.is_penalty and not q.is_bonus and q.acquired_at is null
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
  insert into public.private_leagues(owner, name) values (u, v_name) returning id into v_id;
  insert into public.league_members(league_id, user_id) values (v_id, u);
  return v_id;
end $$;

-- El dueño añade a un AMIGO suyo. Nadie entra si hay bloqueo con algún miembro.
create or replace function public.league_add_member(p_league uuid, p_friend uuid) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  perform 1 from public.private_leagues where id = p_league and owner = u for update;
  if not found then raise exception 'Solo el dueño añade miembros' using errcode = '42501'; end if;
  if not public._son_amigos(u, p_friend) then raise exception 'Solo amigos' using errcode = '42501'; end if;
  if exists (select 1 from public.league_members m where m.league_id = p_league and public._bloqueo_entre(m.user_id, p_friend)) then
    raise exception 'No se puede añadir' using errcode = '42501';
  end if;
  if (select count(*) from public.league_members where league_id = p_league) >= 20 then
    raise exception 'La liga está llena (20)' using errcode = '22023';
  end if;
  insert into public.league_members(league_id, user_id) values (p_league, p_friend) on conflict do nothing;
end $$;

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
  if not exists (select 1 from public.league_members where league_id = p_league and user_id = u) then
    raise exception 'No eres de esta liga' using errcode = '42501';
  end if;
  return query
  with m as (
    select lm.user_id, p.name, p.avatar_url, p.social_visible,
      (now() at time zone public.safe_tz(p.timezone))::date as hoy,
      date_trunc('week', (now() at time zone public.safe_tz(p.timezone)))::date as lunes
    from public.league_members lm join public.profiles p on p.id = lm.user_id
    where lm.league_id = p_league and (lm.user_id = u or not public._bloqueo_entre(u, lm.user_id))
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
declare u uuid := auth.uid(); l record; v_puesto integer; v_n integer; v_i integer; v_v numeric;
begin
  if u is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  for l in select pl.id, left(regexp_replace(pl.name, '[\r\n\t]', ' ', 'g'), 40) as nombre
           from public.private_leagues pl join public.league_members lm on lm.league_id = pl.id and lm.user_id = u
           order by pl.created_at limit 10 loop
    select count(*)::integer,
           1 + count(*) filter (where not b.sin_datos and (b.indice, b.velocidad, b.dias_activos) >
             (select (x.indice, x.velocidad, x.dias_activos) from public.league_board(l.id) x where x.es_yo))::integer
      into v_n, v_puesto from public.league_board(l.id) b;
    select x.indice, x.velocidad into v_i, v_v from public.league_board(l.id) x where x.es_yo;
    league_id := l.id; nombre := l.nombre; puesto := v_puesto; miembros := v_n; indice := v_i; velocidad := v_v;
    return next;
  end loop;
end $$;

-- ── Duelos semanales ───────────────────────────────────────────────────

create or replace function public.duel_challenge(p_opponent uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); v_id uuid; v_lunes date;
begin
  if u is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  if not public._son_amigos(u, p_opponent) or public._bloqueo_entre(u, p_opponent) then
    raise exception 'Solo entre amigos' using errcode = '42501';
  end if;
  if (select count(*) from public.duels where challenger = u and status = 'pending') >= 3 then
    raise exception 'Máximo 3 retos pendientes' using errcode = '22023';
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
    where id = p_duel and opponent = u and status = 'pending';
  if not found then raise exception 'Duelo no disponible' using errcode = '42501'; end if;
end $$;

-- Mis duelos con el marcador en vivo; al pasar la semana se resuelve una sola
-- vez (result idempotente). Gana la disciplina, desempatan los días activos.
create or replace function public.my_duels()
returns table (id uuid, soy_retador boolean, rival text, week_start date, status text,
               mi_indice integer, su_indice integer, mis_dias integer, sus_dias integer, resultado text)
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); d record; a record; b record; ia integer; ib integer; r text;
begin
  if u is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  for d in select * from public.duels x where u in (x.challenger, x.opponent)
           and x.week_start >= (now()::date - 35) order by x.week_start desc limit 20 loop
    select * into a from public._marcador(u, d.week_start, d.week_start + 6);
    select * into b from public._marcador(case when d.challenger = u then d.opponent else d.challenger end, d.week_start, d.week_start + 6);
    ia := public._indice(a.cumplidas_xp, a.programadas_xp); ib := public._indice(b.cumplidas_xp, b.programadas_xp);
    r := null;
    if d.status in ('accepted', 'done') and now()::date > d.week_start + 7 then
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
    rival := (select left(p.name, 40) from public.profiles p where p.id = case when d.challenger = u then d.opponent else d.challenger end);
    week_start := d.week_start; status := d.status; mi_indice := ia; su_indice := ib;
    mis_dias := a.dias_activos; sus_dias := b.dias_activos; resultado := r;
    return next;
  end loop;
end $$;

revoke all on function public.league_create(text), public.league_add_member(uuid, uuid), public.league_leave(uuid),
  public.league_board(uuid), public.my_league_standing(), public.duel_challenge(uuid), public.duel_respond(uuid, boolean),
  public.my_duels() from public, anon;
grant execute on function public.league_create(text), public.league_add_member(uuid, uuid), public.league_leave(uuid),
  public.league_board(uuid), public.my_league_standing(), public.duel_challenge(uuid), public.duel_respond(uuid, boolean),
  public.my_duels() to authenticated;

commit;

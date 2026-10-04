-- ARREGLOS PROPUESTOS (revisión Chat 3)
-- F1' (sobre 0048) pertenencia SIN sondeo: la política solo pregunta por mí
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

-- F2 bloqueo O suspensión (social_pair_allowed exige auth.uid() en la pareja; aquí no sirve)
create or replace function public._pareja_ok(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select a = b or (not public._bloqueo_entre(a, b)
    and not exists (select 1 from public.social_profile_reviews r where r.user_id in (a, b) and r.status = 'suspended'));
$$;
revoke all on function public._pareja_ok(uuid, uuid) from public, anon, authenticated;

-- F3 tablero: alias/retrato APROBADOS (como friends_board), social_visible, suspendidos fuera
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

-- F4 my_league_standing: comparación de filas (antes 42601) y un solo league_board por liga
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

-- F5 duelos: bloqueo/suspensión posterior anula sin ganador
create or replace function public.duel_respond(p_duel uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  update public.duels set status = case when p_accept then 'accepted' else 'declined' end
    where id = p_duel and opponent = u and status = 'pending' and public._pareja_ok(challenger, opponent);
  if not found then raise exception 'Duelo no disponible' using errcode = '42501'; end if;
end $$;
create or replace function public._duelos_anular_bloqueados(u uuid) returns void
language sql security definer set search_path = public as $$
  update public.duels set status = 'cancelled', result = jsonb_build_object('retador', 'anulado')
  where u in (challenger, opponent) and status in ('pending', 'accepted') and not public._pareja_ok(challenger, opponent);
$$;
revoke all on function public._duelos_anular_bloqueados(uuid) from public, anon, authenticated;

-- F5b my_duels
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


-- F6 guarda del rango: invoker + current_user (la bandera de sesión la pone cualquiera)
create or replace function public._achievements_rango_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.code like 'rango\_%' escape '\' and current_user in ('authenticated', 'anon') then
    raise exception 'El rango lo registra el servidor' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public._achievements_rango_guard() from public, anon, authenticated;

-- NIVL · 0051 — Rango v2 decidido y registrado por el servidor.
-- Chat 5, revisión del Chat 3. Aditiva; NO toca export_my_data.
-- Huella: to_regprocedure('public.sync_rank()') is not null
begin;

-- Nivel desde xp_total con la misma curva que game.ts (100·N^1,5, redondeo).
create or replace function public._nivel_de_xp(p_xp integer) returns integer
language plpgsql immutable as $$
declare n integer := 1; resto bigint := greatest(0, coalesce(p_xp, 0));
begin
  while n < 999 and resto >= round(100 * power(n, 1.5)) loop
    resto := resto - round(100 * power(n, 1.5));
    n := n + 1;
  end loop;
  return n;
end $$;

-- Espejo de progression.ts → rangoMerecido. Si tocas uno, toca el otro.
create or replace function public._rango_merecido(p_nivel integer, p_dias integer) returns text
language sql immutable as $$
  with niv as (
    select case when p_nivel >= 30 then 5 when p_nivel >= 22 then 4 when p_nivel >= 15 then 3
                when p_nivel >= 10 then 2 when p_nivel >= 5 then 1 else 0 end as i
  ), dia as (
    select case when p_dias >= 600 then 5 when p_dias >= 300 then 4 when p_dias >= 110 then 3
                when p_dias >= 40 then 2 when p_dias >= 7 then 1 else 0 end as i
  )
  select (array['E','D','C','B','A','S'])[least(niv.i, dia.i) + 1] from niv, dia;
$$;

-- Registra los rangos merecidos que falten y devuelve {rango, nuevos[]}.
-- Idempotente; nunca borra (el rango no baja).
create or replace function public.sync_rank() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  v_nivel integer;
  v_dias integer;
  v_rango text;
  v_orden text[] := array['D','C','B','A','S'];
  v_nuevos text[] := '{}';
  r text;
begin
  if u is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  select public._nivel_de_xp(xp_total) into v_nivel from public.profiles where id = u;
  -- Días activos: fechas distintas con alguna misión (no penalización) cumplida.
  select count(distinct c.date)::integer into v_dias
    from public.completions c join public.quests q on q.id = c.quest_id and not q.is_penalty
    where c.user_id = u;
  v_rango := public._rango_merecido(coalesce(v_nivel, 1), coalesce(v_dias, 0));
  foreach r in array v_orden loop
    exit when array_position(array['E','D','C','B','A','S'], r) > array_position(array['E','D','C','B','A','S'], v_rango);
    insert into public.achievements(user_id, code) values (u, 'rango_' || r)
      on conflict (user_id, code) do nothing;
    if found then v_nuevos := v_nuevos || ('rango_' || r); end if;
  end loop;
  return jsonb_build_object(
    'rango', coalesce((select (array['E','D','C','B','A','S'])[max(array_position(array['E','D','C','B','A','S'], substr(a.code, 7)))]
                        from public.achievements a where a.user_id = u and a.code ~ '^rango_[DCBAS]$'), 'E'),
    'nuevos', to_jsonb(v_nuevos),
    'nivel', v_nivel,
    'dias_activos', v_dias);
end $$;
revoke all on function public.sync_rank() from public, anon;
grant execute on function public.sync_rank() to authenticated;
revoke all on function public._nivel_de_xp(integer), public._rango_merecido(integer, integer) from public, anon, authenticated;

-- El cliente ya no puede escribir `rango_%`: el trigger es INVOKER y mira
-- current_user (revisión Chat 3: una bandera de sesión la puede poner
-- cualquiera). sync_rank es security definer y escribe como su dueño.
create or replace function public._achievements_rango_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.code like 'rango\_%' escape '\' and current_user in ('authenticated', 'anon') then
    raise exception 'El rango lo registra el servidor' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public._achievements_rango_guard() from public, anon, authenticated;
drop trigger if exists achievements_rango_guard on public.achievements;
create trigger achievements_rango_guard before insert or update on public.achievements
  for each row execute function public._achievements_rango_guard();

commit;

-- Pruebas que propongo para el rollback del Chat 3:
-- 1. insert into achievements(user_id, code) values (auth.uid(), 'rango_S') como authenticated → 42501.
-- 2. sync_rank() con xp de nivel 31 y 50 días activos → rango 'D', nuevos ['rango_D'].
-- 3. sync_rank() dos veces → la segunda devuelve nuevos [].
-- 4. Bajar xp_total (penalización) y sync_rank() → no borra nada.
-- 5. Cliente 1.0.7 (insertar logros normales) sigue funcionando.

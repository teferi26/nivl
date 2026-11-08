-- NIVL · 0128 · La próxima sesión, para el día en que la TV no tiene entreno.
-- Huella (scripts/apply-migrations.mjs): comentario nivl:tv-proxima-0128 en tv_datos(text, date).
-- Prueba: scripts/test-tv-proxima.mjs. Contrato: tv/CONTRATO.md.
--
-- Depende de la 0126. No copia sus 270 líneas: la renombra y la envuelve, y añade una sola clave, `proxima`.
-- El comentario de la función sigue llevando la huella de la 0126 para que apply-migrations no la reaplique.
--
-- LO QUE NO SE NEGOCIA
--   · Salud (0030): gym_days, gym_exercises y training_prescriptions son datos de salud. Sin consentimiento
--     vigente, `proxima` es null.
--   · Solo lectura. La validación del token, la caducidad y la identidad son las de la 0126: si ella no dice
--     `ok`, se devuelve su respuesta tal cual.
--
-- DE DÓNDE SALE: los siete días siguientes a `hoy`, el primero que tenga algo. Ese día manda la prescripción
-- del coach sobre la rutina semanal, igual que en la rutina de hoy. Un día de rutina sin ejercicios no cuenta.
begin;

do $$
begin
  if to_regprocedure('public._tv_datos_0126(text,date)') is null then
    alter function public.tv_datos(text, date) rename to _tv_datos_0126;
  end if;
end $$;

revoke all on function public._tv_datos_0126(text, date) from public, anon, authenticated;

create or replace function public.tv_datos(p_token text, p_hoy date default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r jsonb := public._tv_datos_0126(p_token, p_hoy);
  u uuid;
  v_hoy date;
  v_proxima jsonb := null;
begin
  if r ->> 'estado' is distinct from 'ok' then return r; end if;

  if (r ->> 'salud_activa')::boolean then
    select d.user_id into u from public.tv_dispositivos d where d.token_hash = public._tv_sha(p_token);
    v_hoy := (r ->> 'hoy')::date;

    with candidatos as (
      select t.date as dia, 0 as prioridad, null::uuid as id,
        coalesce((select g.name from public.gym_days g where g.user_id = u
                    and g.day_of_week = extract(isodow from t.date)::integer order by g.id limit 1), 'Entreno prescrito') as nombre,
        count(*)::integer as ejercicios
      from public.training_prescriptions t
      where t.user_id = u and t.date between v_hoy + 1 and v_hoy + 7
      group by t.date
      union all
      select v_hoy + n, 1, g.id, g.name,
        (select count(*)::integer from public.gym_exercises e where e.gym_day_id = g.id and e.user_id = u)
      from generate_series(1, 7) n
      join public.gym_days g on g.user_id = u and g.day_of_week = extract(isodow from v_hoy + n)::integer
    )
    select jsonb_build_object('nombre', c.nombre, 'dia_semana', extract(isodow from c.dia)::integer,
        'en_dias', c.dia - v_hoy, 'ejercicios', c.ejercicios)
      into v_proxima
      from candidatos c
      where c.ejercicios > 0
      order by c.dia, c.prioridad, c.id
      limit 1;
  end if;

  return r || jsonb_build_object('proxima', v_proxima);
end $$;

revoke all on function public.tv_datos(text, date) from public, anon, authenticated;
grant execute on function public.tv_datos(text, date) to anon;

comment on function public.tv_datos(text, date) is 'nivl:tv-datos-0126 nivl:tv-proxima-0128 · lectura de la TV por token opaco';

notify pgrst, 'reload schema';
commit;

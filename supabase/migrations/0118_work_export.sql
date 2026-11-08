-- 0118 · WORK: la exportación cubre las cuatro tablas de la 0115 (versión 12). docs/modos/WORK.md
-- Huella: coalesce(obj_description(to_regprocedure('public.export_my_data()'), 'pg_proc') like '%nivl:export-work-0118%', false)
--
-- ENVOLTORIO, igual que la 0079, y no copia entera: la versión vigente de export_my_data YA es un
-- envoltorio (0079) sobre la v11 de la 0076, y su cabecera explica el motivo. Una copia entera
-- borraría las tablas que haya añadido otra rama antes de esta migración. Así la función que haya
-- en la base, sea cual sea, pasa a llamarse `_export_my_data_sin_work()` y se le añaden estas claves.
-- Las columnas nuevas de quests y calendar_events viajan en la fila entera.
begin;

do $$
declare v_actual text := obj_description(to_regprocedure('public.export_my_data()'), 'pg_proc');
begin
  if to_regprocedure('public.export_my_data()') is null then
    raise exception 'export_my_data() no existe';
  end if;
  if coalesce(v_actual, '') not like '%nivl:export-work-0118%' then
    drop function if exists public._export_my_data_sin_work();
    alter function public.export_my_data() rename to _export_my_data_sin_work;
  end if;
end $$;

revoke all on function public._export_my_data_sin_work() from public, anon, authenticated;

create or replace function public.export_my_data() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  u uuid := auth.uid();
  t text;
  filas jsonb;
  resultado jsonb;
begin
  if u is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  resultado := public._export_my_data_sin_work() || jsonb_build_object('version', 12);
  foreach t in array array['work_projects','work_deliverables','work_sessions','work_reviews'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(r)), ''[]''::jsonb) from public.%I r where user_id = $1', t) into filas using u;
    resultado := resultado || jsonb_build_object(t, filas);
  end loop;
  return resultado;
end $$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

-- El comentario conserva las marcas anteriores: las huellas de las migraciones previas las buscan aquí.
do $$
begin
  execute format('comment on function public.export_my_data() is %L',
    coalesce(obj_description(to_regprocedure('public._export_my_data_sin_work()'), 'pg_proc'), '')
    || ' · nivl:export-work-0118 (v12: envoltorio + tablas WORK de la 0115)');
end $$;

commit;

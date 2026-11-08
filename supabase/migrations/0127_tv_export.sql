-- NIVL · 0127 · La exportación de datos cubre las tablas de la TV (tv_dispositivos, tv_enlaces, tv_intentos).
-- Huella (scripts/apply-migrations.mjs): marca nivl:export-tv-0127 en el comentario de export_my_data().
-- Prueba: scripts/test-tv-enlace.mjs. Sin hashes, sin el código y sin el token.
--
-- ENVOLTORIO como la 0079: la versión vigente pasa a llamarse _export_my_data_sin_tv() y export_my_data() la
-- envuelve y añade tres claves. Una copia entera borraría las tablas que otras ramas han añadido a la función.
-- Reejecutable: detecta por el comentario si la vigente ya es este envoltorio.
begin;

do $$
declare v_actual text := obj_description(to_regprocedure('public.export_my_data()'), 'pg_proc');
begin
  if to_regprocedure('public.export_my_data()') is null then
    raise exception 'export_my_data() no existe';
  end if;
  if coalesce(v_actual, '') not like '%nivl:export-tv-0127%' then
    drop function if exists public._export_my_data_sin_tv();
    alter function public.export_my_data() rename to _export_my_data_sin_tv;
  end if;
end $$;

revoke all on function public._export_my_data_sin_tv() from public, anon, authenticated;

create or replace function public.export_my_data() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  return public._export_my_data_sin_tv() || jsonb_build_object(
    'tv_dispositivos', (select coalesce(jsonb_agg(jsonb_build_object('nombre', d.nombre, 'creado_en', d.creado_en,
        'ultimo_uso', d.ultimo_uso, 'caduca_en', d.caduca_en) order by d.creado_en), '[]'::jsonb)
      from public.tv_dispositivos d where d.user_id = u),
    'tv_enlaces', (select coalesce(jsonb_agg(jsonb_build_object('nombre', e.nombre, 'estado', e.estado, 'creado_en', e.creado_en,
        'aprobado_en', e.aprobado_en, 'caduca_en', e.caduca_en) order by e.creado_en), '[]'::jsonb)
      from public.tv_enlaces e where e.user_id = u),
    'tv_intentos', (select coalesce(jsonb_agg(jsonb_build_object('fallos', i.fallos, 'ventana_desde', i.ventana_desde)), '[]'::jsonb)
      from public.tv_intentos i where i.user_id = u));
end $$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

-- El comentario conserva las marcas de la versión envuelta: las huellas de migraciones anteriores las buscan aquí.
do $$
begin
  execute format('comment on function public.export_my_data() is %L',
    coalesce(obj_description(to_regprocedure('public._export_my_data_sin_tv()'), 'pg_proc'), '')
    || ' · nivl:export-tv-0127 (envoltorio + tablas de la TV)');
end $$;

commit;

-- NIVL · 0079 · La exportación de datos cubre la cartera de IA de la 0078 (ai_cargos, ai_recargas, ai_cartera).
-- Huella para scripts/apply-migrations.mjs:
--   coalesce(obj_description(to_regprocedure('public.export_my_data()'), 'pg_proc') like '%nivl:export-ia-0079%', false)
-- Prueba: scripts/test-ia-tope-abuso.mjs (la exportación propia trae sus cargos y recargas y ninguna ajena).
--
-- Por qué un ENVOLTORIO y no otra copia entera de export_my_data: varias ramas (0075 focus, 0075
-- work-economia…) reescriben la función entera. Una copia aquí borraría sus tablas si se aplicara después.
-- En su lugar, la versión que haya en la base (sea la v9 de la 0072 o la v10 de una 0075) pasa a llamarse
-- `_export_my_data_sin_ia()` y `export_my_data()` la envuelve y añade tres claves. Si después alguien vuelve a
-- reescribir export_my_data con una copia entera, re-ejecutar esta migración vuelve a envolverla (detecta
-- por el comentario si la vigente ya es este envoltorio).
begin;

do $$
declare v_actual text := obj_description(to_regprocedure('public.export_my_data()'), 'pg_proc');
begin
  if to_regprocedure('public.export_my_data()') is null then
    raise exception 'export_my_data() no existe: aplica antes la 0072';
  end if;
  if coalesce(v_actual, '') not like '%nivl:export-ia-0079%' then
    drop function if exists public._export_my_data_sin_ia();
    alter function public.export_my_data() rename to _export_my_data_sin_ia;
  end if;
end $$;

revoke all on function public._export_my_data_sin_ia() from public, anon, authenticated;

create or replace function public.export_my_data() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  return public._export_my_data_sin_ia() || jsonb_build_object(
    'ai_cargos', (select coalesce(jsonb_agg(jsonb_build_object('funcion', c.funcion, 'modo', c.modo,
        'reservado_micro', c.reservado_micro, 'real_micro', c.real_micro, 'estado', c.estado,
        'created_at', c.created_at, 'liquidado_at', c.liquidado_at) order by c.created_at), '[]'::jsonb)
      from public.ai_cargos c where c.user_id = u),
    'ai_recargas', (select coalesce(jsonb_agg(jsonb_build_object('product_id', r.product_id, 'micro_usd', r.micro_usd,
        'tienda', r.tienda, 'entorno', r.entorno, 'comprada_at', r.comprada_at, 'reembolsada_at', r.reembolsada_at)
        order by r.comprada_at), '[]'::jsonb)
      from public.ai_recargas r where r.user_id = u),
    'ai_cartera', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.ai_cartera a where a.user_id = u));
end $$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
-- El comentario conserva las marcas de la versión envuelta: las huellas de 0064/0068/0072 (y las de ramas
-- que se apliquen antes) las buscan en export_my_data() y, sin ellas, se reaplicarían en cada ejecución.
do $$
begin
  execute format('comment on function public.export_my_data() is %L',
    coalesce(obj_description(to_regprocedure('public._export_my_data_sin_ia()'), 'pg_proc'), '')
    || ' · nivl:export-ia-0079 (envoltorio + cartera de IA de la 0078)');
end $$;

commit;

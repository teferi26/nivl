-- NIVL · 0108 · IRON Resistencia: exportación y borrado de salud de las cinco tablas nuevas.
-- Huella: coalesce(obj_description(to_regprocedure('public.export_my_data()'), 'pg_proc') like '%nivl:export-resistencia-0108%', false) and coalesce(obj_description(to_regprocedure('public.complete_health_erasure(uuid,uuid)'), 'pg_proc') like '%nivl:borrado-resistencia-0108%', false)
--
-- Va justo después de 0105-0107 y se aplica en la misma tanda: entre ellas no
-- debe desplegarse nada que escriba en esas tablas.
--
-- Exportación: la versión vigente es el envoltorio de la 0079, así que se copia
-- ese envoltorio entero y se añaden cinco claves. La ruta GPS y la serie de
-- pulso van completas: son datos de la persona.
-- El comentario conserva todas las marcas anteriores: las huellas de 0064, 0068,
-- 0072, 0075, 0076 y 0079 las buscan en export_my_data().
--
-- Borrado de salud: copia de complete_health_erasure de la 0050 con las tablas
-- nuevas al principio. plan_sesiones va antes que entrenos_medidos para que su
-- ON DELETE SET NULL no intente un UPDATE sin permiso de salud (es el mismo
-- criterio que la 0030 sigue con fotos y bloques).
-- Borrado de cuenta: nada que tocar. Las cinco cuelgan de auth.users con ON
-- DELETE CASCADE y no guardan archivos en Storage.
begin;

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
    'ai_cartera', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.ai_cartera a where a.user_id = u),
    'entrenos_medidos', (select coalesce(jsonb_agg(to_jsonb(t) order by t.inicio), '[]'::jsonb) from public.entrenos_medidos t where t.user_id = u),
    'entreno_perfil', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.entreno_perfil t where t.user_id = u),
    'entreno_bienestar', (select coalesce(jsonb_agg(to_jsonb(t) order by t.fecha), '[]'::jsonb) from public.entreno_bienestar t where t.user_id = u),
    'objetivos_carrera', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]'::jsonb) from public.objetivos_carrera t where t.user_id = u),
    'plan_sesiones', (select coalesce(jsonb_agg(to_jsonb(t) order by t.fecha), '[]'::jsonb) from public.plan_sesiones t where t.user_id = u));
end $$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
do $$
begin
  execute format('comment on function public.export_my_data() is %L',
    coalesce(obj_description(to_regprocedure('public.export_my_data()'), 'pg_proc'), '')
    || ' · nivl:export-resistencia-0108 (entrenos, perfil, bienestar, objetivos y plan)');
end $$;

create or replace function public.complete_health_erasure(p_user uuid, p_job uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare t text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'No autorizado' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,630030));
  if not exists(select 1 from public.health_erasure_jobs where user_id=p_user and id=p_job and status='pending') then
    raise exception 'Solicitud de borrado no vigente' using errcode='42501';
  end if;
  if exists(select 1 from storage.objects where bucket_id in ('evidence','progress') and (storage.foldername(name))[1]=p_user::text) then
    raise exception 'Quedan fotos por eliminar';
  end if;
  -- No background sweep: this function runs only for an explicit erasure job.
  -- Delete health-tagged mixed data and structured physical habits only.
  -- General legacy rows are not inferred to be health or deleted wholesale.
  delete from public.events where user_id=p_user and public.health_row('events',to_jsonb(events));
  delete from public.dungeon_tasks where user_id=p_user and public.health_row('dungeon_tasks',to_jsonb(dungeon_tasks));
  delete from public.dungeons where user_id=p_user and public.health_row('dungeons',to_jsonb(dungeons));
  delete from public.calendar_events where user_id=p_user and health_data;
  delete from public.shopping_items where user_id=p_user and health_data;
  delete from public.letters where user_id=p_user and health_data;
  foreach t in array array['plan_sesiones','objetivos_carrera','entreno_bienestar','entreno_perfil','entrenos_medidos',
    'gym_lifts','gym_exercises','gym_sessions','gym_days','body_profile','body_metrics',
    'cardio_sessions','nutrition_targets','nutrition_logs','training_prescriptions','meal_slots','journal_photos',
    'quest_photos','progress_photos','journal_entries','coach_messages','coach_threads','coach_facts','coach_dossier','recaps','day_blocks','day_plans'] loop
    execute format('delete from public.%I where user_id=$1',t) using p_user;
  end loop;
  -- Remove referencing photos/day blocks before their ON DELETE SET NULL
  -- parent links, so erasure never needs an unrelated health write exception.
  delete from public.quests where user_id=p_user and public.health_row('quests',to_jsonb(quests));
  delete from public.rules where user_id=p_user and public.health_row('rules',to_jsonb(rules));
  delete from public.goals where user_id=p_user and public.health_row('goals',to_jsonb(goals));
  -- Financial rows/amounts/categories/accounts and legacy unmarked text stay.
  -- Disable marked classifier rules instead of deleting them or matching ''.
  update public.money_plan set rationale=null,health_note=false where user_id=p_user and health_note;
  update public.budgets set rationale=null,health_note=false where user_id=p_user and health_note;
  update public.transactions set description='Descripción retirada',health_note=false where user_id=p_user and health_note;
  update public.category_rules set pattern='__nivl_removed_'||id::text,active=false,health_note=false
    where user_id=p_user and health_note;
  -- Retain the fact/XP of completed habits, remove their photo reference.
  update public.completions set evidence_url=null where user_id=p_user and evidence_url is not null;
  update public.health_erasure_jobs set status='complete',completed_at=clock_timestamp()
    where user_id=p_user and id=p_job;
  return jsonb_build_object('ok',true);
end $function$;
revoke all on function public.complete_health_erasure(uuid, uuid) from public, anon, authenticated;
grant execute on function public.complete_health_erasure(uuid, uuid) to service_role;
comment on function public.complete_health_erasure(uuid, uuid) is
  'Borrado de salud a petición de la persona; incluye IRON Resistencia. nivl:borrado-resistencia-0108';

commit;

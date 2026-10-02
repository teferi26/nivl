-- ADENDA de seguridad (Chat 3) a la propuesta de origen de salud del Chat 1
-- (winter2/chat1-compartir @ d2ed99b). Va en LA MISMA migración, a continuación
-- de su SQL. La exportación de health_daily_steps va en la migración de exportación consolidada del Chat 3 (última de la tanda).
-- Cierra 5 huecos reproducidos en rollback contra el esquema vivo (02/10):
--   pasos insertables SIN consentimiento de salud; sin trigger de salud ni de
--   borrado pendiente; fuera del borrado de salud; fuera de la exportación;
--   privilegios por defecto para anon.

revoke all on public.health_daily_steps from anon;
revoke truncate, trigger, references on public.health_daily_steps from authenticated;

create policy health_permission on public.health_daily_steps as restrictive
  for all to authenticated
  using ((not public.health_row('health_daily_steps', to_jsonb(health_daily_steps.*))) or public.health_consent_ok(auth.uid()))
  with check ((not public.health_row('health_daily_steps', to_jsonb(health_daily_steps.*))) or public.health_consent_ok(auth.uid()));

create trigger account_write_guard before insert or update on public.health_daily_steps
  for each row execute function public.require_account_active('user_id');
create trigger health_write before insert or update on public.health_daily_steps
  for each row execute function public.require_health_write();

-- Borrado de datos de salud: la misma función viva, con la tabla nueva en la lista.
CREATE OR REPLACE FUNCTION public.complete_health_erasure(p_user uuid, p_job uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'No autorizado' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,630030));
  if not exists(select 1 from public.health_erasure_jobs where user_id=p_user and id=p_job and status='pending') then
    raise exception 'Solicitud de borrado no vigente' using errcode='42501';
  end if;
  if exists(select 1 from storage.objects where bucket_id='evidence' and (storage.foldername(name))[1]=p_user::text) then
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
  foreach t in array array['gym_lifts','gym_exercises','gym_sessions','gym_days','body_profile','body_metrics',
    'cardio_sessions','nutrition_targets','nutrition_logs','training_prescriptions','meal_slots','journal_photos',
    'quest_photos','journal_entries','coach_messages','coach_threads','coach_facts','coach_dossier','recaps','day_blocks','day_plans','health_daily_steps'] loop
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
end $function$
;


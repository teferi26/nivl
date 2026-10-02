-- 0049 · Origen de los datos de salud importados (HealthKit / Health Connect).
--
-- Propuesta del Chat 1 (winter2/chat1-compartir @16c7fa2) + adenda de seguridad
-- del Chat 3 (winter2/chat3-ia @221e70e, versión sin exportación), en una sola migración por decisión del
-- coordinador. Aditiva y compatible con binarios 1.0.7: columnas nuevas con
-- valor por defecto 'manual', sin tocar firmas, únicos existentes ni políticas.
-- Se aplica con 1.0.9 (bibliotecas nativas), salvo que se adelante la integración.
--
-- NO toca export_my_data: el Chat 3 añade 'health_daily_steps' a la exportación
-- en su migración de exportación consolidada, la última de la tanda.
--
-- Huella propuesta para scripts/apply-migrations.mjs:
--   '0049': `exists(select 1 from information_schema.columns where table_schema='public' and table_name='cardio_sessions' and column_name='source') and to_regclass('public.health_daily_steps') is not null`

-- ── 1. Origen en las tablas existentes (Chat 1) ─────────────────────────

alter table public.cardio_sessions
  add column if not exists source text not null default 'manual',
  add column if not exists external_id text;
alter table public.cardio_sessions
  add constraint cardio_sessions_source_check
  check (source in ('manual', 'healthkit', 'health_connect'));
alter table public.cardio_sessions
  add constraint cardio_sessions_external_id_check
  check ((source = 'manual') = (external_id is null) and (external_id is null or length(external_id) <= 128));
create unique index if not exists cardio_sessions_import_uidx
  on public.cardio_sessions (user_id, source, external_id)
  where external_id is not null;

alter table public.body_metrics
  add column if not exists source text not null default 'manual',
  add column if not exists external_id text;
alter table public.body_metrics
  add constraint body_metrics_source_check
  check (source in ('manual', 'healthkit', 'health_connect'));
alter table public.body_metrics
  add constraint body_metrics_external_id_check
  check ((source = 'manual') = (external_id is null) and (external_id is null or length(external_id) <= 128));
create unique index if not exists body_metrics_import_uidx
  on public.body_metrics (user_id, source, external_id)
  where external_id is not null;

-- ── 2. Pasos diarios agregados (tabla nueva) ────────────────────────────

create table if not exists public.health_daily_steps (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  source text not null check (source in ('healthkit', 'health_connect')),
  steps integer not null check (steps >= 0 and steps < 200000),
  updated_at timestamptz not null default now(),
  primary key (user_id, date, source)
);
alter table public.health_daily_steps enable row level security;
create policy health_daily_steps_own on public.health_daily_steps
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── 3. Adenda de seguridad (Chat 3) ─────────────────────────────────────
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


-- NIVL: consentimiento independiente para salud y bienestar. No siembra
-- aceptaciones, no borra datos existentes y no modifica cuentas de otro servicio.
begin;

create table public.health_consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('accept','withdraw')),
  version text not null,
  source text not null check (source = 'app'),
  created_at timestamptz not null default clock_timestamp()
);
create index health_consents_user_idx on public.health_consents(user_id,id desc);
create table public.health_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  accepted boolean not null default false,
  version text not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default clock_timestamp()
);
create table public.health_erasure_jobs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  id uuid not null unique default gen_random_uuid(),
  status text not null check (status in ('pending','complete')),
  requested_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz
);
alter table public.health_consents enable row level security;
alter table public.health_state enable row level security;
alter table public.health_erasure_jobs enable row level security;
revoke all on public.health_consents, public.health_state, public.health_erasure_jobs from anon, authenticated;
grant select on public.health_consents, public.health_state, public.health_erasure_jobs to authenticated;
grant select, insert on public.health_consents to service_role;
grant all on public.health_state, public.health_erasure_jobs to service_role;
grant usage, select on sequence public.health_consents_id_seq to service_role;
create policy health_consent_owner on public.health_consents for select to authenticated using(user_id=auth.uid());
create policy health_state_owner on public.health_state for select to authenticated using(user_id=auth.uid());
create policy health_erasure_owner on public.health_erasure_jobs for select to authenticated using(user_id=auth.uid());

create function public.health_consent_version() returns text language sql immutable
set search_path=public as $$ select '2026-09-27-salud-v1'::text $$;

-- Internal predicate is also used by privileged social aggregates for the DATA
-- SUBJECT. No public RPC may probe another person's consent state.
create function public.health_consent_active(p_user uuid) returns boolean language sql volatile security definer
set search_path=public as $$
  select exists(
    select 1 from public.health_state s where s.user_id=p_user and s.accepted
    and s.version=public.health_consent_version()
  ) and not exists(select 1 from public.health_erasure_jobs j where j.user_id=p_user and j.status='pending')
$$;
revoke all on function public.health_consent_active(uuid) from public,anon,authenticated,service_role;
create function public.health_consent_ok(p_user uuid) returns boolean language sql volatile security definer
set search_path=public as $$
  select coalesce((auth.uid()=p_user or auth.role()='service_role') and public.health_consent_active(p_user)
    and (nullif(current_setting('request.headers',true),'')::jsonb->>'x-nivl-health-revision' is null
      or nullif(current_setting('request.headers',true),'')::jsonb->>'x-nivl-health-revision'
        = (select revision::text from public.health_state where user_id=p_user)),false)
$$;
revoke all on function public.health_consent_ok(uuid) from public,anon;
grant execute on function public.health_consent_ok(uuid) to authenticated,service_role;

create function public.my_health_consent() returns jsonb language sql stable security definer
set search_path=public as $$
  select jsonb_build_object('accepted',public.health_consent_ok(auth.uid()),
    'current_version',public.health_consent_version(),
    'version',(select version from public.health_state where user_id=auth.uid()),
    'revision',coalesce((select revision from public.health_state where user_id=auth.uid()),0),
    'erasure_pending',exists(select 1 from public.health_erasure_jobs where user_id=auth.uid() and status='pending'))
$$;

create function public.accept_health_consent(p_version text) returns jsonb language plpgsql security definer
set search_path=public as $$
declare u uuid:=auth.uid();
begin
  if u is null then raise exception 'No autenticado' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,630030));
  if p_version is distinct from public.health_consent_version() then
    return jsonb_build_object('ok',false,'reason','version_obsoleta');
  end if;
  if exists(select 1 from public.health_erasure_jobs where user_id=u and status='pending') then
    return jsonb_build_object('ok',false,'reason','borrado_pendiente');
  end if;
  if not public.health_consent_ok(u) then
    insert into public.health_consents(user_id,action,version,source) values(u,'accept',p_version,'app');
    insert into public.health_state(user_id,accepted,version) values(u,true,p_version)
      on conflict(user_id) do update set accepted=true,version=excluded.version,
        revision=health_state.revision+1,updated_at=clock_timestamp();
  end if;
  return jsonb_build_object('ok',true);
end $$;

create function public.withdraw_health_consent(p_erase boolean default false) returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); j uuid;
begin
  if u is null then raise exception 'No autenticado' using errcode='42501'; end if;
  if p_erase is distinct from true then return jsonb_build_object('ok',false,'reason','confirmar_borrado'); end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,630030));
  insert into public.health_consents(user_id,action,version,source)
    values(u,'withdraw',public.health_consent_version(),'app');
  insert into public.health_state(user_id,accepted,version) values(u,false,public.health_consent_version())
    on conflict(user_id) do update set accepted=false,version=excluded.version,
      revision=health_state.revision+1,updated_at=clock_timestamp();
  if p_erase then
    insert into public.health_erasure_jobs(user_id,status) values(u,'pending')
      on conflict(user_id) do update set status='pending',
        id=case when health_erasure_jobs.status='pending' then health_erasure_jobs.id else gen_random_uuid() end,
        requested_at=clock_timestamp(),completed_at=null returning id into j;
  end if;
  return jsonb_build_object('ok',true,'job_id',j,'erasure_pending',j is not null);
end $$;
revoke all on function public.my_health_consent(),public.accept_health_consent(text),public.withdraw_health_consent(boolean) from public,anon;
grant execute on function public.my_health_consent(),public.accept_health_consent(text),public.withdraw_health_consent(boolean) to authenticated;

-- Deterministic structured health copies. Do not infer medical facts from an
-- arbitrary sentence. Dedicated journals/memory/photos are protected as a whole.
-- General historical rows are PRESERVED. No blanket NULL=>health inference.
-- AI writers set this marker for any mixed row derived from health context.
do $$ declare t text; begin
  foreach t in array array['quests','rules','dungeons','dungeon_tasks','calendar_events','shopping_items','goals','events','letters'] loop
    execute format('alter table public.%I add column health_data boolean not null default false',t);
  end loop;
end $$;
-- Only NEW free text written by AI is marked. Existing financial records and
-- their amounts/categories/accounts are never inferred to contain health.
do $$ declare t text; begin
  foreach t in array array['money_plan','budgets','category_rules','transactions'] loop
    execute format('alter table public.%I add column health_note boolean not null default false',t);
  end loop;
end $$;
alter table public.category_rules add column active boolean not null default true;

create function public.health_event(p_type text,p_payload jsonb) returns boolean language sql immutable
set search_path=public as $$
  select coalesce(p_type ~ '^(weigh_in|gym_|cardio_|nutrition_|meal_|journal_)'
    or p_payload ?| array['weight','weight_kg','mood','energy','sleep_hours','injuries','health_notes','medication','calories','protein_g','heart_rate','kcal','prote']
    or p_payload->>'via'='coach'
    or public.infer_link(coalesce(p_payload->>'quest',p_payload->>'goal',p_payload->>'rule',p_payload->>'dungeon',''))<>'ninguno'
    or public.infer_link(p_payload->>'consequence')<>'ninguno',false)
$$;
create function public.health_row(p_table text,p_row jsonb) returns boolean language sql stable
set search_path=public as $$
  select coalesce((p_row->>'health_data')::boolean,false) or case p_table
    when 'quests' then coalesce(p_row->>'link','ninguno')<>'ninguno' or public.infer_link(p_row->>'title')<>'ninguno'
    when 'rules' then coalesce(p_row->>'link','ninguno')<>'ninguno' or public.infer_link(p_row->>'text')<>'ninguno' or public.infer_link(p_row->>'consequence')<>'ninguno'
    when 'goals' then coalesce(p_row->>'metric_type','libre') <> 'libre'
    when 'events' then public.health_event(p_row->>'type',p_row->'payload')
    when 'dungeons' then false
    when 'calendar_events' then false
    when 'shopping_items' then false
    when 'letters' then false
    when 'money_plan' then coalesce((p_row->>'health_note')::boolean,false)
    when 'budgets' then coalesce((p_row->>'health_note')::boolean,false)
    when 'category_rules' then coalesce((p_row->>'health_note')::boolean,false)
    when 'transactions' then coalesce((p_row->>'health_note')::boolean,false)
    when 'dungeon_tasks' then coalesce((select public.health_row('dungeons',to_jsonb(d)) from public.dungeons d where d.id=(p_row->>'dungeon_id')::uuid and d.user_id=(p_row->>'user_id')::uuid),true)
    when 'completions' then nullif(p_row->>'evidence_url','') is not null or coalesce((select public.health_row('quests',to_jsonb(q)) from public.quests q where q.id=(p_row->>'quest_id')::uuid and q.user_id=(p_row->>'user_id')::uuid),true)
    when 'rule_checks' then coalesce((select public.health_row('rules',to_jsonb(r)) from public.rules r where r.id=(p_row->>'rule_id')::uuid and r.user_id=(p_row->>'user_id')::uuid),true)
    when 'rule_breaks' then coalesce((select public.health_row('rules',to_jsonb(r)) from public.rules r where r.id=(p_row->>'rule_id')::uuid and r.user_id=(p_row->>'user_id')::uuid),true)
    else true end
$$;

-- Generic XP/event APIs must not become an unbounded free-text health store.
-- Health events keep their payload behind the gate. General events retain
-- bounded known game fields (no arbitrary nested data). Explicit general
-- onboarding text is retained; no keyword rule claims semantic completeness.
create function public.general_event_payload(p_payload jsonb) returns jsonb language sql immutable
set search_path=public as $$
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb)
  from jsonb_each(case when jsonb_typeof(p_payload)='object' then p_payload else '{}'::jsonb end)
  where (key in ('xp','pb','level','count','years','dias') and jsonb_typeof(value)='number')
    or (key in ('evidence','boss') and jsonb_typeof(value)='boolean')
    or (key='stat' and (value='null'::jsonb or value #>> '{}' in ('FUE','VIT','INT','AGI','PER')))
    or (key='rank' and value #>> '{}' in ('E','D','C','B','A','S'))
    or (key in ('date','until','open_at') and value #>> '{}' ~ '^\d{4}-\d{2}-\d{2}([T ][0-9:.+Z-]+)?$')
    or (key in ('quest_id','rule_id','dungeon_id','task_id','goal_id') and value #>> '{}' ~ '^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$')
    or (key in ('quest','goal','rule','consequence','dungeon','task','target','deadline','kind','reason')
      and (value='null'::jsonb or (jsonb_typeof(value)='string' and length(value #>> '{}')<=500)))
$$;

create function public.assert_health_write(p_user uuid) returns void language plpgsql security definer
set search_path=public as $$
declare expected text; actual bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,630030));
  if not public.health_consent_ok(p_user) then raise exception 'sin_consentimiento_salud' using errcode='42501'; end if;
  expected:=nullif(current_setting('request.headers',true),'')::jsonb->>'x-nivl-health-revision';
  if expected is not null then
    select revision into actual from public.health_state where user_id=p_user;
    if expected is distinct from actual::text then raise exception 'consentimiento_salud_cambiado' using errcode='42501'; end if;
  end if;
end $$;
revoke all on function public.assert_health_write(uuid) from public,anon,authenticated,service_role;

create function public.require_health_write() returns trigger language plpgsql security definer
set search_path=public as $$
declare u uuid:=new.user_id; is_health boolean; parent_table text; parent_key text; parent_owned boolean;
begin
  -- Deleting the account remains available after withdrawal. Cascades may
  -- clear nullable references while auth.users is already gone; no new data
  -- can survive that transaction (all owner FKs cascade from auth.users).
  if pg_trigger_depth()>1 and not exists(select 1 from auth.users where id=u) then return new; end if;
  if tg_op='UPDATE' then
    if new.user_id is distinct from old.user_id then raise exception 'No se puede cambiar el titular' using errcode='42501'; end if;
    -- Narrow redaction-only escape for the service erasure RPC after an
    -- explicitly requested pending job. Every economic field must be identical.
    if tg_table_name in ('money_plan','budgets','transactions','category_rules') then
      if auth.role()='service_role' and old.health_note and not new.health_note
        and exists(select 1 from public.health_erasure_jobs where user_id=u and status='pending') then
        if tg_table_name in ('money_plan','budgets') then
          if new.rationale is null and (to_jsonb(new)-array['rationale','health_note'])=(to_jsonb(old)-array['rationale','health_note']) then return new; end if;
        elsif tg_table_name='transactions' then
          if new.description='Descripción retirada' and (to_jsonb(new)-array['description','health_note'])=(to_jsonb(old)-array['description','health_note']) then return new; end if;
        elsif tg_table_name='category_rules' then
          if not new.active and new.pattern='__nivl_removed_'||new.id::text
            and (to_jsonb(new)-array['pattern','active','health_note'])=(to_jsonb(old)-array['pattern','active','health_note']) then return new; end if;
        end if;
      end if;
    end if;
    if tg_table_name='completions' then
      if auth.role()='service_role' and new.evidence_url is null
        and (to_jsonb(new)-'evidence_url')=(to_jsonb(old)-'evidence_url')
        and exists(select 1 from public.health_erasure_jobs where user_id=u and status='pending') then return new; end if;
    end if;
  end if;
  -- RLS on a child alone does not enforce ownership of its referenced parent.
  select x.t,x.k into parent_table,parent_key from (values
    ('completions','quests','quest_id'),('quest_photos','quests','quest_id'),
    ('rule_checks','rules','rule_id'),('rule_breaks','rules','rule_id'),
    ('dungeon_tasks','dungeons','dungeon_id'),('gym_exercises','gym_days','gym_day_id'),
    ('gym_sessions','gym_days','gym_day_id'),('gym_lifts','gym_sessions','session_id'),
    ('day_blocks','day_plans','plan_id'),('coach_messages','coach_threads','thread_id')
  ) x(child,t,k) where x.child=tg_table_name;
  if parent_table is not null and to_jsonb(new)->>parent_key is not null then
    execute format('select exists(select 1 from public.%I where id=$1 and user_id=$2)',parent_table)
      into parent_owned using (to_jsonb(new)->>parent_key)::uuid,u;
    if not parent_owned then raise exception 'Referencia ajena' using errcode='42501'; end if;
  end if;
  if tg_table_name='events' then
    -- Old client APIs pass titles rather than IDs. Preserve known provenance
    -- when they copy a health-tagged mission, rule, campaign or goal.
    if exists(select 1 from public.quests q where q.user_id=u and q.title=new.payload->>'quest' and public.health_row('quests',to_jsonb(q)))
      or exists(select 1 from public.rules r where r.user_id=u and r.text=new.payload->>'rule' and public.health_row('rules',to_jsonb(r)))
      or exists(select 1 from public.dungeons d where d.user_id=u and d.title=new.payload->>'dungeon' and public.health_row('dungeons',to_jsonb(d)))
      or exists(select 1 from public.goals g where g.user_id=u and g.title=new.payload->>'goal' and public.health_row('goals',to_jsonb(g))) then new.health_data:=true; end if;
  end if;
  is_health:=public.health_row(tg_table_name,to_jsonb(new));
  if tg_op='UPDATE' then is_health:=is_health or public.health_row(tg_table_name,to_jsonb(old)); end if;
  if is_health then
    perform public.assert_health_write(u);
    -- A health-derived record cannot be laundered by clearing its marker.
    if to_jsonb(new) ? 'health_data' then new:=jsonb_populate_record(new,jsonb_build_object('health_data',true)); end if;
    if to_jsonb(new) ? 'health_note' then new:=jsonb_populate_record(new,jsonb_build_object('health_note',true)); end if;
  end if;
  if tg_table_name='events' then
    if not is_health then
      if new.type not in ('quest_completed','bonus_earned','habit_acquired','dungeon_task','dungeon_cleared','goal_achieved','rule_broken','penalty','stone_used','stone_earned','streak_lost','level_up','freeze_on','freeze_off','commitment_signed','onboarding_goal') then
        perform public.assert_health_write(u);
        new.health_data:=true;
      else new.payload:=public.general_event_payload(new.payload);
      end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.require_health_write() from public,anon,authenticated;

do $$
declare t text;
begin
  foreach t in array array['body_profile','body_metrics','gym_days','gym_exercises','gym_sessions','gym_lifts',
    'cardio_sessions','nutrition_targets','nutrition_logs','training_prescriptions','meal_slots',
    'journal_entries','journal_photos','quest_photos','coach_threads','coach_messages','coach_facts',
    'coach_dossier','recaps','day_plans','day_blocks','goals','events','completions',
    'quests','rules','rule_checks','rule_breaks','dungeons','dungeon_tasks','calendar_events','shopping_items','letters',
    'money_plan','budgets','category_rules','transactions'] loop
    execute format('create policy health_permission on public.%I as restrictive for all to authenticated using (not public.health_row(%L,to_jsonb(%I)) or public.health_consent_ok(auth.uid())) with check (not public.health_row(%L,to_jsonb(%I)) or public.health_consent_ok(auth.uid()))',t,t,t,t,t);
    execute format('create trigger health_write before insert or update on public.%I for each row execute function public.require_health_write()',t);
  end loop;
end $$;
-- Older clients also stop seeing a neutralized automatic rule. Privileged
-- importers additionally filter active=true, since service_role bypasses RLS.
create policy category_rule_active on public.category_rules as restrictive for select to authenticated using(active);

-- Photos and evidence can contain health and historically lack a reliable tag.
-- Keep avatars independent. Existing signed URLs expire; no promise of instant
-- revocation is made. The erasure endpoint deletes the actual Storage objects.
create policy health_evidence_permission on storage.objects as restrictive for all to authenticated
  using(bucket_id <> 'evidence' or public.health_consent_ok(auth.uid()))
  with check(bucket_id <> 'evidence' or public.health_consent_ok(auth.uid()));

-- Rights path: explicit owner-only export, including isolated data, never a
-- general-purpose RLS bypass. The allowlist and predicate cannot be supplied.
create function public.export_my_data() returns jsonb language plpgsql security definer
set search_path=public as $$
declare u uuid:=auth.uid(); t text; rows jsonb; result jsonb:=jsonb_build_object('app','NIVL','version',2,'exported_at',clock_timestamp());
begin
  if u is null then raise exception 'No autenticado' using errcode='42501'; end if;
  foreach t in array array['profiles','quests','completions','events','dungeons','dungeon_tasks','calendar_events',
    'gym_days','gym_exercises','gym_sessions','gym_lifts','meal_slots','shopping_items','journal_entries','achievements',
    'rules','rule_breaks','bonus_redemptions','journal_photos','letters','body_metrics','goals','coach_dossier',
    'coach_facts','coach_threads','coach_messages','day_plans','day_blocks','body_profile','cardio_sessions',
    'nutrition_targets','nutrition_logs','training_prescriptions','money_accounts','transactions','category_rules',
    'budgets','money_plan','quest_photos','recaps','rule_checks','ai_consents','health_consents','health_state','health_erasure_jobs'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from public.%I r where %I=$1',
      t,case when t='profiles' then 'id' else 'user_id' end) into rows using u;
    result:=result||jsonb_build_object(t,rows);
  end loop;
  return result;
end $$;
revoke all on function public.export_my_data() from public,anon;
grant execute on function public.export_my_data() to authenticated;

-- General habit facts remain usable for game closing without disclosing photos.
-- Raw completions RLS stays strict; clients use this owner-only projection.
create function public.my_completions(p_from date default null,p_until date default null)
returns setof public.completions language plpgsql stable security definer set search_path=public as $$
declare u uuid:=auth.uid(); allowed boolean; projected public.completions;
begin
  if u is null then raise exception 'No autenticado' using errcode='42501'; end if;
  allowed:=public.health_consent_ok(u);
  for projected in select c.* from public.completions c
    join public.quests q on q.id=c.quest_id and q.user_id=u
    where c.user_id=u and (p_from is null or c.date>=p_from) and (p_until is null or c.date<=p_until)
      and (not public.health_row('quests',to_jsonb(q)) or allowed)
    order by c.date,c.completed_at loop
    if not allowed then projected.evidence_url:=null; end if;
    return next projected;
  end loop;
end $$;
create function public.my_completion_stats() returns jsonb language plpgsql stable security definer set search_path=public as $$
declare u uuid:=auth.uid(); result jsonb;
begin
  if u is null then raise exception 'No autenticado' using errcode='42501'; end if;
  select jsonb_build_object('total',count(*),'with_evidence',count(*) filter(where c.evidence_url is not null))
    into result from public.completions c join public.quests q on q.id=c.quest_id and q.user_id=u
    where c.user_id=u and (not public.health_row('quests',to_jsonb(q)) or public.health_consent_ok(u));
  return result;
end $$;
revoke all on function public.my_completions(date,date),public.my_completion_stats() from public,anon;
grant execute on function public.my_completions(date,date),public.my_completion_stats() to authenticated;

-- Keep 0017's closing arithmetic byte-for-byte. New clients use sanitized
-- completion facts; old clients cannot persist a false miss from strict RLS.
alter function public.apply_day_close(date,integer,integer,integer,boolean,integer) rename to apply_day_close_safe;
create function public.apply_day_close(
  p_last_day date default null,p_streak integer default null,p_stones integer default null,
  p_penalty_xp integer default 0,p_clear_freeze boolean default false,p_perfect_streak integer default null
) returns public.profiles language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); previous_day date;
begin
  if u is null then raise exception 'No autenticado' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,630030));
  select last_day_processed into previous_day from public.profiles where id=u;
  if not public.health_consent_ok(u) and exists(
    select 1 from public.completions c join public.quests q on q.id=c.quest_id and q.user_id=u
    where c.user_id=u and c.evidence_url is not null and not public.health_row('quests',to_jsonb(q))
      and c.date>coalesce(previous_day,'-infinity'::date) and c.date<=coalesce(p_last_day,current_date)
  ) then raise exception 'Actualiza NIVL para cerrar el día sin datos de salud' using errcode='42501'; end if;
  return public.apply_day_close_safe(p_last_day,p_streak,p_stones,p_penalty_xp,p_clear_freeze,p_perfect_streak);
end $$;
revoke all on function public.apply_day_close(date,integer,integer,integer,boolean,integer) from public,anon;
grant execute on function public.apply_day_close(date,integer,integer,integer,boolean,integer) to authenticated;

create function public.health_erasure_paths(p_job uuid) returns jsonb language plpgsql security definer
set search_path=public as $$
declare u uuid:=auth.uid(); result jsonb;
begin
  if u is null or not exists(select 1 from public.health_erasure_jobs where user_id=u and id=p_job and status='pending') then
    raise exception 'Solicitud de borrado no vigente' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(name),'[]'::jsonb) into result from
    (select name from storage.objects where bucket_id='evidence' and (storage.foldername(name))[1]=u::text order by name limit 100) own;
  return result;
end $$;
revoke all on function public.health_erasure_paths(uuid) from public,anon;
grant execute on function public.health_erasure_paths(uuid) to authenticated;

-- Called ONLY by the health-erasure Edge Function after Storage confirms that
-- the owner's evidence folder is empty. Request creation needs the user's JWT.
create function public.complete_health_erasure(p_user uuid,p_job uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
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
    'quest_photos','journal_entries','coach_messages','coach_threads','coach_facts','coach_dossier','recaps','day_blocks','day_plans'] loop
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
end $$;
revoke all on function public.complete_health_erasure(uuid,uuid) from public,anon,authenticated;
grant execute on function public.complete_health_erasure(uuid,uuid) to service_role;

-- The event record is deliberately separate from consent; no accepted rows are
-- generated for existing accounts. A newly accepted state authorizes future use.
comment on table public.health_consents is 'Explicit app health consent evidence, version 2026-09-27-salud-v1; never inferred from age, IA consent or historical data.';
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
    and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='health_state') then
    alter publication supabase_realtime add table public.health_state;
  end if;
end $$;

-- Preserve the established XP/reward arithmetic; only add consent/provenance.
create or replace function public.complete_quest(
  p_quest_id uuid,
  p_date date,
  p_xp integer,
  p_bonus integer default 0,
  p_apply_stat boolean default true,
  p_evidence_url text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_quest public.quests;
  v_profile public.profiles;
  v_rows integer;
  v_health boolean;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  -- El techo es alto a propósito: una misión de penalización devuelve de una
  -- vez todo el XP perdido durante una ausencia larga (hasta 150 por día
  -- cerrado), así que un mes fuera son 4.500. Acotar esto a un par de miles
  -- rechazaría recuperaciones legítimas.
  if p_xp is null or p_xp < 0 or p_xp > 50000 then
    raise exception 'XP fuera de rango: %', p_xp;
  end if;
  if p_bonus is null or p_bonus < 0 or p_bonus > 100 then
    raise exception 'Puntos Bonus fuera de rango: %', p_bonus;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text,630030));
  select * into v_quest from public.quests where id = p_quest_id and user_id = v_uid;
  if not found then raise exception 'Misión no encontrada'; end if;
  v_health:=public.health_row('quests',to_jsonb(v_quest)) or nullif(p_evidence_url,'') is not null;
  if v_health then perform public.assert_health_write(v_uid); end if;

  insert into public.completions (user_id, quest_id, date, xp_awarded, evidence_url)
    values (v_uid, p_quest_id, p_date, case when v_quest.is_bonus then 0 else p_xp end, p_evidence_url)
    on conflict (user_id, quest_id, date) do nothing;
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    select * into v_profile from public.profiles where id = v_uid;
    return jsonb_build_object('awarded', false, 'profile', to_jsonb(v_profile));
  end if;

  if v_quest.is_bonus then
    -- Regla 6 del cuaderno: las misiones extra pagan Puntos Bonus, no XP.
    update public.profiles set bonus_points = bonus_points + p_bonus
      where id = v_uid returning * into v_profile;
    insert into public.events (user_id, type, health_data, payload)
      values (v_uid, 'bonus_earned', v_health, jsonb_build_object('quest', v_quest.title, 'pb', p_bonus));
  else
    update public.profiles set
      xp_total = greatest(0, xp_total + p_xp),
      xp_fue = xp_fue + case when p_apply_stat and v_quest.stat = 'FUE' then p_xp else 0 end,
      xp_vit = xp_vit + case when p_apply_stat and v_quest.stat = 'VIT' then p_xp else 0 end,
      xp_int = xp_int + case when p_apply_stat and v_quest.stat = 'INT' then p_xp else 0 end,
      xp_agi = xp_agi + case when p_apply_stat and v_quest.stat = 'AGI' then p_xp else 0 end,
      xp_per = xp_per + case when p_apply_stat and v_quest.stat = 'PER' then p_xp else 0 end
    where id = v_uid returning * into v_profile;
    insert into public.events (user_id, type, health_data, payload)
      values (v_uid, 'quest_completed', v_health, jsonb_build_object(
        'quest', v_quest.title, 'xp', p_xp, 'evidence', p_evidence_url is not null));
  end if;

  return jsonb_build_object('awarded', true, 'profile', to_jsonb(v_profile));
end;
$$;

-- Subject-specific health filter; ranking formula is unchanged.
create or replace function public.friends_board(p_days integer default 7)
returns table (
  user_id uuid,
  friendship_id uuid,
  is_me boolean,
  visible boolean,
  name text,
  avatar_url text,
  xp_total integer,
  streak_days integer,
  equipped_title text,
  profile_kind text,
  xp_window integer,
  days_active integer,
  scheduled integer,
  completed integer,
  compliance_pct integer,
  window_days integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_days integer := least(90, greatest(1, coalesce(p_days, 7)));
begin
  if v_uid is null then raise exception 'No autenticado'; end if;

  return query
  with miembros as (
    select v_uid as uid, null::uuid as fid
    union all
    select case when f.requester = v_uid then f.addressee else f.requester end, f.id
    from public.friendships f
    where f.status = 'accepted' and (f.requester = v_uid or f.addressee = v_uid)
  ),
  gente as (
    select
      m.uid,
      m.fid,
      (m.uid = v_uid) as soy_yo,
      (m.uid = v_uid or p.social_visible) as se_ve,
      p.name as nombre,
      p.avatar_url as retrato,
      p.xp_total as xp,
      p.streak_days as racha,
      p.equipped_title as titulo,
      p.profile_kind as tipo,
      z.tz,
      (now() at time zone z.tz)::date as hoy
    from miembros m
    join public.profiles p on p.id = m.uid
    cross join lateral (select public.safe_tz(p.timezone) as tz) z
  ),
  dias as (
    select g.uid, g.tz, g.hoy, (g.hoy - n.i) as dia
    from gente g
    cross join lateral generate_series(0, v_days - 1) as n(i)
    where g.se_ve
  ),
  programadas as (
    select d.uid, d.dia, d.hoy, (c.id is not null) as hecha
    from dias d
    join public.quests q on q.user_id = d.uid
    left join public.completions c
      on c.user_id = d.uid and c.quest_id = q.id and c.date = d.dia
    where q.active
      and (not public.health_row('quests',to_jsonb(q)) or public.health_consent_active(q.user_id))
      and not q.is_penalty
      and not q.is_bonus
      and q.acquired_at is null
      and extract(isodow from d.dia)::integer = any (q.days_of_week)
      and d.dia >= (q.created_at at time zone d.tz)::date
  ),
  cumplimiento as (
    select
      pr.uid,
      count(*) filter (where pr.dia < pr.hoy or pr.hecha)::integer as n_programadas,
      count(*) filter (where pr.hecha)::integer as n_completadas
    from programadas pr
    group by pr.uid
  ),
  ganado as (
    select
      g.uid,
      coalesce(sum(least(c.xp_awarded, 500)), 0)::integer as xp_ventana,
      count(distinct c.date)::integer as dias_activos
    from gente g
    join public.completions c
      on c.user_id = g.uid and c.date > g.hoy - v_days and c.date <= g.hoy
    join public.quests q on q.id = c.quest_id and not q.is_penalty
    where g.se_ve
      and (not public.health_row('quests',to_jsonb(q)) or public.health_consent_active(q.user_id))
    group by g.uid
  )
  select
    g.uid,
    g.fid,
    g.soy_yo,
    g.se_ve,
    left(g.nombre, 40),
    -- Solo una ruta dentro de SU carpeta. avatar_url es texto que edita su
    -- dueño: no se reparte a los amigos cualquier cadena que alguien escriba.
    case when g.se_ve and g.retrato like g.uid::text || '/%' then g.retrato end,
    case when g.se_ve then g.xp end,
    case when g.se_ve then g.racha end,
    case when g.se_ve then left(g.titulo, 60) end,
    case when g.se_ve then g.tipo end,
    case when g.se_ve then coalesce(ga.xp_ventana, 0) end,
    case when g.se_ve then coalesce(ga.dias_activos, 0) end,
    case when g.se_ve then coalesce(cu.n_programadas, 0) end,
    case when g.se_ve then coalesce(cu.n_completadas, 0) end,
    case
      when g.se_ve and coalesce(cu.n_programadas, 0) > 0
        then round(100.0 * cu.n_completadas / cu.n_programadas)::integer
    end,
    v_days
  from gente g
  left join cumplimiento cu on cu.uid = g.uid
  left join ganado ga on ga.uid = g.uid;
end;
$$;

-- Subject-specific health filter; ranking formula is unchanged.
create or replace function public.elite_group_board(p_days integer default 7)
returns table (
  user_id uuid,
  friendship_id uuid,
  is_me boolean,
  visible boolean,
  name text,
  avatar_url text,
  xp_total integer,
  streak_days integer,
  equipped_title text,
  profile_kind text,
  xp_window integer,
  days_active integer,
  scheduled integer,
  completed integer,
  compliance_pct integer,
  window_days integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_days integer := least(90, greatest(1, coalesce(p_days, 7)));
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if public.user_tier(v_uid) not in ('elite', 'owner') then return; end if;

  return query
  with miembros as (
    select m2.user_id as uid, null::uuid as fid
    from public.elite_group_members m1
    join public.elite_group_members m2 on m2.group_id = m1.group_id
    where m1.user_id = v_uid
  ),
  gente as (
    select
      m.uid,
      m.fid,
      (m.uid = v_uid) as soy_yo,
      (m.uid = v_uid or p.social_visible) as se_ve,
      p.name as nombre,
      p.avatar_url as retrato,
      p.xp_total as xp,
      p.streak_days as racha,
      p.equipped_title as titulo,
      p.profile_kind as tipo,
      z.tz,
      (now() at time zone z.tz)::date as hoy
    from miembros m
    join public.profiles p on p.id = m.uid
    cross join lateral (select public.safe_tz(p.timezone) as tz) z
  ),
  dias as (
    select g.uid, g.tz, g.hoy, (g.hoy - n.i) as dia
    from gente g
    cross join lateral generate_series(0, v_days - 1) as n(i)
    where g.se_ve
  ),
  programadas as (
    select d.uid, d.dia, d.hoy, (c.id is not null) as hecha
    from dias d
    join public.quests q on q.user_id = d.uid
    left join public.completions c
      on c.user_id = d.uid and c.quest_id = q.id and c.date = d.dia
    where q.active
      and (not public.health_row('quests',to_jsonb(q)) or public.health_consent_active(q.user_id))
      and not q.is_penalty
      and not q.is_bonus
      and q.acquired_at is null
      and extract(isodow from d.dia)::integer = any (q.days_of_week)
      and d.dia >= (q.created_at at time zone d.tz)::date
  ),
  cumplimiento as (
    select
      pr.uid,
      count(*) filter (where pr.dia < pr.hoy or pr.hecha)::integer as n_programadas,
      count(*) filter (where pr.hecha)::integer as n_completadas
    from programadas pr
    group by pr.uid
  ),
  ganado as (
    select
      g.uid,
      coalesce(sum(least(c.xp_awarded, 500)), 0)::integer as xp_ventana,
      count(distinct c.date)::integer as dias_activos
    from gente g
    join public.completions c
      on c.user_id = g.uid and c.date > g.hoy - v_days and c.date <= g.hoy
    join public.quests q on q.id = c.quest_id and not q.is_penalty
    where g.se_ve
      and (not public.health_row('quests',to_jsonb(q)) or public.health_consent_active(q.user_id))
    group by g.uid
  )
  select
    g.uid,
    g.fid,
    g.soy_yo,
    g.se_ve,
    left(g.nombre, 40),
    -- Solo una ruta dentro de SU carpeta. La política de storage NO se amplía:
    -- la cara de un compañero que no es tu amigo no se firma y la app cae a
    -- su inicial.
    case when g.se_ve and g.retrato like g.uid::text || '/%' then g.retrato end,
    case when g.se_ve then g.xp end,
    case when g.se_ve then g.racha end,
    case when g.se_ve then left(g.titulo, 60) end,
    case when g.se_ve then g.tipo end,
    case when g.se_ve then coalesce(ga.xp_ventana, 0) end,
    case when g.se_ve then coalesce(ga.dias_activos, 0) end,
    case when g.se_ve then coalesce(cu.n_programadas, 0) end,
    case when g.se_ve then coalesce(cu.n_completadas, 0) end,
    case
      when g.se_ve and coalesce(cu.n_programadas, 0) > 0
        then round(100.0 * cu.n_completadas / cu.n_programadas)::integer
    end,
    v_days
  from gente g
  left join cumplimiento cu on cu.uid = g.uid
  left join ganado ga on ga.uid = g.uid;
end;
$$;


create or replace function public.award_xp(
  p_amount integer,
  p_stat text default null,
  p_event text default null,
  p_payload jsonb default '{}'::jsonb
) returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if p_amount is null then raise exception 'Cantidad inválida'; end if;
  -- Tope por llamada: un bug o una IA desbocada no pueden inflar el nivel.
  if abs(p_amount) > 2000 then
    raise exception 'Delta de XP fuera de rango: %', p_amount;
  end if;
  if p_stat is not null and p_stat not in ('FUE', 'VIT', 'INT', 'AGI', 'PER') then
    raise exception 'Stat inválida: %', p_stat;
  end if;

  -- Same user lock order as complete_quest; event trigger enforces consent
  -- before any health payload can commit, atomically with this unchanged XP.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text,630030));
  update public.profiles set
    xp_total = greatest(0, xp_total + p_amount),
    xp_fue = greatest(0, xp_fue + case when p_stat = 'FUE' then p_amount else 0 end),
    xp_vit = greatest(0, xp_vit + case when p_stat = 'VIT' then p_amount else 0 end),
    xp_int = greatest(0, xp_int + case when p_stat = 'INT' then p_amount else 0 end),
    xp_agi = greatest(0, xp_agi + case when p_stat = 'AGI' then p_amount else 0 end),
    xp_per = greatest(0, xp_per + case when p_stat = 'PER' then p_amount else 0 end)
  where id = v_uid
  returning * into v_profile;

  if not found then raise exception 'Perfil no encontrado'; end if;

  if p_event is not null then
    insert into public.events (user_id, type, payload)
      values (v_uid, p_event,
        coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('xp', p_amount, 'stat', p_stat));
  end if;

  return v_profile;
end;
$$;

commit;

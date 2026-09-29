-- NIVL only: erase Storage bytes first, Auth last. No cross-service operation.
-- Deployment order: this migration, account-erasure Edge Function, new client.
begin;

create table public.account_erasure_jobs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  id uuid not null unique default gen_random_uuid(),
  requested_at timestamptz not null default clock_timestamp()
);
alter table public.account_erasure_jobs enable row level security;
revoke all on public.account_erasure_jobs from public, anon, authenticated, service_role;
grant select on public.account_erasure_jobs to service_role;

-- Internal predicate: never expose another user's pending deletion to clients.
create function public.account_erasure_pending(p_user uuid) returns boolean
language sql volatile security definer set search_path=public as $$
  select exists(select 1 from public.account_erasure_jobs where user_id=p_user)
$$;
revoke all on function public.account_erasure_pending(uuid) from public,anon,authenticated,service_role;

create function public.begin_account_erasure(p_user uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare job uuid;
begin
  if auth.role() is distinct from 'service_role' or p_user is null then
    raise exception 'No autorizado' using errcode='42501';
  end if;
  -- Same lock as health writes: in-flight writes finish before the job commits;
  -- every subsequent write sees the job. Repeated requests keep the same ID.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,630030));
  if not exists(select 1 from auth.users where id=p_user) then
    raise exception 'Cuenta inexistente' using errcode='42501';
  end if;
  insert into public.account_erasure_jobs(user_id) values(p_user)
    on conflict(user_id) do nothing;
  select id into job from public.account_erasure_jobs where user_id=p_user;
  return jsonb_build_object('ok',true,'job_id',job);
end $$;

create function public.account_erasure_paths(p_user uuid,p_job uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  if auth.role() is distinct from 'service_role' or not exists(
    select 1 from public.account_erasure_jobs where user_id=p_user and id=p_job
  ) then raise exception 'No autorizado' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('bucket',bucket_id,'path',name)),'[]'::jsonb)
    into result from (
      select bucket_id,name from storage.objects
      where bucket_id in ('evidence','avatars') and (storage.foldername(name))[1]=p_user::text
      order by bucket_id,name limit 100
    ) owned;
  return result;
end $$;

create function public.account_erasure_ready(p_user uuid,p_job uuid) returns boolean
language plpgsql security definer set search_path=public as $$
begin
  if auth.role() is distinct from 'service_role' or not exists(
    select 1 from public.account_erasure_jobs where user_id=p_user and id=p_job
  ) then raise exception 'No autorizado' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,630030));
  return not exists(select 1 from storage.objects
    where bucket_id in ('evidence','avatars') and (storage.foldername(name))[1]=p_user::text);
end $$;

revoke all on function public.begin_account_erasure(uuid),public.account_erasure_paths(uuid,uuid),public.account_erasure_ready(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.begin_account_erasure(uuid),public.account_erasure_paths(uuid,uuid),public.account_erasure_ready(uuid,uuid)
  to service_role;

-- Guards apply to privileged cron/tool writes too; RLS alone would not do that.
-- No DELETE trigger: the Storage API and Auth cascades must remain possible.
create function public.require_account_active() returns trigger
language plpgsql security definer set search_path=public as $$
declare u uuid := (to_jsonb(new)->>tg_argv[0])::uuid; previous uuid;
begin
  if tg_op='UPDATE' then previous := (to_jsonb(old)->>tg_argv[0])::uuid; end if;
  -- FK SET NULL cascades on retained accounting rows follow Auth deletion.
  if pg_trigger_depth()>1 and not exists(select 1 from auth.users where id=coalesce(u,previous)) then return new; end if;
  if u is not null then
    perform pg_advisory_xact_lock(hashtextextended(u::text,630030));
    if public.account_erasure_pending(u) then raise exception 'borrado_cuenta_pendiente' using errcode='42501'; end if;
  end if;
  if previous is not null and previous is distinct from u then
    perform pg_advisory_xact_lock(hashtextextended(previous::text,630030));
    if public.account_erasure_pending(previous) then raise exception 'borrado_cuenta_pendiente' using errcode='42501'; end if;
  end if;
  return new;
end $$;
revoke all on function public.require_account_active() from public,anon,authenticated,service_role;
do $$ declare t record; begin
  for t in select c.table_name from information_schema.columns c
    join information_schema.tables x on x.table_schema=c.table_schema and x.table_name=c.table_name and x.table_type='BASE TABLE'
    where c.table_schema='public' and c.column_name='user_id' and c.udt_name='uuid' and c.table_name<>'account_erasure_jobs'
  loop
    execute format('create trigger account_write_guard before insert or update on public.%I for each row execute function public.require_account_active(%L)',t.table_name,'user_id');
  end loop;
end $$;
create trigger account_write_guard before insert or update on public.profiles
  for each row execute function public.require_account_active('id');

create function public.require_account_storage_active() returns trigger
language plpgsql security definer set search_path=public as $$
declare subject text; u uuid;
begin
  if new.bucket_id in ('evidence','avatars') then
    subject := (storage.foldername(new.name))[1];
    if subject ~* '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$' then
      u := subject::uuid;
      perform pg_advisory_xact_lock(hashtextextended(u::text,630030));
      -- Deleting Auth does not instantly invalidate existing access tokens.
      -- Do not let an old JWT/signed upload recreate files after job cascades.
      if not exists(select 1 from auth.users where id=u) then raise exception 'Cuenta inexistente' using errcode='42501'; end if;
      if public.account_erasure_pending(u) then raise exception 'borrado_cuenta_pendiente' using errcode='42501'; end if;
    end if;
  end if;
  if tg_op='UPDATE' and old.bucket_id in ('evidence','avatars') then
    subject := (storage.foldername(old.name))[1];
    if subject ~* '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$' then
      u := subject::uuid;
      perform pg_advisory_xact_lock(hashtextextended(u::text,630030));
      if not exists(select 1 from auth.users where id=u) then raise exception 'Cuenta inexistente' using errcode='42501'; end if;
      if public.account_erasure_pending(u) then raise exception 'borrado_cuenta_pendiente' using errcode='42501'; end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.require_account_storage_active() from public,anon,authenticated,service_role;
create trigger account_upload_guard before insert or update on storage.objects
  for each row execute function public.require_account_storage_active();

-- Every existing provider caller (including cron) already checks these guards.
create or replace function public.ai_consent_ok(p_user uuid) returns boolean
language sql volatile security definer set search_path=public as $$
  select not public.account_erasure_pending(p_user) and coalesce((
    select c.action='accept' and c.source='app' and c.version=public.ai_consent_version()
    from public.ai_consents c where c.user_id=p_user
    order by c.created_at desc,c.id desc limit 1
  ),false)
$$;
revoke all on function public.ai_consent_ok(uuid) from public,anon,authenticated;
grant execute on function public.ai_consent_ok(uuid) to service_role;

create or replace function public.health_consent_active(p_user uuid) returns boolean
language sql volatile security definer set search_path=public as $$
  select not public.account_erasure_pending(p_user) and exists(
    select 1 from public.health_state s where s.user_id=p_user and s.accepted and s.version=public.health_consent_version()
  ) and not exists(select 1 from public.health_erasure_jobs j where j.user_id=p_user and j.status='pending')
$$;
revoke all on function public.health_consent_active(uuid) from public,anon,authenticated,service_role;

-- Old binaries must not claim success after deleting only Storage metadata.
-- Keep the signature, but fail safely until they receive the updated client.
create or replace function public.delete_own_account() returns void
language plpgsql security definer set search_path=public as $$
begin
  raise exception 'Actualiza NIVL para eliminar la cuenta y todas sus fotos.' using errcode='42501';
end $$;
revoke all on function public.delete_own_account() from public,anon,service_role;
grant execute on function public.delete_own_account() to authenticated;

commit;

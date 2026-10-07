-- Late store events must not recreate identities erased from Auth.
-- Event IDs and accounting metadata stay available for idempotency.
begin;

create or replace function public.store_event_has_unknown_identity(p_event jsonb)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from (
      select p_event->>'app_user_id' as identity
      union all select p_event->>'original_app_user_id'
      union all select jsonb_array_elements_text(
        case when jsonb_typeof(p_event->'aliases') = 'array' then p_event->'aliases' else '[]'::jsonb end)
      union all select jsonb_array_elements_text(
        case when jsonb_typeof(p_event->'transferred_from') = 'array' then p_event->'transferred_from' else '[]'::jsonb end)
      union all select jsonb_array_elements_text(
        case when jsonb_typeof(p_event->'transferred_to') = 'array' then p_event->'transferred_to' else '[]'::jsonb end)
    ) candidates
    where identity ~* '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      and not exists (
        select 1 from auth.users u
        where u.id = case
          when identity ~* '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$' then identity::uuid
          else null end
      )
  )
$$;
revoke all on function public.store_event_has_unknown_identity(jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.store_events_redact_unknown() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.store_event_has_unknown_identity(
    new.payload
  ) or public.store_event_has_unknown_identity(jsonb_build_object('app_user_id', new.app_user_id)) then
    new.payload := jsonb_build_object('id', new.id, 'type', new.type, 'redacted', true);
    new.app_user_id := null;
    new.note := 'redactado por borrado';
  end if;
  return new;
end $$;
revoke all on function public.store_events_redact_unknown() from public, anon, authenticated;

drop trigger if exists store_events_redact_unknown on public.store_events;
create trigger store_events_redact_unknown before insert or update on public.store_events
  for each row execute function public.store_events_redact_unknown();

-- Also remove identities that slipped through the old app_user_id-only guard.
update public.store_events e
set payload = jsonb_build_object('id', e.id, 'type', e.type, 'redacted', true),
    app_user_id = null,
    note = 'redactado por borrado'
where public.store_event_has_unknown_identity(
  e.payload
) or public.store_event_has_unknown_identity(jsonb_build_object('app_user_id', e.app_user_id));

-- Server-only guard for provider calls: a deleted/pending account is inactive.
create or replace function public.store_account_active(p_user uuid) returns boolean
language sql volatile security definer set search_path = public as $$
  select p_user is not null
    and exists(select 1 from auth.users where id = p_user)
    and not public.account_erasure_pending(p_user)
$$;
revoke all on function public.store_account_active(uuid) from public, anon, authenticated, service_role;
grant execute on function public.store_account_active(uuid) to service_role;
comment on function public.store_account_active(uuid) is 'nivl:store-late-identities-0063';
commit;

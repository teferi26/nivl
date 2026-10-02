-- NIVL · restore an existing purchase even after the old NIVL account was erased.
-- Additive only: existing event bookkeeping and commission rules remain in
-- apply_store_event (0027). The wrapper applies its result and the fresh
-- RevenueCat snapshot in ONE transaction. No store transaction is fabricated.

alter table public.subscriptions add column if not exists store_environment text
  check (store_environment in ('SANDBOX', 'PRODUCTION'));

create table if not exists public.store_reconciliation (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0,
  requested_at timestamptz not null,
  snapshot_at timestamptz
);
alter table public.store_reconciliation enable row level security;
revoke all on public.store_reconciliation from public, anon, authenticated;

create or replace function public.begin_store_reconciliation(p_users uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_revision bigint; v_result jsonb := '[]'::jsonb;
begin
  if coalesce(cardinality(p_users), 0) > 20 then raise exception 'Too many store identities'; end if;
  -- Stable row lock order prevents transfer deadlocks. Deleted users are
  -- deliberately omitted; restoration must not recreate an erased account.
  for v_user in select id from auth.users where id = any(p_users)
    and not public.account_erasure_pending(id) order by id for key share loop
    insert into public.store_reconciliation(user_id, revision, requested_at)
    values(v_user, 1, clock_timestamp())
    on conflict(user_id) do update set revision = store_reconciliation.revision + 1, requested_at = clock_timestamp()
    returning revision into v_revision;
    v_result := v_result || jsonb_build_array(jsonb_build_object('user_id', v_user, 'revision', v_revision));
  end loop;
  return v_result;
end;
$$;

create or replace function public.apply_store_reconciliation(p_snapshots jsonb, p_event jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_snapshot jsonb; v_entry jsonb; v_user uuid; v_requested timestamptz;
  v_state public.store_reconciliation; v_old public.subscriptions;
  v_product public.store_products; v_best jsonb; v_best_tier text;
  v_original text; v_candidate text; v_required uuid[] := '{}'::uuid[];
  v_before jsonb; v_event_user uuid;
begin
  if p_snapshots is null or jsonb_typeof(p_snapshots) <> 'array' or jsonb_array_length(p_snapshots) > 20 then
    raise exception 'Invalid store snapshots';
  end if;
  if (select count(*) from jsonb_array_elements(p_snapshots)) <>
     (select count(distinct value->>'user_id') from jsonb_array_elements(p_snapshots)) then
    raise exception 'Duplicate store identity';
  end if;
  -- All row locks and freshness checks precede any entitlement/event mutation.
  for v_snapshot in select value from jsonb_array_elements(p_snapshots) order by value->>'user_id' loop
    v_user := (v_snapshot->>'user_id')::uuid;
    if public.account_erasure_pending(v_user) then
      return jsonb_build_object('ok', false, 'pending', true);
    end if;
    select * into v_state from public.store_reconciliation where user_id = v_user for update;
    if not found or v_state.revision is distinct from (v_snapshot->>'revision')::bigint then
      return jsonb_build_object('ok', false, 'pending', true);
    end if;
    if jsonb_typeof(v_snapshot->'requested_ms') is distinct from 'number'
       or jsonb_typeof(v_snapshot->'subscriptions') is distinct from 'array' then raise exception 'Malformed store snapshot'; end if;
    v_requested := to_timestamp((v_snapshot->>'requested_ms')::numeric / 1000);
    if v_requested < clock_timestamp() - interval '2 minutes'
       or v_requested > clock_timestamp() + interval '1 minute'
       or v_requested < v_state.requested_at - interval '1 minute'
       or v_requested < v_state.snapshot_at then
      return jsonb_build_object('ok', false, 'pending', true);
    end if;
    if p_event is not null and p_event->>'event_timestamp_ms' is not null
       and (v_snapshot->>'requested_ms')::numeric < (p_event->>'event_timestamp_ms')::numeric then
      return jsonb_build_object('ok', false, 'pending', true);
    end if;
  end loop;

  if p_event is not null then
    if nullif(p_event->>'id', '') is null then raise exception 'Invalid store event'; end if;
    -- Every surviving source/destination must be verified, not just the first.
    for v_candidate in
      select x from jsonb_array_elements_text(
        case when p_event->>'type' = 'TRANSFER' then
          coalesce(p_event->'transferred_from', '[]'::jsonb) || coalesce(p_event->'transferred_to', '[]'::jsonb)
        else jsonb_build_array(p_event->>'app_user_id', p_event->>'original_app_user_id') || coalesce(p_event->'aliases', '[]'::jsonb) end
      ) a(x)
    loop
      if v_candidate ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        if exists(select 1 from auth.users where id = v_candidate::uuid) then
          v_required := array_append(v_required, v_candidate::uuid);
        end if;
      end if;
    end loop;
    if exists(select 1 from unnest(v_required) r(uid) where not exists(
      select 1 from jsonb_array_elements(p_snapshots) s where (s->>'user_id')::uuid = r.uid
    )) then raise exception 'Incomplete store event snapshot'; end if;
  end if;

  -- Preserve manual plans when a snapshot has no native purchase. The legacy
  -- event can momentarily update a row, but no such intermediate state commits.
  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) into v_before from public.subscriptions s
    where s.user_id in (select (value->>'user_id')::uuid from jsonb_array_elements(p_snapshots));
  if p_event is not null then
    perform public.apply_store_event(p_event);
    v_event_user := public.store_event_user(p_event);
  end if;

  for v_snapshot in select value from jsonb_array_elements(p_snapshots) order by value->>'user_id' loop
    v_user := (v_snapshot->>'user_id')::uuid;
    v_requested := to_timestamp((v_snapshot->>'requested_ms')::numeric / 1000);
    select * into v_old from jsonb_populate_recordset(null::public.subscriptions, v_before) where user_id = v_user;
    v_best := null; v_best_tier := null;
    for v_entry in select value from jsonb_array_elements(v_snapshot->'subscriptions') loop
      if coalesce(v_entry->>'provider', '') not in ('apple', 'google')
         or coalesce(v_entry->>'environment', '') not in ('SANDBOX', 'PRODUCTION')
         or jsonb_typeof(v_entry->'trial') is distinct from 'boolean'
         or jsonb_typeof(v_entry->'refunded') is distinct from 'boolean'
         or nullif(v_entry->>'expires_at', '') is null then raise exception 'Invalid store entitlement'; end if;
      select * into v_product from public.store_products where product_id = v_entry->>'product_id';
      if not found then continue; end if;
      if (v_entry->>'refunded')::boolean or (v_entry->>'expires_at')::timestamptz <= clock_timestamp() then continue; end if;
      -- Production wins over accelerated sandbox; then strongest active tier.
      if v_best is null
         or (v_best->>'environment' = 'SANDBOX' and v_entry->>'environment' = 'PRODUCTION')
         or (v_best->>'environment' = v_entry->>'environment' and (
           (v_best_tier = 'pro' and v_product.tier = 'elite') or
           (v_best_tier = v_product.tier and (v_entry->>'expires_at')::timestamptz > (v_best->>'expires_at')::timestamptz))) then
        v_best := v_entry; v_best_tier := v_product.tier;
      end if;
    end loop;
    if v_old.plan = 'owner' or (v_best is null and v_old.provider not in ('apple', 'google')) then
      update public.subscriptions set status = v_old.status, plan = v_old.plan, provider = v_old.provider,
        current_period_end = v_old.current_period_end, store_product_id = v_old.store_product_id,
        original_transaction_id = v_old.original_transaction_id, store_environment = v_old.store_environment,
        updated_at = v_old.updated_at where user_id = v_user;
    elsif v_best is null then
      update public.subscriptions set status = 'canceled', current_period_end = least(current_period_end, clock_timestamp()), updated_at = clock_timestamp()
      where user_id = v_user and provider in ('apple', 'google') and plan <> 'owner';
    else
      select * into v_product from public.store_products where product_id = v_best->>'product_id';
      v_original := case when v_old.store_product_id = v_product.product_id and v_old.provider = v_best->>'provider'
        and v_old.store_environment = v_best->>'environment' then v_old.original_transaction_id else null end;
      -- Only a verified webhook provides the original chain identifier.
      -- Customer Info's store_transaction_id is NOT that identifier.
      if v_event_user = v_user and split_part(p_event->>'product_id', ':', 1) = v_product.product_id
         and p_event->>'environment' = v_best->>'environment' then
        v_original := coalesce(nullif(p_event->>'original_transaction_id', ''), v_original);
      end if;
      insert into public.subscriptions(user_id, status, plan, provider, current_period_end, store_product_id,
        original_transaction_id, store_environment, updated_at)
      values(v_user, case when (v_best->>'trial')::boolean then 'trialing' else 'active' end,
        case when (v_best->>'trial')::boolean then 'cortesia' else v_product.plan end,
        v_best->>'provider', (v_best->>'expires_at')::timestamptz, v_product.product_id,
        v_original, v_best->>'environment', clock_timestamp())
      on conflict(user_id) do update set status = excluded.status, plan = excluded.plan, provider = excluded.provider,
        current_period_end = excluded.current_period_end, store_product_id = excluded.store_product_id,
        original_transaction_id = excluded.original_transaction_id, store_environment = excluded.store_environment, updated_at = excluded.updated_at
      where public.subscriptions.plan <> 'owner';
    end if;
    update public.store_reconciliation set snapshot_at = v_requested where user_id = v_user;
  end loop;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.begin_store_reconciliation(uuid[]) from public, anon, authenticated;
revoke all on function public.apply_store_reconciliation(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.begin_store_reconciliation(uuid[]) to service_role;
grant execute on function public.apply_store_reconciliation(jsonb, jsonb) to service_role;
notify pgrst, 'reload schema';

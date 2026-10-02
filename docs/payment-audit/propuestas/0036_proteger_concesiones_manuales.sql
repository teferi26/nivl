-- NIVL · 0036 — proteger concesiones manuales/Stripe vigentes frente a compras de tienda.
-- Número asignado por el coordinador el 02/10/2026. Entregado como archivo final en
-- docs/payment-audit/propuestas/; el coordinador lo copia a supabase/migrations/ y
-- añade la huella a scripts/apply-migrations.mjs:
--   '0036': `exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='apply_store_reconciliation' and obj_description(p.oid, 'pg_proc') like '%nivl:store-manual-grants-20261002%')`
--
-- Contrato
--   Re-crea SOLO public.apply_store_reconciliation(jsonb, jsonb) de 0033 con un
--   cambio: si la fila previa es provider manual|stripe, plan distinto de
--   cortesia/owner, status active|trialing y vigente (fin nulo o > ahora - 2 días,
--   la misma gracia que ai_state), la reconciliación la CONSERVA cuando el mejor
--   derecho de tienda es SANDBOX, o es PRODUCTION de tier igual o inferior y la
--   concesión dura al menos lo mismo (fin nulo o >= expiración de la tienda).
--   Una compra real de tier superior (Pro manual → Élite de tienda), o una que dura
--   más que la concesión, sí la sustituye: quien paga nunca queda sin acceso al
--   terminar la concesión esperando al siguiente webhook de renovación.
--   Sin cambios: apply_store_event (0027), ventas/comisiones, store_events,
--   begin_store_reconciliation, permisos (service_role), prioridad producción>sandbox.
-- Compatibilidad con lo desplegado (0033 en producción desde 2026-09-29)
--   create or replace con la misma firma y la misma propiedad/permisos; las
--   revocaciones/grants se repiten. No toca tablas ni datos existentes.
--   Re-ejecutable.
-- Defecto que corrige (docs/payment-audit/SERVIDOR.md, P1-3)
--   Cuenta demo de revisión con Élite manual (DEMO-REVISION.md) compra en
--   sandbox → la fila pasa a provider apple/sandbox → al caducar el sandbox
--   (minutos/días) queda 'canceled' y pierde el Élite manual para siempre.
-- Prueba
--   PGlite 0.5.8 en memoria con 0027 + 0033 reales + este archivo: las 45
--   comprobaciones existentes de scripts/test-store-reconciliation.mjs siguen
--   pasando y los casos nuevos están en el informe (antes FAIL, después PASS).

create or replace function public.apply_store_reconciliation(p_snapshots jsonb, p_event jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_snapshot jsonb; v_entry jsonb; v_user uuid; v_requested timestamptz;
  v_state public.store_reconciliation; v_old public.subscriptions;
  v_product public.store_products; v_best jsonb; v_best_tier text;
  v_original text; v_candidate text; v_required uuid[] := '{}'::uuid[];
  v_before jsonb; v_event_user uuid; v_keep_old boolean;
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
    -- BORRADOR 2026-10-02: an entitled manual grant (App Review demo, comp)
    -- or a live Stripe subscription is not replaced by a SANDBOX purchase, nor
    -- by a production purchase of the same or a lower tier. Before this, the
    -- store row overwrote it and the store expiry then canceled it for good.
    v_keep_old := v_best is not null and v_old.user_id is not null
      and v_old.provider in ('manual', 'stripe') and v_old.plan not in ('cortesia', 'owner')
      and v_old.status in ('active', 'trialing')
      and (v_old.current_period_end is null or v_old.current_period_end > clock_timestamp() - interval '2 days')
      and (v_best->>'environment' = 'SANDBOX'
           -- A real purchase only defers to a grant of the same or a higher tier
           -- that lasts at least as long; otherwise the payer would lose access
           -- when the grant ends and wait for the next renewal webhook.
           or ((case when v_best_tier = 'elite' then 2 else 1 end) <= (case when v_old.plan like 'elite%' then 2 else 1 end)
               and (v_old.current_period_end is null
                    or v_old.current_period_end >= (v_best->>'expires_at')::timestamptz)));
    if v_old.plan = 'owner' or v_keep_old or (v_best is null and v_old.provider not in ('apple', 'google')) then
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

comment on function public.apply_store_reconciliation(jsonb, jsonb) is
  'nivl:store-manual-grants-20261002 — 0036: conserva concesiones manual/Stripe vigentes frente a sandbox y a compras de producción de nivel igual o inferior que no duren más.';
revoke all on function public.apply_store_reconciliation(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.apply_store_reconciliation(jsonb, jsonb) to service_role;
notify pgrst, 'reload schema';

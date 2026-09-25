-- NIVL · 0027 — La tienda: RevenueCat → subscriptions + cobros + comisiones.
--
-- El webhook (supabase/functions/revenuecat-webhook) solo autentica y llama a
-- apply_store_event con el objeto `event` del cuerpo: toda la lógica vive
-- aquí, en una transacción, idempotente por id de evento (RevenueCat reenvía
-- el mismo `id` en cada reintento). El catálogo (store_products) y las
-- funciones de dinero (record_sale, record_refund, net_cents_eur) son de la 0025.
--
-- Nombres de campo contrastados el 2026-09-25 con la documentación vigente:
-- https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
--   · environment: SANDBOX | PRODUCTION · store: APP_STORE, MAC_APP_STORE,
--     PLAY_STORE, STRIPE, TEST_STORE, PROMOTIONAL, RC_BILLING, …
--   · period_type: TRIAL | INTRO | NORMAL | PROMOTIONAL | PREPAID
--   · price (USD) y price_in_purchased_currency: 0 en prueba, NEGATIVOS en
--     reembolso, null si se desconoce.
--   · Reembolso = CANCELLATION con cancel_reason = 'CUSTOMER_SUPPORT'.
--   · PRODUCT_CHANGE es informativo: el cambio real llega como RENEWAL (Apple)
--     o INITIAL_PURCHASE (Google). TRANSFER no trae app_user_id ni producto:
--     trae transferred_from / transferred_to (listas de app user ids).
--
-- Las comisiones SOLO nacen de un cobro real: producción, App Store o Google
-- Play, ni prueba ni precio 0 ni Family Sharing. El sandbox (TestFlight y la
-- revisión de Apple) SÍ da derecho a IA —si no, la revisión no podría probar
-- lo que compra— pero nunca crea ventas.
--
-- Re-ejecutable (if not exists / or replace).

create table if not exists public.store_events (
  id text primary key,
  type text not null,
  app_user_id text,
  environment text,
  payload jsonb not null,
  note text,
  received_at timestamptz not null default now()
);
create index if not exists store_events_user_idx on public.store_events (app_user_id, received_at desc);

-- Solo el servidor: RLS sin políticas y sin privilegios de tabla (como 0025).
alter table public.store_events enable row level security;
revoke all on public.store_events from anon, authenticated;

alter table public.subscriptions
  add column if not exists store_product_id text,
  add column if not exists original_transaction_id text;

-- ── A quién pertenece un evento ─────────────────────────────────────
-- El app_user_id es el uuid de Supabase (Purchases.configure con appUserID en
-- src/lib/pro.ts). Por si una compra llegó antes de identificar al usuario, se
-- mira también original_app_user_id y los alias; un id anónimo
-- ($RCAnonymousID…) nunca se atribuye.
create or replace function public.store_event_user(p_event jsonb)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cand text;
  v_uid uuid;
begin
  for v_cand in
    select x from (
      select p_event->>'app_user_id' as x, 1 as o
      union all select p_event->>'original_app_user_id', 2
      union all select jsonb_array_elements_text(
        case when jsonb_typeof(p_event->'aliases') = 'array' then p_event->'aliases' else '[]'::jsonb end), 3
    ) c
    where x ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    order by o
  loop
    v_uid := v_cand::uuid;
    if exists (select 1 from auth.users where id = v_uid) then return v_uid; end if;
  end loop;
  return null;
end;
$$;

create or replace function public.apply_store_event(p_event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := p_event->>'id';
  v_type text := coalesce(p_event->>'type', '');
  v_env text := coalesce(p_event->>'environment', 'PRODUCTION');
  v_user uuid;
  v_prod public.store_products;
  v_store text := case p_event->>'store'
    when 'APP_STORE' then 'apple' when 'MAC_APP_STORE' then 'apple'
    when 'PLAY_STORE' then 'google' when 'STRIPE' then 'stripe' else 'manual' end;
  v_trial boolean := (p_event->>'period_type') = 'TRIAL';
  v_orig text := p_event->>'original_transaction_id';
  v_price numeric := nullif(p_event->>'price_in_purchased_currency', '')::numeric;
  v_exp timestamptz;
  v_bought timestamptz;
  v_eur numeric;
  v_ins text;
  v_from uuid;
  v_to uuid;
  v_sub public.subscriptions;
begin
  if v_id is null or v_id = '' then
    return jsonb_build_object('ok', false, 'ignored', 'sin_id');
  end if;

  insert into public.store_events (id, type, app_user_id, environment, payload)
  values (v_id, v_type, p_event->>'app_user_id', v_env, p_event)
  on conflict (id) do nothing
  returning id into v_ins;
  if v_ins is null then return jsonb_build_object('ok', true, 'duplicate', true); end if;

  -- ── TRANSFER: "Restaurar compras" con otra cuenta de NIVL ──
  -- La suscripción de tienda pasa de una cuenta a otra. Se mueve la fila de
  -- subscriptions (si la había y era de tienda) y la vieja queda cancelada.
  -- Las ventas y comisiones ya registradas no se tocan.
  if v_type = 'TRANSFER' then
    select s.user_id into v_from
    from jsonb_array_elements_text(coalesce(p_event->'transferred_from', '[]'::jsonb)) f(x)
    -- CASE y no AND: Postgres no garantiza el orden de un AND, y el cast de un
    -- id anónimo fallaría.
    join public.subscriptions s
      on s.user_id = case when f.x ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then f.x::uuid end
    where s.provider in ('apple', 'google') and s.plan <> 'owner'
    limit 1;
    select u.id into v_to
    from jsonb_array_elements_text(coalesce(p_event->'transferred_to', '[]'::jsonb)) t(x)
    join auth.users u
      on u.id = case when t.x ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then t.x::uuid end
    limit 1;
    if v_from is null or v_to is null or v_from = v_to then
      update public.store_events set note = 'transfer sin cuentas de NIVL' where id = v_id;
      return jsonb_build_object('ok', true, 'ignored', 'transfer');
    end if;
    select * into v_sub from public.subscriptions where user_id = v_from;
    insert into public.subscriptions (user_id, status, plan, provider, current_period_end,
      store_product_id, original_transaction_id, updated_at)
    values (v_to, v_sub.status, v_sub.plan, v_sub.provider, v_sub.current_period_end,
      v_sub.store_product_id, v_sub.original_transaction_id, now())
    on conflict (user_id) do update set
      status = excluded.status, plan = excluded.plan, provider = excluded.provider,
      current_period_end = excluded.current_period_end,
      store_product_id = excluded.store_product_id,
      original_transaction_id = excluded.original_transaction_id,
      updated_at = now()
    where public.subscriptions.plan <> 'owner';
    update public.subscriptions set status = 'canceled', updated_at = now()
    where user_id = v_from and plan <> 'owner';
    update public.store_events set note = 'transfer aplicado' where id = v_id;
    return jsonb_build_object('ok', true);
  end if;

  -- El reembolso va antes de buscar al usuario: anula la comisión por
  -- transaction_id aunque la cuenta ya no exista (store_sales.user_id queda a
  -- null al borrarla). Un reembolso de sandbox no encuentra venta: no hace nada.
  if v_type = 'CANCELLATION' and p_event->>'cancel_reason' = 'CUSTOMER_SUPPORT'
     and nullif(p_event->>'transaction_id', '') is not null then
    perform public.record_refund(p_event->>'transaction_id');
  end if;

  v_user := public.store_event_user(p_event);
  if v_user is null then
    update public.store_events set note = 'sin usuario de NIVL (anónimo o desconocido)' where id = v_id;
    return jsonb_build_object('ok', true, 'ignored', 'user');
  end if;

  select * into v_prod from public.store_products where product_id = p_event->>'product_id';
  v_exp := to_timestamp(nullif(p_event->>'expiration_at_ms', '')::bigint / 1000.0);
  v_bought := coalesce(to_timestamp(nullif(p_event->>'purchased_at_ms', '')::bigint / 1000.0), now());

  if v_type in ('INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'SUBSCRIPTION_EXTENDED') then
    if v_prod.product_id is null then
      update public.store_events set note = 'producto fuera del catálogo' where id = v_id;
      return jsonb_build_object('ok', true, 'ignored', 'product');
    end if;

    -- La prueba de tienda es la misma que la de servidor: cortesía en 'trialing'.
    -- Un evento viejo (reintento que llega tarde) no puede acortar un periodo
    -- de tienda ya más largo.
    insert into public.subscriptions (user_id, status, plan, provider, current_period_end,
      store_product_id, original_transaction_id, updated_at)
    values (v_user, case when v_trial then 'trialing' else 'active' end,
      case when v_trial then 'cortesia' else v_prod.plan end, v_store, v_exp,
      v_prod.product_id, v_orig, now())
    on conflict (user_id) do update set
      status = excluded.status, plan = excluded.plan, provider = excluded.provider,
      current_period_end = excluded.current_period_end,
      store_product_id = excluded.store_product_id,
      original_transaction_id = excluded.original_transaction_id,
      updated_at = now()
    where public.subscriptions.plan <> 'owner'
      and not (
        public.subscriptions.provider in ('apple', 'google')
        and public.subscriptions.status in ('active', 'trialing')
        and public.subscriptions.current_period_end is not null
        and excluded.current_period_end is not null
        and excluded.current_period_end < public.subscriptions.current_period_end
      );

    -- Un cobro real es una venta. La conversión de una prueba llega como
    -- RENEWAL y es el primer cobro: record_sale lo cuenta así (payment_number
    -- por original_transaction_id). Un cambio Pro → Élite en Apple también
    -- llega como RENEWAL con el producto nuevo.
    if v_type in ('INITIAL_PURCHASE', 'RENEWAL')
       and v_env = 'PRODUCTION'
       and v_store in ('apple', 'google')
       and not v_trial
       and coalesce((p_event->>'is_family_share')::boolean, false) = false
       and coalesce(v_price, 1) > 0
       and nullif(p_event->>'transaction_id', '') is not null then
      v_eur := case
        when p_event->>'currency' = 'EUR' then v_price
        else nullif(p_event->>'price', '')::numeric * (select eur_per_usd from public.creator_settings)
      end;
      if v_eur is null then
        update public.store_events set note = 'venta sin precio: neto 0' where id = v_id;
      end if;
      perform public.record_sale(
        v_user, v_store, p_event->>'transaction_id', coalesce(v_orig, p_event->>'transaction_id'),
        v_prod.product_id,
        round(coalesce(v_price, 0) * 100)::integer,
        p_event->>'currency', public.net_cents_eur(v_eur), v_bought);
    end if;

  elsif v_type = 'CANCELLATION' and p_event->>'cancel_reason' = 'CUSTOMER_SUPPORT' then
    -- Reembolso de Apple/Google: la comisión ya se anuló arriba (o queda como
    -- clawback si ya se pagó); aquí sale la IA de ESA suscripción.
    update public.subscriptions set status = 'canceled', current_period_end = now(), updated_at = now()
    where user_id = v_user and plan <> 'owner'
      and provider in ('apple', 'google')
      and original_transaction_id is not distinct from v_orig;

  elsif v_type = 'EXPIRATION' then
    -- Solo la suscripción que expira, y solo si nada posterior la ha renovado.
    update public.subscriptions set status = 'canceled', updated_at = now()
    where user_id = v_user and plan <> 'owner'
      and provider in ('apple', 'google')
      and original_transaction_id is not distinct from v_orig
      and (current_period_end is null or current_period_end <= coalesce(v_exp, now()) + interval '1 minute');

  else
    -- CANCELLATION normal (sigue activo hasta fin de periodo), BILLING_ISSUE
    -- (la gracia la cubre la fecha de fin y los dos días de ai_state),
    -- PRODUCT_CHANGE (el cambio real llega después), REFUND_REVERSED, TEST…:
    -- solo se apunta.
    update public.store_events set note = 'solo registrado' where id = v_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- Plazas de Élite fundador que quedan (de 100). Cupo blando: la tienda no se
-- bloquea desde aquí; al llegar a 0 la app deja de enseñar el plan y el dueño
-- quita el producto de la offering en RevenueCat.
create or replace function public.founder_seats_left()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0, coalesce(max(p.max_seats), 0) - (
    select count(distinct s.user_id)::integer from public.store_sales s
    where s.product_id = 'nivl_elite_fundador' and s.refunded_at is null
  ))
  from public.store_products p where p.product_id = 'nivl_elite_fundador';
$$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.store_event_user(jsonb) from public, anon, authenticated;
revoke all on function public.apply_store_event(jsonb) from public, anon, authenticated;
grant execute on function public.store_event_user(jsonb) to service_role;
grant execute on function public.apply_store_event(jsonb) to service_role;
revoke all on function public.founder_seats_left() from public, anon;
grant execute on function public.founder_seats_left() to authenticated;

notify pgrst, 'reload schema';

-- NIVL · NNNN — Comisión proporcional al precio pagado y venta sin precio (1.0.9).
-- BORRADOR: sin número. El coordinador asigna el número, lo copia a
-- supabase/migrations/ y añade la huella a scripts/apply-migrations.mjs:
--   'NNNN': `coalesce(obj_description(to_regprocedure('public.record_sale_proporcional(uuid,text,text,text,text,integer,text,integer,timestamptz,numeric)'),'pg_proc') like '%nivl:comision-proporcional%', false) and coalesce(obj_description(to_regprocedure('public.apply_store_event(jsonb)'),'pg_proc') like '%nivl:comision-proporcional%', false)`
--
-- Decisiones del dueño (2026-10-04), docs/payment-audit/FASE3-OFERTAS-109.md:
--   (1) Con una oferta rebajada la comisión es PROPORCIONAL al precio pagado
--       (no se recorta por precios regionales: decisión del Chat 2, 04/10).
--   (2) Se arregla el precio null de 0027: `coalesce(v_price, 1) > 0` dejaba
--       pasar un evento sin precio, record_sale lo apuntaba con neto 0 y, en
--       un anual, pagaba el tope entero (25–50 €) por un periodo gratis.
--
-- Contrato (ADITIVO, compatible con 1.0.7 y 1.0.8: el cliente no llama a nada de esto)
--   · store_products.list_price_cents: precio de catálogo en céntimos de EUR
--     con IVA (docs/PRECIOS.md). Solo se rellena donde está a null: un ajuste
--     hecho a mano por el dueño no se pisa al re-ejecutar. null = sin escalar.
--   · commissions.price_ratio: pagado/catálogo usado (null = 1, filas viejas).
--   · record_sale_proporcional(…9 de record_sale…, p_price_ratio numeric): la
--     cuenta de 0025 con el factor. Anual (primer_pago): least(tope − generado,
--     round(tope × factor)). Renovación (si renewal_pct > 0): base × % × factor.
--     Mensual: SIN cambio, ya es su % del neto cobrado (proporcional por
--     construcción); escalarlo otra vez lo contaría dos veces.
--   · record_sale (misma firma de 0025) queda como envoltorio con factor 1: el
--     mismo resultado que hoy para quien la llame (scripts, pruebas).
--   · apply_store_event (misma firma; copia íntegra de 0027, ninguna migración
--     posterior la redefine) con dos cambios mínimos:
--       a) venta solo con precio conocido y > 0 (v_price y su equivalente en
--          EUR); si no, nota 'venta sin precio: no se registra' y sin record_sale.
--       b) factor < 1 SOLO con oferta (offer_code no vacío, o period_type
--          INTRO/PROMOTIONAL) pagada en EUR: least(1, pagado / list_price_cents).
--          Sin oferta: 1 siempre (un precio regional no recorta). Oferta en otra
--          moneda o sin catálogo: 1 y nota 'oferta sin referencia: comisión
--          completa'. RevenueCat no manda el precio sin oferta del país (campos
--          verificados el 2026-10-04 en
--          https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields).
--   · Permisos: los mismos que las originales (solo service_role).
--   Sin cambios: record_refund (anula la fila de comisión, que ya es la
--   proporcional), net_cents_eur, apply_store_reconciliation (0033/0036 llaman
--   a apply_store_event(jsonb), cuya firma no cambia), panel, ranking, 0046.
--
-- Espejo TS: comisionCents() en src/lib/creatormath.ts NO se toca aquí; si se
-- adopta, hay que añadirle el factor (ver FASE3-COMISION-PROPORCIONAL.md).
--
-- Re-ejecutable: una segunda pasada no cambia nada.

begin;

-- ── Precio de catálogo (EUR, IVA incluido; docs/PRECIOS.md 2026-09-24) ──
alter table public.store_products
  add column if not exists list_price_cents integer check (list_price_cents > 0);

update public.store_products p
set list_price_cents = v.cents
from (values
  ('nivl_pro_mensual', 1299),
  ('nivl_pro_anual', 9999),
  ('nivl_elite_mensual', 2999),
  ('nivl_elite_anual', 29900),
  ('nivl_elite_fundador', 24900)
) as v(product_id, cents)
where p.product_id = v.product_id and p.list_price_cents is null;

-- ── Factor aplicado, para auditoría ─────────────────────────────────
alter table public.commissions
  add column if not exists price_ratio numeric(5,4) check (price_ratio between 0 and 1);

-- ── La cuenta de 0025 con el factor pagado/catálogo ─────────────────
create or replace function public.record_sale_proporcional(
  p_user uuid, p_store text, p_txn text, p_orig text, p_product text,
  p_price_cents integer, p_currency text, p_net_cents integer, p_purchased_at timestamptz,
  p_price_ratio numeric
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prod public.store_products;
  v_creator public.creators;
  v_set public.creator_settings;
  v_sale uuid;
  v_n integer;
  v_pct numeric;
  v_base integer;
  v_cap integer;
  v_accrued integer;
  v_amount integer;
  v_kind text;
  -- null o fuera de rango → 1 (nunca más que el precio completo, nunca negativo).
  v_ratio numeric := greatest(0, least(1, coalesce(p_price_ratio, 1)));
begin
  select * into v_prod from public.store_products where product_id = p_product;
  if v_prod.product_id is null then raise exception 'Producto desconocido: %', p_product; end if;

  select count(*) + 1 into v_n
  from public.store_sales where original_transaction_id = p_orig and refunded_at is null;

  select c.* into v_creator
  from public.referrals r join public.creators c on c.id = r.creator_id
  where r.user_id = p_user and c.active;

  insert into public.store_sales (user_id, creator_id, store, transaction_id, original_transaction_id,
    product_id, payment_number, price_cents, currency, net_cents, purchased_at)
  values (p_user, v_creator.id, p_store, p_txn, p_orig, p_product, v_n,
    p_price_cents, p_currency, p_net_cents, p_purchased_at)
  on conflict (transaction_id) do nothing
  returning id into v_sale;

  if v_sale is null or v_creator.id is null then return v_sale; end if;

  select * into v_set from public.creator_settings;
  select pct into v_pct from public.creator_ranks where rank = v_creator.rank;
  if not v_set.small_business_program and v_prod.max_pct_without_sbp is not null then
    v_pct := least(v_pct, v_prod.max_pct_without_sbp);
  end if;
  v_base := coalesce(v_prod.commission_base_cents, v_set.base_cents);
  v_cap := round(v_base * v_pct / 100)::integer;

  -- Lo que esta CUENTA ya ha generado (sin anuladas). Un cambio Pro→Élite o
  -- de mensual a anual no reinicia el tope.
  select coalesce(sum(k.amount_cents), 0) into v_accrued
  from public.commissions k join public.store_sales s on s.id = k.sale_id
  where s.user_id = p_user and k.kind in ('primer_pago', 'mensual') and k.status <> 'anulada';

  if v_accrued < v_cap then
    v_kind := case when v_prod.period = 'anual' then 'primer_pago' else 'mensual' end;
    v_amount := case
      -- Anual: el tope escalado por lo pagado, sin pasar de lo que queda.
      when v_prod.period = 'anual' then least(v_cap - v_accrued, round(v_cap * v_ratio)::integer)
      -- Mensual: su % del neto de ESTE cobro (ya proporcional); sin factor.
      else least(round(p_net_cents * v_pct / 100)::integer, v_cap - v_accrued)
    end;
  elsif v_prod.period = 'anual' and v_set.renewal_pct > 0 then
    v_kind := 'renovacion';
    v_pct := v_set.renewal_pct;
    v_amount := round(v_base * v_set.renewal_pct / 100 * v_ratio)::integer;
  else
    return v_sale;
  end if;

  if v_amount > 0 then
    insert into public.commissions
      (creator_id, sale_id, kind, rank, pct, cap_cents, amount_cents, status, available_at, price_ratio)
    values (v_creator.id, v_sale, v_kind, v_creator.rank, v_pct, v_cap, v_amount, 'pendiente',
      p_purchased_at + make_interval(days => v_set.hold_days),
      case when v_kind = 'mensual' then null else round(v_ratio, 4) end);
  end if;

  return v_sale;
end;
$$;

-- ── record_sale (firma de 0025) = envoltorio con factor 1 ───────────
create or replace function public.record_sale(
  p_user uuid, p_store text, p_txn text, p_orig text, p_product text,
  p_price_cents integer, p_currency text, p_net_cents integer, p_purchased_at timestamptz
)
returns uuid
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.record_sale_proporcional(p_user, p_store, p_txn, p_orig, p_product,
    p_price_cents, p_currency, p_net_cents, p_purchased_at, 1);
$$;

-- ── apply_store_event: copia íntegra de 0027 con los cambios marcados ──
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
  v_ratio numeric;  -- NNNN
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
      -- NNNN (a): sin precio conocido y > 0 no hay venta. Apuntarla con neto 0
      -- ocuparía el payment_number 1 (el primer cobro real contaría como 2 y
      -- saldría del ranking de 0046), daría 'ya_pagas' y, en anual, el tope.
      if v_price is null or v_eur is null or v_eur <= 0 then
        update public.store_events set note = 'venta sin precio: no se registra' where id = v_id;
      else
        -- NNNN (b): comisión proporcional SOLO en ofertas rebajadas. Una oferta es
        -- offer_code no vacío o period_type INTRO/PROMOTIONAL. La referencia es
        -- el catálogo en EUR y solo si se pagó en EUR: RevenueCat no trae el
        -- precio sin oferta del país (doc de webhooks, consultada 2026-10-04) y
        -- comparar otra moneda con el EUR recortaría por precio regional.
        if nullif(p_event->>'offer_code', '') is null
           and coalesce(p_event->>'period_type', '') not in ('INTRO', 'PROMOTIONAL') then
          v_ratio := 1;
        elsif p_event->>'currency' = 'EUR' and coalesce(v_prod.list_price_cents, 0) > 0 then
          v_ratio := least(1, v_price * 100 / v_prod.list_price_cents);
        else
          v_ratio := 1;
          update public.store_events set note = 'oferta sin referencia: comisión completa' where id = v_id;
        end if;
        perform public.record_sale_proporcional(
          v_user, v_store, p_event->>'transaction_id', coalesce(v_orig, p_event->>'transaction_id'),
          v_prod.product_id,
          round(v_price * 100)::integer,
          p_event->>'currency', public.net_cents_eur(v_eur), v_bought, v_ratio);
      end if;
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

-- ── Permisos (como 0025/0027: dinero y escritura, solo service_role) ──
revoke all on function public.record_sale_proporcional(uuid, text, text, text, text, integer, text, integer, timestamptz, numeric) from public, anon, authenticated;
revoke all on function public.record_sale(uuid, text, text, text, text, integer, text, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.apply_store_event(jsonb) from public, anon, authenticated;
grant execute on function public.record_sale_proporcional(uuid, text, text, text, text, integer, text, integer, timestamptz, numeric) to service_role;
grant execute on function public.record_sale(uuid, text, text, text, text, integer, text, integer, timestamptz) to service_role;
grant execute on function public.apply_store_event(jsonb) to service_role;

comment on function public.record_sale_proporcional(uuid, text, text, text, text, integer, text, integer, timestamptz, numeric) is
  'nivl:comision-proporcional · anual y renovación escaladas por pagado/catálogo (tope 1); mensual = % del neto, sin factor';
comment on function public.apply_store_event(jsonb) is
  'nivl:comision-proporcional · venta solo con precio conocido y > 0; factor < 1 solo con oferta en EUR: least(1, pagado / store_products.list_price_cents)';

commit;

notify pgrst, 'reload schema';

-- 0141 · La comisión de creadores se calcula sobre el beneficio.
-- Huella: to_regprocedure('public.devengar_comisiones()') is not null
--
-- Decisión del dueño (8-nov-2026): el creador se lleva su % del beneficio, no de
-- la facturación. Beneficio = neto del cobro (sin IVA ni tienda, net_cents_eur)
-- menos el coste real de IA de esa cuenta. El coste de un anual no se conoce el
-- día del pago, así que cada cobro se reparte en tramos mensuales (12 o 1) y
-- cada tramo se devenga al cerrarse su mes.
--
-- Siguen igual: el % del rango como foto del cobro, el tope por cuenta (base ×
-- %, 25/35/50 €), el 35 % sin SBP y el reembolso. Las ventas anteriores a esta
-- migración conservan lo que ya generaron. Espejo: comisionTramo y netoTramoCents
-- en src/lib/creatormath.ts; si cambias una, cambia la otra.
begin;

alter table public.commissions
  add column if not exists tramo integer not null default 1 check (tramo between 1 and 12),
  add column if not exists tramo_inicio timestamptz,
  add column if not exists tramo_fin timestamptz,
  add column if not exists neto_cents integer,
  add column if not exists ia_cents integer,
  add column if not exists devengado_at timestamptz;

alter table public.commissions drop constraint if exists commissions_sale_id_key;
create unique index if not exists commissions_sale_tramo_uniq on public.commissions (sale_id, tramo);
create index if not exists commissions_por_devengar_idx on public.commissions (tramo_fin)
  where tramo_fin is not null and devengado_at is null;

-- Registrar un cobro. Misma firma (la llama apply_store_event, 0027). Deja los
-- tramos a cero y sin fecha de pago: la venta cuenta ya en el panel y en los
-- rankings, pero solo se cobra lo que devengar_comisiones haya calculado.
create or replace function public.record_sale(
  p_user uuid, p_store text, p_txn text, p_orig text, p_product text,
  p_price_cents integer, p_currency text, p_net_cents integer, p_purchased_at timestamptz
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
  v_kind text;
  v_meses integer;
  v_k integer;
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

  select coalesce(sum(k.amount_cents), 0) into v_accrued
  from public.commissions k join public.store_sales s on s.id = k.sale_id
  where s.user_id = p_user and k.kind in ('primer_pago', 'mensual') and k.status <> 'anulada';

  if v_prod.period = 'anual' then
    -- Solo el primer año; una renovación, solo con renewal_pct (por defecto 0).
    -- Una mejora dentro del año (de un modo a los cuatro) sigue siendo primer
    -- año: sus tramos sustituyen a los meses que le quedaban al plan anterior.
    if exists (select 1 from public.store_sales s join public.store_products p on p.product_id = s.product_id
               where s.user_id = p_user and s.id <> v_sale and p.period = 'anual'
                 and s.refunded_at is null and s.purchased_at <= p_purchased_at - interval '11 months') then
      if v_set.renewal_pct <= 0 then return v_sale; end if;
      v_kind := 'renovacion';
      v_pct := v_set.renewal_pct;
    else
      v_kind := 'primer_pago';
    end if;
    v_meses := 12;
  else
    if v_accrued >= v_cap then return v_sale; end if;
    v_kind := 'mensual';
    v_meses := 1;
  end if;

  for v_k in 1..v_meses loop
    insert into public.commissions
      (creator_id, sale_id, kind, rank, pct, cap_cents, amount_cents, status, available_at,
       tramo, tramo_inicio, tramo_fin, neto_cents)
    values (v_creator.id, v_sale, v_kind, v_creator.rank, v_pct, v_cap, 0, 'pendiente', 'infinity',
      v_k,
      p_purchased_at + make_interval(months => v_k - 1),
      p_purchased_at + make_interval(months => v_k),
      -- Por diferencia de acumulados: los tramos suman exactamente el neto.
      round(p_net_cents::numeric * v_k / v_meses)::integer - round(p_net_cents::numeric * (v_k - 1) / v_meses)::integer);
  end loop;

  return v_sale;
end;
$$;

-- Calcula los tramos cuyo mes ya ha terminado. Idempotente: cada tramo se
-- devenga una sola vez. Lo lanza el cron cada noche y `creadores.mjs liquidar`.
create or replace function public.devengar_comisiones()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  v_set public.creator_settings;
  v_micro bigint;
  v_ia integer;
  v_accrued integer;
  v_amount integer;
  v_n integer := 0;
begin
  perform pg_advisory_xact_lock(hashtext('nivl:devengar_comisiones'));
  select * into v_set from public.creator_settings;

  for r in
    select k.*, s.user_id, s.purchased_at
    from public.commissions k join public.store_sales s on s.id = k.sale_id
    where k.tramo_fin is not null and k.devengado_at is null
      and k.status = 'pendiente' and k.tramo_fin <= now()
    order by s.purchased_at, k.tramo
  loop
    -- Un cobro posterior de la misma cuenta (mejora o cambio de plan) sustituye
    -- a los meses que aún no habían empezado: no se cuenta dos veces.
    if r.user_id is not null and exists (
      select 1 from public.store_sales n
      where n.user_id = r.user_id and n.id <> r.sale_id and n.refunded_at is null
        and n.purchased_at > r.purchased_at and n.purchased_at <= r.tramo_inicio
    ) then
      update public.commissions
      set status = 'anulada', voided_reason = 'sustituida', devengado_at = now(), ia_cents = 0
      where id = r.id;
      continue;
    end if;

    select coalesce(sum(c.real_micro), 0) into v_micro
    from public.ai_cargos c
    where c.user_id = r.user_id and c.estado = 'liquidado'
      and c.created_at >= r.tramo_inicio and c.created_at < r.tramo_fin;
    v_ia := round(v_micro * v_set.eur_per_usd / 10000)::integer;

    v_amount := round(greatest(0, r.neto_cents - v_ia) * r.pct / 100)::integer;
    if r.kind <> 'renovacion' then
      select coalesce(sum(k.amount_cents), 0) into v_accrued
      from public.commissions k join public.store_sales s on s.id = k.sale_id
      where (s.user_id = r.user_id or s.id = r.sale_id)
        and k.kind in ('primer_pago', 'mensual') and k.status <> 'anulada';
      v_amount := greatest(0, least(v_amount, r.cap_cents - v_accrued));
    end if;

    update public.commissions
    set amount_cents = v_amount, ia_cents = v_ia, devengado_at = now(),
        available_at = greatest(r.tramo_fin, r.purchased_at + make_interval(days => v_set.hold_days))
    where id = r.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.devengar_comisiones() from public, anon, authenticated;
grant execute on function public.devengar_comisiones() to service_role;
comment on function public.devengar_comisiones() is 'Comisión sobre beneficio, tramo a tramo. nivl:comision-beneficio-0141';

do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'Sin pg_cron: el devengo no se programa (solo pruebas locales).';
    return;
  end if;
  create extension if not exists pg_cron;
  perform cron.unschedule(jobname) from cron.job where jobname = 'nivl-devengar-comisiones';
  perform cron.schedule('nivl-devengar-comisiones', '47 3 * * *', 'select public.devengar_comisiones();');
end
$$;

commit;

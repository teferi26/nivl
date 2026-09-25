-- NIVL · 0025 — Programa de creadores.
--
-- Quien trae a alguien que paga cobra una comisión sobre una BASE FIJA por
-- producto (100 €), nunca sobre el precio: da igual que el comprador elija Pro
-- o Élite. Anual: el tope entero en el primer cobro; mensual: su % del neto de
-- cada mes hasta el mismo tope (docs/PRECIOS.md). Todo es del servidor:
-- ninguna tabla tiene políticas para el cliente (salvo el catálogo de
-- productos, de lectura); lo único que cruza son las RPC de abajo, y a un
-- creador solo se le enseña SU dinero. De los demás, solo alias y ventas del
-- mes en el ranking.
--
-- La misma cuenta, en TypeScript y con tests: src/lib/creatormath.ts. Si
-- cambias el redondeo o una regla aquí, cámbiala allí.
--
-- REPO PÚBLICO: aquí no se inserta ningún creador, código ni pago. Las altas
-- se hacen con scripts/creadores.mjs contra la base.
--
-- Idempotente: se puede ejecutar dos veces sin cambiar nada la segunda.

-- ── Parámetros (una sola fila). Los valores son los de docs/PRECIOS.md ──
create table if not exists public.creator_settings (
  id boolean primary key default true check (id),
  base_cents integer not null default 10000 check (base_cents >= 0),
  -- Sin SBP: neto al 30 % y tope de % en los productos que lo marquen.
  small_business_program boolean not null default false,
  vat_pct numeric(5,2) not null default 21 check (vat_pct between 0 and 50),
  eur_per_usd numeric(6,4) not null default 0.93 check (eur_per_usd > 0),
  renewal_pct numeric(5,2) not null default 0 check (renewal_pct between 0 and 10),
  hold_days integer not null default 30 check (hold_days between 0 and 120),
  claim_window_days integer not null default 14 check (claim_window_days between 0 and 90),
  -- El premio del primero del mes. Lo escribe el script: si es confidencial,
  -- no pasa por el repo.
  prize_text text check (char_length(prize_text) <= 200)
);
insert into public.creator_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.creator_ranks (
  rank text primary key check (rank in ('novato', 'pro', 'elite')),
  pct numeric(5,2) not null check (pct between 0 and 100)
);
insert into public.creator_ranks (rank, pct)
values ('novato', 25), ('pro', 35), ('elite', 50)
on conflict (rank) do nothing;

-- El catálogo de tienda: a qué plan da derecho cada producto y cómo comisiona.
create table if not exists public.store_products (
  product_id text primary key,
  plan text not null,
  tier text not null check (tier in ('pro', 'elite')),
  period text not null check (period in ('mensual', 'anual')),
  commission_base_cents integer check (commission_base_cents >= 0),  -- null = creator_settings.base_cents
  max_pct_without_sbp numeric(5,2) check (max_pct_without_sbp between 0 and 100),  -- null = sin límite
  max_seats integer check (max_seats > 0)                              -- solo el de fundador
);
insert into public.store_products
  (product_id, plan, tier, period, commission_base_cents, max_pct_without_sbp, max_seats)
values
  ('nivl_pro_mensual', 'pro_mensual', 'pro', 'mensual', null, null, null),
  ('nivl_pro_anual', 'pro_anual', 'pro', 'anual', null, 35, null),
  ('nivl_elite_mensual', 'elite_mensual', 'elite', 'mensual', null, null, null),
  ('nivl_elite_anual', 'elite_anual', 'elite', 'anual', null, null, null),
  ('nivl_elite_fundador', 'elite_fundador', 'elite', 'anual', null, null, 100)
on conflict (product_id) do nothing;

create table if not exists public.creators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  code text not null unique check (code ~ '^[A-Z0-9_]{3,20}$'),
  alias text not null check (char_length(alias) between 1 and 40),
  rank text not null default 'novato' references public.creator_ranks (rank),
  monthly_fixed_cents integer not null default 0 check (monthly_fixed_cents >= 0),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

-- Una atribución por cuenta, para siempre.
create table if not exists public.referrals (
  user_id uuid primary key references auth.users (id) on delete cascade,
  creator_id uuid not null references public.creators (id),
  source text not null check (source in ('onboarding', 'enlace', 'perfil', 'manual')),
  created_at timestamptz not null default now()
);
create index if not exists referrals_creator_idx on public.referrals (creator_id, created_at);

-- Cada cobro real de tienda. Lo escribe record_sale (vía apply_store_event, 0027).
create table if not exists public.store_sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  creator_id uuid references public.creators (id),
  store text not null check (store in ('apple', 'google', 'stripe', 'manual')),
  transaction_id text not null unique,
  original_transaction_id text not null,
  product_id text not null references public.store_products (product_id),
  payment_number integer not null check (payment_number >= 1),
  price_cents integer,                -- lo que pagó, con IVA, en su moneda
  currency text,
  net_cents integer not null,         -- en euros: sin IVA y sin la comisión de tienda
  purchased_at timestamptz not null,
  refunded_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists store_sales_user_idx on public.store_sales (user_id, purchased_at);
create index if not exists store_sales_creator_idx on public.store_sales (creator_id, purchased_at);
create index if not exists store_sales_orig_idx on public.store_sales (original_transaction_id);

create table if not exists public.creator_payouts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id),
  kind text not null check (kind in ('comisiones', 'fijo_mensual', 'premio', 'contenido_externo', 'ajuste')),
  amount_cents integer not null,
  period text,
  note text check (char_length(note) <= 280),
  paid_at timestamptz not null default now()
);
create index if not exists creator_payouts_creator_idx on public.creator_payouts (creator_id, paid_at desc);

create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id),
  sale_id uuid not null unique references public.store_sales (id),
  kind text not null check (kind in ('primer_pago', 'mensual', 'renovacion')),
  -- Foto del momento del cobro: subir de rango no cambia lo ya cobrado.
  rank text not null,
  pct numeric(5,2) not null,
  cap_cents integer not null,
  amount_cents integer not null check (amount_cents >= 0),
  -- pendiente: en retención (disponible cuando available_at <= now()) · pagada · anulada.
  status text not null check (status in ('pendiente', 'pagada', 'anulada')),
  available_at timestamptz not null,
  payout_id uuid references public.creator_payouts (id),
  clawback boolean not null default false,
  clawback_settled_at timestamptz,
  voided_reason text,
  created_at timestamptz not null default now()
);
create index if not exists commissions_creator_idx on public.commissions (creator_id, status);

-- ── Acceso: RLS sin políticas y, además, sin privilegios de tabla ────
-- Supabase concede por defecto todo sobre public a anon y authenticated; con
-- RLS activa y sin políticas eso ya es "0 filas", pero se revoca igual (como
-- en 0021) para que un error futuro en una política no abra nada.
alter table public.creator_settings enable row level security;
alter table public.creator_ranks enable row level security;
alter table public.store_products enable row level security;
alter table public.creators enable row level security;
alter table public.referrals enable row level security;
alter table public.store_sales enable row level security;
alter table public.creator_payouts enable row level security;
alter table public.commissions enable row level security;

revoke all on public.creator_settings from anon, authenticated;
revoke all on public.creator_ranks from anon, authenticated;
revoke all on public.store_products from anon, authenticated;
revoke all on public.creators from anon, authenticated;
revoke all on public.referrals from anon, authenticated;
revoke all on public.store_sales from anon, authenticated;
revoke all on public.creator_payouts from anon, authenticated;
revoke all on public.commissions from anon, authenticated;

-- El catálogo es público para quien tiene sesión: son ids de tienda.
grant select on public.store_products to authenticated;
drop policy if exists "store_products read" on public.store_products;
create policy "store_products read" on public.store_products for select to authenticated using (true);

-- ── Neto de un cobro, en céntimos de euro ───────────────────────────
-- Sin IVA y sin la comisión de tienda (15 % con SBP, 30 % sin él: peca de
-- prudente, porque desde el segundo año de cada suscripción Apple cobra 15 %).
-- Espejo: netoCents() en src/lib/creatormath.ts.
create or replace function public.net_cents_eur(p_price_eur numeric)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select round(
    coalesce(p_price_eur, 0) * 100 / (1 + s.vat_pct / 100)
    * (1 - case when s.small_business_program then 0.15 else 0.30 end)
  )::integer
  from public.creator_settings s;
$$;

-- ── Registrar un cobro (lo llamará apply_store_event, 0027) ─────────
-- Idempotente por transaction_id. Devuelve el id de la venta o null si ya
-- estaba. La comisión sigue docs/PRECIOS.md: tope por cuenta = base × % del
-- rango; el anual lo llena de golpe, el mensual con su % del neto de cada mes.
-- Espejo: comisionCents() en src/lib/creatormath.ts.
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
  v_amount integer;
  v_kind text;
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
      when v_prod.period = 'anual' then v_cap - v_accrued
      else least(round(p_net_cents * v_pct / 100)::integer, v_cap - v_accrued)
    end;
  elsif v_prod.period = 'anual' and v_set.renewal_pct > 0 then
    v_kind := 'renovacion';
    v_pct := v_set.renewal_pct;
    v_amount := round(v_base * v_set.renewal_pct / 100)::integer;
  else
    return v_sale;
  end if;

  if v_amount > 0 then
    insert into public.commissions
      (creator_id, sale_id, kind, rank, pct, cap_cents, amount_cents, status, available_at)
    values (v_creator.id, v_sale, v_kind, v_creator.rank, v_pct, v_cap, v_amount, 'pendiente',
      p_purchased_at + make_interval(days => v_set.hold_days));
  end if;

  return v_sale;
end;
$$;

-- ── Reembolso ───────────────────────────────────────────────────────
create or replace function public.record_refund(p_txn text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sale uuid;
begin
  update public.store_sales set refunded_at = coalesce(refunded_at, now())
  where transaction_id = p_txn
  returning id into v_sale;
  if v_sale is null then return; end if;

  -- Lo ya pagado queda como clawback: se resta en la siguiente liquidación.
  -- (En un UPDATE, la derecha lee los valores de antes: status aún es el viejo.)
  update public.commissions
  set clawback = (status = 'pagada'),
      status = 'anulada',
      voided_reason = 'reembolso'
  where sale_id = v_sale and status <> 'anulada';
end;
$$;

-- ── "¿Quién te trajo?" ──────────────────────────────────────────────
-- Un rechazo de negocio NO es una excepción: vuelve como {ok:false, reason}
-- para que la app lo enseñe en una línea y deje seguir.
create or replace function public.claim_referral(p_code text, p_source text default 'onboarding')
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_source text := case when p_source in ('onboarding', 'enlace', 'perfil') then p_source else 'perfil' end;
  v_creator public.creators;
  v_created timestamptz;
  v_window integer;
  v_done uuid;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;

  if exists (select 1 from public.referrals where user_id = v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'ya_asignado');
  end if;

  select * into v_creator from public.creators where code = v_code and active;
  if v_creator.id is null then
    return jsonb_build_object('ok', false, 'reason', 'desconocido');
  end if;
  if v_creator.user_id = v_uid then
    return jsonb_build_object('ok', false, 'reason', 'propio');
  end if;
  -- "Aún no ha pagado": ni un cobro de tienda ni una suscripción de pago
  -- (Stripe heredado, owner). La prueba de 7 días (cortesía) no cuenta.
  if exists (select 1 from public.store_sales where user_id = v_uid)
     or exists (select 1 from public.subscriptions
                where user_id = v_uid and plan <> 'cortesia' and status <> 'none') then
    return jsonb_build_object('ok', false, 'reason', 'ya_pagas');
  end if;

  -- El plazo cuenta desde el alta en NIVL: franky-auth crea el usuario de NIVL
  -- en su primer acceso, no con la fecha de la cuenta de Franky.
  select created_at into v_created from auth.users where id = v_uid;
  select claim_window_days into v_window from public.creator_settings;
  if v_created < now() - make_interval(days => coalesce(v_window, 14)) then
    return jsonb_build_object('ok', false, 'reason', 'fuera_de_plazo');
  end if;

  insert into public.referrals (user_id, creator_id, source)
  values (v_uid, v_creator.id, v_source)
  on conflict (user_id) do nothing
  returning user_id into v_done;
  -- Dos llamadas a la vez: gana la primera y la otra lo dice.
  if v_done is null then
    return jsonb_build_object('ok', false, 'reason', 'ya_asignado');
  end if;

  insert into public.events (user_id, type, payload)
  values (v_uid, 'creator_referral', jsonb_build_object('source', v_source));

  return jsonb_build_object('ok', true, 'alias', v_creator.alias);
end;
$$;

-- Quién me trajo o, si nadie, si aún puedo decirlo (para la fila de Perfil).
create or replace function public.my_referral()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
  v_created timestamptz;
  v_window integer;
begin
  if v_uid is null then return null; end if;

  select jsonb_build_object('alias', c.alias, 'since', r.created_at, 'claimable', false)
  into v_out
  from public.referrals r join public.creators c on c.id = r.creator_id
  where r.user_id = v_uid;
  if v_out is not null then return v_out; end if;

  select created_at into v_created from auth.users where id = v_uid;
  select claim_window_days into v_window from public.creator_settings;
  return jsonb_build_object(
    'alias', null,
    'since', null,
    'claimable',
      v_created >= now() - make_interval(days => coalesce(v_window, 14))
      and not exists (select 1 from public.store_sales where user_id = v_uid)
      and not exists (select 1 from public.subscriptions
                      where user_id = v_uid and plan <> 'cortesia' and status <> 'none')
      -- Un creador no se trae a sí mismo: ni se le ofrece.
      and not exists (select 1 from public.creators where user_id = v_uid)
  );
end;
$$;

-- ── Panel del creador: SOLO su dinero ───────────────────────────────
-- Una "venta" es una cuenta nueva que paga: comisión viva sobre el PRIMER
-- cobro de su suscripción (payment_number = 1). El resto de cobros mensuales
-- suman dinero, no ventas. Devuelve null si quien llama no es creador activo.
create or replace function public.creator_panel()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_c public.creators;
  v_set public.creator_settings;
  v_pct numeric;
  -- El mes del premio es el de España, no el de UTC.
  v_mes timestamptz := date_trunc('month', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid';
  v_pos integer;
  v_total integer;
begin
  if v_uid is null then return null; end if;
  select * into v_c from public.creators where user_id = v_uid and active;
  if v_c.id is null then return null; end if;
  select * into v_set from public.creator_settings;
  select pct into v_pct from public.creator_ranks where rank = v_c.rank;

  with ventas as (
    select cr.id, count(distinct s.user_id) filter (where k.id is not null) as n
    from public.creators cr
    left join public.store_sales s
      on s.creator_id = cr.id and s.purchased_at >= v_mes and s.payment_number = 1
    left join public.commissions k
      on k.sale_id = s.id and k.status <> 'anulada'
    where cr.active
    group by cr.id
  ), puestos as (
    select id, (rank() over (order by n desc))::integer as pos, (count(*) over ())::integer as total
    from ventas
  )
  select pos, total into v_pos, v_total from puestos where id = v_c.id;

  return jsonb_build_object(
    'alias', v_c.alias,
    'code', v_c.code,
    'rank', v_c.rank,
    'pct', v_pct,
    'base_cents', v_set.base_cents,
    'hold_days', v_set.hold_days,
    'installs', (select count(*) from public.referrals where creator_id = v_c.id),
    'installs_month', (select count(*) from public.referrals where creator_id = v_c.id and created_at >= v_mes),
    'sales', (select count(distinct s.user_id) from public.commissions k join public.store_sales s on s.id = k.sale_id
              where k.creator_id = v_c.id and k.status <> 'anulada' and s.payment_number = 1),
    'sales_month', (select count(distinct s.user_id) from public.commissions k join public.store_sales s on s.id = k.sale_id
                    where k.creator_id = v_c.id and k.status <> 'anulada' and s.payment_number = 1
                      and s.purchased_at >= v_mes),
    'pending_cents', (select coalesce(sum(amount_cents), 0) from public.commissions
                      where creator_id = v_c.id and status = 'pendiente' and available_at > now()),
    'available_cents', (select coalesce(sum(amount_cents), 0) from public.commissions
                        where creator_id = v_c.id and status = 'pendiente' and available_at <= now()),
    'clawback_cents', (select coalesce(sum(amount_cents), 0) from public.commissions
                       where creator_id = v_c.id and clawback and clawback_settled_at is null),
    'paid_cents', (select coalesce(sum(amount_cents), 0) from public.creator_payouts where creator_id = v_c.id),
    'monthly_fixed_cents', v_c.monthly_fixed_cents,
    'position', v_pos,
    'creators', v_total,
    'prize', v_set.prize_text,
    'payouts', coalesce((
      select jsonb_agg(jsonb_build_object('kind', p.kind, 'cents', p.amount_cents, 'at', p.paid_at) order by p.paid_at desc)
      from (select * from public.creator_payouts where creator_id = v_c.id order by paid_at desc limit 12) p
    ), '[]'::jsonb)
  );
end;
$$;

-- Ranking de creadores del mes: alias y ventas. Nunca dinero ajeno. Solo lo
-- ve un creador activo; a cualquier otra cuenta le devuelve 0 filas.
create or replace function public.creator_board()
returns table (alias text, sales integer, pos integer, is_me boolean)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_mes timestamptz := date_trunc('month', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid';
begin
  if v_uid is null then return; end if;
  if not exists (select 1 from public.creators where user_id = v_uid and active) then return; end if;
  return query
  select cr.alias,
         (count(distinct s.user_id) filter (where k.id is not null))::integer,
         (rank() over (order by count(distinct s.user_id) filter (where k.id is not null) desc))::integer,
         cr.user_id is not distinct from v_uid
  from public.creators cr
  left join public.store_sales s
    on s.creator_id = cr.id and s.purchased_at >= v_mes and s.payment_number = 1
  left join public.commissions k
    on k.sale_id = s.id and k.status <> 'anulada'
  where cr.active
  group by cr.id, cr.alias, cr.user_id
  order by 3, 1
  limit 50;
end;
$$;

-- ── Liquidar (solo service_role / postgres, desde scripts/creadores.mjs) ──
-- Apunta el pago; la transferencia la hace el dueño fuera. Resta los
-- clawbacks pendientes. Bloquea las filas para que dos liquidaciones a la vez
-- no paguen lo mismo dos veces.
create or replace function public.liquidate_creator(p_creator uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total bigint;
  v_claw bigint;
  v_payout uuid;
begin
  perform 1 from public.creators where id = p_creator for update;
  if not found then raise exception 'Creador desconocido'; end if;

  select coalesce(sum(amount_cents), 0) into v_total
  from public.commissions
  where creator_id = p_creator and status = 'pendiente' and available_at <= now();

  select coalesce(sum(amount_cents), 0) into v_claw
  from public.commissions
  where creator_id = p_creator and clawback and clawback_settled_at is null;

  if v_total - v_claw <= 0 then
    return jsonb_build_object('ok', false, 'available', v_total, 'clawback', v_claw);
  end if;

  insert into public.creator_payouts (creator_id, kind, amount_cents, period, note)
  values (p_creator, 'comisiones', (v_total - v_claw)::integer, to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM'), p_note)
  returning id into v_payout;

  update public.commissions set status = 'pagada', payout_id = v_payout
  where creator_id = p_creator and status = 'pendiente' and available_at <= now();

  update public.commissions set clawback_settled_at = now()
  where creator_id = p_creator and clawback and clawback_settled_at is null;

  return jsonb_build_object('ok', true, 'payout', v_payout, 'amount', v_total - v_claw,
    'available', v_total, 'clawback', v_claw);
end;
$$;

-- ── Permisos ────────────────────────────────────────────────────────
-- Dinero y escritura: solo service_role (el webhook de la 0027 y el script).
revoke all on function public.net_cents_eur(numeric) from public, anon, authenticated;
revoke all on function public.record_sale(uuid, text, text, text, text, integer, text, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.record_refund(text) from public, anon, authenticated;
revoke all on function public.liquidate_creator(uuid, text) from public, anon, authenticated;
grant execute on function public.net_cents_eur(numeric) to service_role;
grant execute on function public.record_sale(uuid, text, text, text, text, integer, text, integer, timestamptz) to service_role;
grant execute on function public.record_refund(text) to service_role;
grant execute on function public.liquidate_creator(uuid, text) to service_role;

-- Lo que cruza al cliente: con sesión, y cada una revalida auth.uid().
revoke all on function public.claim_referral(text, text) from public, anon;
revoke all on function public.my_referral() from public, anon;
revoke all on function public.creator_panel() from public, anon;
revoke all on function public.creator_board() from public, anon;
grant execute on function public.claim_referral(text, text) to authenticated;
grant execute on function public.my_referral() to authenticated;
grant execute on function public.creator_panel() to authenticated;
grant execute on function public.creator_board() to authenticated;

notify pgrst, 'reload schema';

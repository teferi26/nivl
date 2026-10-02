-- NIVL · 0046 — Programa de creadores gamificado (rol, retos, histórico, progreso).
-- Número asignado por el coordinador (SQL B de docs/payment-audit/FASE2-PLAN.md).
-- Entregado en docs/payment-audit/propuestas/; el coordinador lo copia a
-- supabase/migrations/ y añade la huella a scripts/apply-migrations.mjs:
--   '0046': `coalesce(obj_description(to_regprocedure('public.creator_progress()'), 'pg_proc') like '%nivl:creator-program-0046%', false)`
--
-- Contrato
--   ADITIVA sobre 0025. No re-crea ni cambia ninguna función existente:
--   creator_panel, creator_board, claim_referral, my_referral, record_sale,
--   record_refund y liquidate_creator quedan intactas (la app 1.0.7 sigue
--   igual). Añade:
--   · creators.role ('creador' | 'comercial' | 'clipper', por defecto 'creador').
--   · creator_rank_rules: umbral de ventas en 90 días (y meses seguidos con
--     venta) para PROPONER un rango. Sin filas en el repo: las pone el dueño
--     con scripts/creadores.mjs. El ascenso nunca es automático (sube la
--     comisión): `revisar-rangos` propone y el dueño aplica.
--   · creator_challenges: retos con fecha, objetivo de ventas y premio en
--     texto; role null = para todos.
--   · Tres RPC de SOLO LECTURA para el creador con sesión (security definer,
--     revalidan creators.user_id = auth.uid() and active):
--       creator_progress()              → jsonb | null
--       creator_sales_history(p_months) → setof filas por mes (Europe/Madrid)
--       creator_board_period(p_period)  → alias + ventas, como creator_board
--   Las tablas nuevas quedan como las de 0025: RLS sin políticas y sin
--   privilegios para anon/authenticated.
--
-- Definición de "venta" (la misma de creator_panel/creator_board de 0025):
-- cuenta distinta (store_sales.user_id) con el PRIMER cobro de su suscripción
-- (payment_number = 1) y una comisión viva (status <> 'anulada').
--
-- REPO PÚBLICO: aquí no se inserta ningún creador, regla, reto ni premio.
-- Re-ejecutable: una segunda pasada no cambia nada.

-- ── Rol ─────────────────────────────────────────────────────────────
alter table public.creators
  add column if not exists role text not null default 'creador'
  check (role in ('creador', 'comercial', 'clipper'));

-- ── Reglas de rango (las pone el dueño; aquí ninguna) ───────────────
create table if not exists public.creator_rank_rules (
  rank text primary key references public.creator_ranks (rank),
  min_sales_90d integer not null check (min_sales_90d >= 0),
  min_months_active integer not null default 0 check (min_months_active >= 0),
  updated_at timestamptz not null default now()
);

-- ── Retos ───────────────────────────────────────────────────────────
create table if not exists public.creator_challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  description text check (char_length(description) <= 300),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  goal_sales integer not null check (goal_sales > 0),
  prize_text text check (char_length(prize_text) <= 200),
  role text check (role in ('creador', 'comercial', 'clipper')),  -- null = todos
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists creator_challenges_window_idx on public.creator_challenges (starts_at, ends_at);

alter table public.creator_rank_rules enable row level security;
alter table public.creator_challenges enable row level security;
revoke all on public.creator_rank_rules from anon, authenticated;
revoke all on public.creator_challenges from anon, authenticated;

-- ── Ventas de un creador en una ventana (interna, no se expone) ─────
create or replace function public.creator_sales_between(p_creator uuid, p_from timestamptz, p_to timestamptz)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(distinct s.user_id)::integer
  from public.store_sales s
  join public.commissions k on k.sale_id = s.id and k.status <> 'anulada'
  where s.creator_id = p_creator and s.payment_number = 1
    and s.purchased_at >= p_from and s.purchased_at < p_to;
$$;
revoke all on function public.creator_sales_between(uuid, timestamptz, timestamptz) from public, anon, authenticated;

-- ── Progreso: rango, siguiente umbral, retos activos, racha de meses ─
create or replace function public.creator_progress()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_c public.creators;
  v_pct numeric;
  v_base integer;
  v_next text;
  v_rule public.creator_rank_rules;
  v_sales90 integer;
  v_streak integer := 0;
  -- Mes de España, no de UTC (como creator_panel).
  v_mes timestamp := date_trunc('month', now() at time zone 'Europe/Madrid');
  v_m timestamp;
  v_retos jsonb;
begin
  if v_uid is null then return null; end if;
  select * into v_c from public.creators where user_id = v_uid and active;
  if v_c.id is null then return null; end if;

  select pct into v_pct from public.creator_ranks where rank = v_c.rank;
  select base_cents into v_base from public.creator_settings;
  v_sales90 := public.creator_sales_between(v_c.id, now() - interval '90 days', 'infinity');

  -- Siguiente rango por % (novato 25 → pro 35 → élite 50).
  select r.rank into v_next from public.creator_ranks r
  where r.pct > coalesce(v_pct, 0) order by r.pct limit 1;
  if v_next is not null then
    select * into v_rule from public.creator_rank_rules where rank = v_next;
  end if;

  -- Meses seguidos con al menos una venta. El mes en curso no rompe la
  -- racha mientras no termine: si aún no tiene venta, se cuenta desde el
  -- anterior. Tope de 120 meses.
  v_m := v_mes;
  if public.creator_sales_between(v_c.id, v_m at time zone 'Europe/Madrid',
       (v_m + interval '1 month') at time zone 'Europe/Madrid') = 0 then
    v_m := v_m - interval '1 month';
  end if;
  while v_streak < 120 and public.creator_sales_between(v_c.id, v_m at time zone 'Europe/Madrid',
          (v_m + interval '1 month') at time zone 'Europe/Madrid') > 0 loop
    v_streak := v_streak + 1;
    v_m := v_m - interval '1 month';
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', ch.id,
           'title', ch.title,
           'description', ch.description,
           'starts_at', ch.starts_at,
           'ends_at', ch.ends_at,
           'goal_sales', ch.goal_sales,
           'prize', ch.prize_text,
           'role', ch.role,
           'sales', public.creator_sales_between(v_c.id, ch.starts_at, ch.ends_at)
         ) order by ch.ends_at, ch.id), '[]'::jsonb)
  into v_retos
  from public.creator_challenges ch
  where ch.starts_at <= now() and ch.ends_at > now()
    and (ch.role is null or ch.role = v_c.role);

  return jsonb_build_object(
    'alias', v_c.alias,
    'code', v_c.code,
    'role', v_c.role,
    'rank', v_c.rank,
    'pct', v_pct,
    'base_cents', v_base,
    'sales_90d', v_sales90,
    'months_active', v_streak,
    'next_rank', v_next,
    'next_min_sales_90d', v_rule.min_sales_90d,
    'next_min_months_active', v_rule.min_months_active,
    'challenges', v_retos
  );
end;
$$;

comment on function public.creator_progress() is
  'nivl:creator-program-0046 — progreso del creador: rango, ventas 90 días, siguiente umbral, retos activos y meses seguidos con venta. Solo lectura, solo lo propio.';

-- ── Histórico mensual propio (Europe/Madrid) ────────────────────────
-- Un mes = el de store_sales.purchased_at en hora de Madrid. Céntimos de SUS
-- comisiones por estado: en retención (pendiente y aún no disponible),
-- disponibles (pendiente y fuera de retención), pagados, anulados y, de los
-- anulados, los que eran clawback (ya pagados y luego reembolsados). Sin
-- user_id de compradores. Hasta 24 meses; null = 12; mínimo 1.
create or replace function public.creator_sales_history(p_months integer default 12)
returns table (
  month text, sales integer, pending_cents integer, available_cents integer,
  paid_cents integer, voided_cents integer, clawback_cents integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_cid uuid;
  v_n integer := least(greatest(coalesce(p_months, 12), 1), 24);
  v_mes timestamp := date_trunc('month', now() at time zone 'Europe/Madrid');
begin
  if v_uid is null then return; end if;
  select id into v_cid from public.creators where user_id = v_uid and active;
  if v_cid is null then return; end if;

  return query
  with meses as (
    select (v_mes - make_interval(months => g)) as m
    from generate_series(0, v_n - 1) g
  ), com as (
    select date_trunc('month', s.purchased_at at time zone 'Europe/Madrid') as m,
           c.status, c.available_at, c.amount_cents, c.clawback
    from public.commissions c
    join public.store_sales s on s.id = c.sale_id
    where c.creator_id = v_cid
      and s.purchased_at >= (v_mes - make_interval(months => v_n - 1)) at time zone 'Europe/Madrid'
  )
  select to_char(me.m, 'YYYY-MM'),
         public.creator_sales_between(v_cid, me.m at time zone 'Europe/Madrid',
           (me.m + interval '1 month') at time zone 'Europe/Madrid'),
         coalesce(sum(com.amount_cents) filter (where com.status = 'pendiente' and com.available_at > now()), 0)::integer,
         coalesce(sum(com.amount_cents) filter (where com.status = 'pendiente' and com.available_at <= now()), 0)::integer,
         coalesce(sum(com.amount_cents) filter (where com.status = 'pagada'), 0)::integer,
         coalesce(sum(com.amount_cents) filter (where com.status = 'anulada'), 0)::integer,
         coalesce(sum(com.amount_cents) filter (where com.status = 'anulada' and com.clawback), 0)::integer
  from meses me
  left join com on com.m = me.m
  group by me.m
  order by me.m desc;
end;
$$;

-- ── Tabla por periodo: 'mes' | 'reto:<uuid>' ────────────────────────
-- Alias y ventas, como creator_board (0025): nunca dinero ajeno. Solo para
-- un creador activo; un periodo desconocido, un reto que no existe o un reto
-- de otro rol devuelven 0 filas. En un reto con rol solo compiten los de ese
-- rol.
create or replace function public.creator_board_period(p_period text)
returns table (alias text, sales integer, pos integer, is_me boolean)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_me public.creators;
  v_from timestamptz;
  v_to timestamptz := 'infinity';
  v_role text;
  v_ch public.creator_challenges;
  v_p text := coalesce(p_period, '');
begin
  if v_uid is null then return; end if;
  select * into v_me from public.creators where user_id = v_uid and active;
  if v_me.id is null then return; end if;

  if v_p = 'mes' then
    v_from := date_trunc('month', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid';
  elsif v_p ~ '^reto:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    select * into v_ch from public.creator_challenges where id = substr(v_p, 6)::uuid;
    if v_ch.id is null then return; end if;
    if v_ch.role is not null and v_ch.role <> v_me.role then return; end if;
    v_from := v_ch.starts_at;
    v_to := v_ch.ends_at;
    v_role := v_ch.role;
  else
    return;
  end if;

  return query
  select cr.alias,
         (count(distinct s.user_id) filter (where k.id is not null))::integer,
         (rank() over (order by count(distinct s.user_id) filter (where k.id is not null) desc))::integer,
         cr.user_id is not distinct from v_uid
  from public.creators cr
  left join public.store_sales s
    on s.creator_id = cr.id and s.purchased_at >= v_from and s.purchased_at < v_to and s.payment_number = 1
  left join public.commissions k
    on k.sale_id = s.id and k.status <> 'anulada'
  where cr.active and (v_role is null or cr.role = v_role)
  group by cr.id, cr.alias, cr.user_id
  order by 3, 1
  limit 50;
end;
$$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.creator_progress() from public, anon;
revoke all on function public.creator_sales_history(integer) from public, anon;
revoke all on function public.creator_board_period(text) from public, anon;
grant execute on function public.creator_progress() to authenticated;
grant execute on function public.creator_sales_history(integer) to authenticated;
grant execute on function public.creator_board_period(text) to authenticated;

notify pgrst, 'reload schema';

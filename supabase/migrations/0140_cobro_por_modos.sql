-- 0140 · El cobro por modos: diez productos, un derecho por modo y su freno.
-- Huella: to_regprocedure('public.mis_modos()') is not null
--
-- Decisión del dueño para la 1.1: se paga por modo. Un modo, 14,99 € al mes o
-- 59,99 € al año; los cuatro, 30 € al mes o 99 € al año. El anual lleva 7 días
-- gratis (oferta introductoria de la tienda). Espejo puro y sus tests en
-- src/lib/planesmodo.ts; si tocas uno, toca el otro.
--
-- Qué NO hace, a propósito:
--   · No borra ni oculta datos de un modo: solo decide quién entra.
--   · No toca a quien pagó Pro o Élite: sus planes abren los cuatro modos hasta
--     que caduquen.
--   · No cambia las comisiones de creadores: los productos nuevos usan la base
--     de `creator_settings`, como los demás.
--   · No retoca ai_state ni ai_begin_turn: la caducidad la sigue decidiendo
--     ai_state y el coach pregunta por el modo antes de cruzar la puerta.
begin;

-- ── 1. Los planes ──────────────────────────────────────────────────
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check check (plan in (
  'mensual', 'anual',                 -- heredados (Stripe): son Pro
  'pro_mensual', 'pro_anual',
  'elite_mensual', 'elite_anual', 'elite_fundador',
  'cortesia', 'owner',
  'prueba_auto',
  'iron_mensual', 'iron_anual',
  'focus_mensual', 'focus_anual',
  'work_mensual', 'work_anual',
  'founder_mensual', 'founder_anual',
  'todos_mensual', 'todos_anual'
));

-- ── 2. Qué abre cada plan, y el freno ──────────────────────────────
alter table public.ai_plans add column if not exists modos text[] not null default '{}';
comment on column public.ai_plans.modos is
  'Los modos que abre el plan mientras dure (0140). Un plan sin modos no abre ningún mundo de pago.';

update public.ai_plans set modos = array['iron', 'focus', 'work', 'founder']
where plan in ('mensual', 'anual', 'pro_mensual', 'pro_anual',
  'elite_mensual', 'elite_anual', 'elite_fundador', 'cortesia', 'owner', 'prueba_auto');

-- El freno antiabuso de la 0090, con su misma cuenta: como mucho lo que queda
-- al mes de la cuota, sin IVA del 21 %, con la comisión del 15 % de la tienda y
-- a 1 $ = 0,93 €, redondeado hacia abajo (docs/PRECIOS.md). Cambiar un valor es
-- un UPDATE. Sin bolsillo profundo: Élite desaparece y hay un solo modelo.
--   14,99 €/mes  → 10,53 € limpios   → 11,32 $ → 11 $
--   59,99 €/año  → 3,51 € al mes     →  3,78 $ →  3,50 $
--   30 €/mes     → 21,07 € limpios   → 22,66 $ → 22 $
--   99 €/año     → 5,80 € al mes     →  6,23 $ →  6 $
insert into public.ai_plans (plan, monthly_budget_micro_usd, deep_budget_micro_usd, tier, routes, modos) values
  ('iron_mensual',    11000000, 0, 'pro', '{"default":"claude-haiku-5-5"}', array['iron']),
  ('iron_anual',       3500000, 0, 'pro', '{"default":"claude-haiku-5-5"}', array['iron']),
  ('focus_mensual',   11000000, 0, 'pro', '{"default":"claude-haiku-5-5"}', array['focus']),
  ('focus_anual',      3500000, 0, 'pro', '{"default":"claude-haiku-5-5"}', array['focus']),
  ('work_mensual',    11000000, 0, 'pro', '{"default":"claude-haiku-5-5"}', array['work']),
  ('work_anual',       3500000, 0, 'pro', '{"default":"claude-haiku-5-5"}', array['work']),
  ('founder_mensual', 11000000, 0, 'pro', '{"default":"claude-haiku-5-5"}', array['founder']),
  ('founder_anual',    3500000, 0, 'pro', '{"default":"claude-haiku-5-5"}', array['founder']),
  ('todos_mensual',   22000000, 0, 'pro', '{"default":"claude-haiku-5-5"}', array['iron', 'focus', 'work', 'founder']),
  ('todos_anual',      6000000, 0, 'pro', '{"default":"claude-haiku-5-5"}', array['iron', 'focus', 'work', 'founder'])
on conflict (plan) do update set
  monthly_budget_micro_usd = excluded.monthly_budget_micro_usd,
  deep_budget_micro_usd = excluded.deep_budget_micro_usd,
  tier = excluded.tier,
  routes = excluded.routes,
  modos = excluded.modos;

-- ── 3. El catálogo de tienda ───────────────────────────────────────
alter table public.store_products add column if not exists modos text[] not null default '{}';
comment on column public.store_products.modos is
  'Los modos que abre el producto (0140). Manda sobre el plan en compras de tienda: la prueba del anual se guarda como cortesia.';

update public.store_products set modos = array['iron', 'focus', 'work', 'founder']
where product_id in ('nivl_pro_mensual', 'nivl_pro_anual', 'nivl_elite_mensual', 'nivl_elite_anual', 'nivl_elite_fundador');

-- `tier` solo ordena en apply_store_reconciliation qué compra activa manda: si
-- hubiera dos (otra tienda, otro dispositivo), la de los cuatro modos gana a la
-- de uno. Por eso `todos` es 'elite' aquí, y 'pro' en ai_plans (lo que ve la app).
-- Tope sin SBP: el mismo 35 % que el Pro anual, el anual de menor ingreso que había.
insert into public.store_products (product_id, plan, tier, period, commission_base_cents, max_pct_without_sbp, max_seats, modos) values
  ('nivl_iron_mensual', 'iron_mensual', 'pro', 'mensual', null, null, null, array['iron']),
  ('nivl_iron_anual', 'iron_anual', 'pro', 'anual', null, 35, null, array['iron']),
  ('nivl_focus_mensual', 'focus_mensual', 'pro', 'mensual', null, null, null, array['focus']),
  ('nivl_focus_anual', 'focus_anual', 'pro', 'anual', null, 35, null, array['focus']),
  ('nivl_work_mensual', 'work_mensual', 'pro', 'mensual', null, null, null, array['work']),
  ('nivl_work_anual', 'work_anual', 'pro', 'anual', null, 35, null, array['work']),
  ('nivl_founder_mensual', 'founder_mensual', 'pro', 'mensual', null, null, null, array['founder']),
  ('nivl_founder_anual', 'founder_anual', 'pro', 'anual', null, 35, null, array['founder']),
  ('nivl_todos_mensual', 'todos_mensual', 'elite', 'mensual', null, null, null, array['iron', 'focus', 'work', 'founder']),
  ('nivl_todos_anual', 'todos_anual', 'elite', 'anual', null, 35, null, array['iron', 'focus', 'work', 'founder'])
on conflict (product_id) do update set
  plan = excluded.plan,
  tier = excluded.tier,
  period = excluded.period,
  max_pct_without_sbp = excluded.max_pct_without_sbp,
  modos = excluded.modos;

-- ── 4. El derecho ──────────────────────────────────────────────────
-- Cerrado por defecto: sin suscripción viva o con un plan desconocido, ninguno.
create or replace function public.ai_modos(p_user uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_sub public.subscriptions;
  v_modos text[];
begin
  if not coalesce((public.ai_state(p_user)->>'entitled')::boolean, false) then
    return '{}'::text[];
  end if;
  select * into v_sub from public.subscriptions where user_id = p_user;
  -- La prueba del anual llega como plan 'cortesia' (0033): manda el producto.
  if v_sub.provider in ('apple', 'google') and v_sub.plan <> 'owner' then
    select modos into v_modos from public.store_products where product_id = v_sub.store_product_id;
    if v_modos is not null then return v_modos; end if;
  end if;
  select modos into v_modos from public.ai_plans where plan = v_sub.plan;
  return coalesce(v_modos, '{}'::text[]);
end;
$$;
revoke all on function public.ai_modos(uuid) from public, anon, authenticated;
grant execute on function public.ai_modos(uuid) to service_role;

-- Lo que pregunta la app. Solo informa: el candado es `ai_modos` en el servidor.
create or replace function public.mis_modos()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_sub public.subscriptions;
  v_modos text[];
begin
  if v_user is null then
    return jsonb_build_object('modos', '[]'::jsonb);
  end if;
  v_modos := public.ai_modos(v_user);
  select * into v_sub from public.subscriptions where user_id = v_user;
  return jsonb_build_object(
    'modos', to_jsonb(v_modos),
    'plan', case when cardinality(v_modos) > 0 then v_sub.plan end,
    'producto', case when cardinality(v_modos) > 0 then v_sub.store_product_id end,
    'expira', case when cardinality(v_modos) > 0 then v_sub.current_period_end end,
    'trial', cardinality(v_modos) > 0 and v_sub.status = 'trialing'
  );
end;
$$;
revoke all on function public.mis_modos() from public, anon;
grant execute on function public.mis_modos() to authenticated, service_role;
comment on function public.mis_modos() is 'Los modos que tiene la cuenta. nivl:cobro-modos-0140';

notify pgrst, 'reload schema';

commit;

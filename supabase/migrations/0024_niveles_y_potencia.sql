-- NIVL · 0024 — Tres niveles y dos potencias de IA.
--
-- Extiende el candado de 0020; no lo sustituye. Cada plan de ai_plans lleva
-- ahora su nivel, un bolsillo de presupuesto PROFUNDO separado del estándar y
-- un mapa de modelos por ritual (routes). El proveedor lo deduce la función
-- `coach` del nombre del modelo (claude-* → Anthropic; el resto → la API
-- compatible de COACH_BASE_URL), así que Pro (DeepSeek) y Élite (Anthropic)
-- conviven. Los bolsillos son separados para que "te quedan N turnos
-- profundos" no mienta: el chat estándar no se come el profundo.
--
-- Decisiones del dueño aplicadas (docs/PLAN_NIVELES_Y_CREADORES.md §11):
--   · Las cortesías antiguas (0020) bajan a 0,50 $ y a DeepSeek con todos;
--     no hay plan histórico. El owner queda con su presupuesto de 40 $.
--   · Élite = 4,00 $: 2,50 $ estándar + 1,50 $ profundo.
--   · Profundo y revisión semanal del Élite con Sonnet a esfuerzo 'xhigh'
--     (más turnos antes que el modelo top). La revisión semanal ya piensa en
--     'xhigh' por su kind; el profundo lo fija la función.
--
-- Idempotente: se puede ejecutar dos veces sin cambiar nada la segunda.
-- Si cambias un presupuesto, rehaz docs/PRECIOS.md (fuente de verdad).

-- ── Planes ─────────────────────────────────────────────────────────
-- La prueba de 7 días NO es un plan: es 'cortesia' con status 'trialing' y
-- current_period_end a siete días (docs/PRECIOS.md).
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check check (plan in (
  'mensual', 'anual',                 -- heredados (Stripe): son Pro
  'pro_mensual', 'pro_anual',
  'elite_mensual', 'elite_anual', 'elite_fundador',
  'cortesia', 'owner'
));

alter table public.ai_plans
  add column if not exists tier text not null default 'pro',
  add column if not exists deep_budget_micro_usd bigint not null default 0,
  add column if not exists deep_turn_estimate_micro_usd bigint not null default 220000,
  add column if not exists routes jsonb not null default '{}'::jsonb;

alter table public.ai_plans drop constraint if exists ai_plans_tier_check;
alter table public.ai_plans add constraint ai_plans_tier_check
  check (tier in ('pro', 'elite', 'owner'));
alter table public.ai_plans drop constraint if exists ai_plans_deep_check;
alter table public.ai_plans add constraint ai_plans_deep_check check (
  deep_budget_micro_usd >= 0
  and deep_budget_micro_usd <= monthly_budget_micro_usd
  and deep_turn_estimate_micro_usd > 0
);
alter table public.ai_plans drop constraint if exists ai_plans_routes_check;
alter table public.ai_plans add constraint ai_plans_routes_check
  check (jsonb_typeof(routes) = 'object');

-- Claves de routes: 'default', cualquier kind del coach (chat, brief, plan,
-- revision_semanal, cierre_mensual, escalada) y 'profundo'. Sin 'profundo' no
-- hay modo profundo. Sin 'default' ni el kind, la función usa los secrets
-- COACH_MODEL_* (es lo que hace el owner).
--
-- El profundo del Élite es Sonnet, igual que su estándar: lo que cambia es el
-- esfuerzo ('xhigh') y el techo de salida, que pone la función. La estimación
-- por turno (0,22 $) es la de Sonnet pensando a fondo en la cuenta pesada; en
-- cuanto el usuario tiene diez turnos propios, manda su media real.
insert into public.ai_plans
  (plan, tier, monthly_budget_micro_usd, deep_budget_micro_usd, deep_turn_estimate_micro_usd, routes)
values
  ('pro_mensual', 'pro', 1500000, 0, 220000, '{"default":"deepseek-v4-flash"}'),
  ('pro_anual', 'pro', 1500000, 0, 220000, '{"default":"deepseek-v4-flash"}'),
  ('elite_mensual', 'elite', 4000000, 1500000, 220000,
    '{"default":"claude-sonnet-5","profundo":"claude-sonnet-5"}'),
  ('elite_anual', 'elite', 4000000, 1500000, 220000,
    '{"default":"claude-sonnet-5","profundo":"claude-sonnet-5"}'),
  ('elite_fundador', 'elite', 4000000, 1500000, 220000,
    '{"default":"claude-sonnet-5","profundo":"claude-sonnet-5"}')
on conflict (plan) do nothing;

-- Los que ya existían. Solo si nadie los ha tocado a mano (routes vacío): así
-- la segunda ejecución no pisa un ajuste hecho con un update.
-- Los heredados de Stripe pasan a ser Pro con el presupuesto de Pro.
update public.ai_plans
set tier = 'pro', monthly_budget_micro_usd = 1500000, deep_budget_micro_usd = 0,
    routes = '{"default":"deepseek-v4-flash"}'
where plan in ('mensual', 'anual') and routes = '{}'::jsonb;

-- Cortesía = la prueba: 0,50 $ (PRECIOS.md). Afecta también a las cortesías
-- indefinidas de la 0020: decidido que bajan con todos (§11.1).
update public.ai_plans
set tier = 'pro', monthly_budget_micro_usd = 500000, deep_budget_micro_usd = 0,
    routes = '{"default":"deepseek-v4-flash"}'
where plan = 'cortesia' and routes = '{}'::jsonb;

-- El owner conserva sus 40 $ y sus modelos de los secrets; gana un bolsillo
-- profundo de 10 $ para poder probar el modo con su propia cuenta.
update public.ai_plans
-- least(): si alguien bajó a mano el mensual del owner por debajo de 10 $, el
-- CHECK de arriba (profundo <= mensual) no tumba la migración.
set tier = 'owner', deep_budget_micro_usd = least(10000000, monthly_budget_micro_usd),
    routes = '{"profundo":"claude-sonnet-5"}'
where plan = 'owner' and routes = '{}'::jsonb;

-- ── El libro de cuentas ────────────────────────────────────────────
-- El CHECK de 0008 no admitía 'clasificar' ni 'resumen_*': esos inserts
-- fallaban y su coste NO entraba en el candado. NOT VALID por si producción
-- tiene filas que no casan: las nuevas sí se comprueban.
alter table public.coach_runs drop constraint if exists coach_runs_kind_check;
alter table public.coach_runs add constraint coach_runs_kind_check check (kind in (
  'chat', 'brief', 'plan', 'revision_semanal', 'cierre_mensual', 'import', 'escalada',
  'clasificar', 'resumen_semanal', 'resumen_mensual'
)) not valid;

alter table public.coach_runs
  add column if not exists mode text not null default 'estandar';
alter table public.coach_runs drop constraint if exists coach_runs_mode_check;
alter table public.coach_runs add constraint coach_runs_mode_check
  check (mode in ('estandar', 'profundo'));
create index if not exists coach_runs_user_mode_idx
  on public.coach_runs (user_id, mode, created_at desc);

-- ── Estado ─────────────────────────────────────────────────────────
-- 'budget', 'spent' y 'remaining' pasan a ser del bolsillo ESTÁNDAR (la barra
-- de energía y el cron de rituales siguen leyendo esos campos). El profundo va
-- aparte y se enseña en turnos, no en dinero.
--
-- La prueba es SOLO 'cortesia' + 'trialing': un 'trialing' de Stripe (si lo
-- hubiera) sigue con su mes natural y sus dos días de gracia, como en 0020.
create or replace function public.ai_state(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_sub public.subscriptions;
  v_plan public.ai_plans;
  v_trial boolean;
  v_entitled boolean;
  v_since timestamptz;
  v_renews timestamptz;
  v_std_budget bigint;
  v_deep_budget bigint;
  v_std_spent bigint;
  v_deep_spent bigint;
  v_std_left bigint;
  v_deep_left bigint;
  v_avg bigint;
begin
  select * into v_sub from public.subscriptions where user_id = p_user;

  v_trial := v_sub.user_id is not null
    and v_sub.status = 'trialing'
    and v_sub.plan = 'cortesia';

  -- La prueba no tiene los dos días de gracia: existen porque los webhooks de
  -- renovación llegan tarde, y una prueba no se renueva.
  v_entitled := v_sub.user_id is not null
    and v_sub.status in ('active', 'trialing')
    and case
      when v_trial then coalesce(v_sub.current_period_end > now(), false)
      else v_sub.current_period_end is null
        or v_sub.current_period_end > now() - interval '2 days'
    end;

  if not coalesce(v_entitled, false) then
    return jsonb_build_object(
      'entitled', false, 'plan', null, 'tier', 'free', 'trial', false,
      'budget', 0, 'spent', 0, 'remaining', 0,
      'deep_allowed', false, 'deep_budget', 0, 'deep_remaining', 0, 'deep_turns', 0,
      -- Una prueba por cuenta: quien ya tuvo fila (prueba, cortesía o pago) no.
      'trial_available', v_sub.user_id is null,
      'routes', '{}'::jsonb
    );
  end if;

  select * into v_plan from public.ai_plans where plan = v_sub.plan;
  v_deep_budget := coalesce(v_plan.deep_budget_micro_usd, 0);
  v_std_budget := greatest(0, coalesce(v_plan.monthly_budget_micro_usd, 0) - v_deep_budget);

  if v_trial then
    v_since := v_sub.current_period_end - interval '7 days';
    v_renews := v_sub.current_period_end;
  else
    v_since := date_trunc('month', now());
    v_renews := date_trunc('month', now()) + interval '1 month';
  end if;

  select
    coalesce(sum(cost_micro_usd) filter (where mode = 'estandar'), 0),
    coalesce(sum(cost_micro_usd) filter (where mode = 'profundo'), 0)
  into v_std_spent, v_deep_spent
  from public.coach_runs
  where user_id = p_user and created_at >= v_since;

  v_std_left := greatest(0, v_std_budget - v_std_spent);
  v_deep_left := greatest(0, v_deep_budget - v_deep_spent);

  -- "Te quedan N turnos profundos": con la media real de SUS últimos diez, y
  -- con la estimación del plan mientras no tenga historia.
  select avg(t.cost_micro_usd)::bigint into v_avg
  from (
    select cost_micro_usd from public.coach_runs
    where user_id = p_user and mode = 'profundo' and error is null and cost_micro_usd > 0
    order by created_at desc
    limit 10
  ) t;
  v_avg := greatest(coalesce(v_avg, v_plan.deep_turn_estimate_micro_usd, 220000), 20000);

  return jsonb_build_object(
    'entitled', true,
    'plan', v_sub.plan,
    'tier', coalesce(v_plan.tier, 'pro'),
    'trial', v_trial,
    'budget', v_std_budget,
    'spent', v_std_spent,
    'remaining', v_std_left,
    'renews', to_char(v_renews, 'YYYY-MM-DD'),
    'deep_allowed', v_deep_budget > 0 and coalesce(v_plan.routes ? 'profundo', false),
    'deep_budget', v_deep_budget,
    'deep_remaining', v_deep_left,
    'deep_turns', (v_deep_left / v_avg)::integer,
    'trial_available', false,
    'routes', coalesce(v_plan.routes, '{}'::jsonb)
  );
end;
$$;

-- ── La puerta, ahora con modo ──────────────────────────────────────
-- Primero se borra la de un argumento y después se crea la de dos: si
-- convivieran, una llamada con solo { p_user } sería ambigua para Postgres y
-- la puerta fallaría (y la función `coach` cierra por defecto: 503 a todos).
-- Todo va en la misma transacción, así que nadie ve el hueco. La función
-- `coach` ya desplegada llama con { p_user } y resuelve a la nueva por el
-- valor por defecto: la migración puede ir antes que el despliegue.
drop function if exists public.ai_begin_turn(uuid);

create or replace function public.ai_begin_turn(p_user uuid, p_mode text default 'estandar')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_locked uuid;
  -- Cualquier cosa que no sea exactamente 'profundo' es estándar: un valor
  -- raro nunca abre el bolsillo caro.
  v_mode text := case when p_mode = 'profundo' then 'profundo' else 'estandar' end;
  v_left bigint;
begin
  v_state := public.ai_state(p_user);

  -- Cerrado por defecto: sin derecho claro (o sin respuesta), no hay turno.
  if not coalesce((v_state->>'entitled')::boolean, false) then
    return v_state || jsonb_build_object('allowed', false, 'reason', 'sin_suscripcion');
  end if;

  if v_mode = 'profundo' then
    if not coalesce((v_state->>'deep_allowed')::boolean, false) then
      return v_state || jsonb_build_object('allowed', false, 'reason', 'profundo_no_incluido');
    end if;
    v_left := coalesce((v_state->>'deep_remaining')::bigint, 0);
    if v_left < 20000 then
      return v_state || jsonb_build_object('allowed', false, 'reason', 'profundo_agotado');
    end if;
  else
    -- Por debajo de 2 céntimos no cabe ni la llamada más barata.
    v_left := coalesce((v_state->>'remaining')::bigint, 0);
    if v_left < 20000 then
      return v_state || jsonb_build_object('allowed', false, 'reason', 'presupuesto_agotado');
    end if;
  end if;

  -- Un turno a la vez (estándar y profundo comparten cerrojo). Un cerrojo de
  -- más de 4 minutos es de una función que murió sin soltarlo: se pisa.
  insert into public.ai_turn_locks (user_id, started_at)
  values (p_user, now())
  on conflict (user_id) do update
    set started_at = now()
    where public.ai_turn_locks.started_at < now() - interval '4 minutes'
  returning user_id into v_locked;

  if v_locked is null then
    return v_state || jsonb_build_object('allowed', false, 'reason', 'turno_en_curso');
  end if;

  return v_state || jsonb_build_object('allowed', true, 'mode', v_mode, 'turn_budget', v_left);
end;
$$;

-- Lo que ve la app: sin el mapa de modelos (no es secreto, pero no es suyo).
create or replace function public.ai_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.ai_state(auth.uid()) - 'routes';
$$;

-- ── Prueba de 7 días, sin tienda ───────────────────────────────────
-- Una por cuenta: solo si la cuenta nunca tuvo fila en subscriptions. El
-- abuso con cuentas nuevas está acotado a 0,50 $ cada una (plan cortesía), y
-- cada cuenta pasa por el alta de Franky.
create or replace function public.start_trial()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ins uuid;
  v_end timestamptz := now() + interval '7 days';
begin
  if v_uid is null then raise exception 'No autenticado'; end if;

  insert into public.subscriptions (user_id, status, plan, provider, current_period_end)
  values (v_uid, 'trialing', 'cortesia', 'manual', v_end)
  on conflict (user_id) do nothing
  returning user_id into v_ins;

  if v_ins is null then
    return jsonb_build_object('ok', false, 'reason', 'ya_usada');
  end if;

  insert into public.events (user_id, type, payload)
  values (v_uid, 'trial_started', jsonb_build_object('ends', v_end));

  return jsonb_build_object('ok', true, 'ends', to_char(v_end, 'YYYY-MM-DD'));
end;
$$;

-- ── Nivel de una cuenta (barato: sin sumar coach_runs) ──────────────
-- Misma regla de derecho que ai_state: la prueba sin días de gracia.
create or replace function public.user_tier(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.tier
    from public.subscriptions s
    join public.ai_plans p on p.plan = s.plan
    where s.user_id = p_user
      and s.status in ('active', 'trialing')
      and case
        when s.status = 'trialing' and s.plan = 'cortesia'
          then coalesce(s.current_period_end > now(), false)
        else s.current_period_end is null
          or s.current_period_end > now() - interval '2 days'
      end
  ), 'free');
$$;

-- ── Permisos ────────────────────────────────────────────────────────
-- Las funciones NUEVAS (la puerta de dos argumentos, start_trial, user_tier)
-- nacen con EXECUTE para PUBLIC y, en Supabase, para anon y authenticated: se
-- revoca todo y se concede solo lo que toca, igual que en 0020.
revoke all on function public.ai_begin_turn(uuid, text) from public, anon, authenticated;
grant execute on function public.ai_begin_turn(uuid, text) to service_role;
revoke all on function public.start_trial() from public, anon;
grant execute on function public.start_trial() to authenticated;
revoke all on function public.user_tier(uuid) from public, anon, authenticated;
grant execute on function public.user_tier(uuid) to service_role;
-- ai_state y ai_status ya existían: create or replace conserva sus permisos de
-- 0020, pero se repiten para que esta migración se sostenga sola.
revoke all on function public.ai_state(uuid) from public, anon, authenticated;
grant execute on function public.ai_state(uuid) to service_role;
revoke all on function public.ai_status() from public, anon;
grant execute on function public.ai_status() to authenticated;

notify pgrst, 'reload schema';

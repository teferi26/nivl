-- NIVL · 0069 · Prueba automática de 2 días al registrarse (Modos, fase 1; contrato MODOS-F1-CONTRATO.md,
-- 18/10/2026; spec NIVL_MODOS_PROPUESTA.md §6, fase A «2 días gratis para todos»).
-- Huella para scripts/apply-migrations.mjs:
--   coalesce(obj_description(to_regprocedure('public.ai_begin_turn(uuid,text)'), 'pg_proc') like '%nivl:prueba-auto-0069%', false)
-- Prueba: scripts/test-modos-f1.mjs (PGlite, todas las migraciones reales: matriz de ai_state/user_tier/
-- ai_begin_turn idéntica a la 0024 para todo lo que no es la prueba, la prueba no pisa una compra, una
-- compra sustituye a la prueba) y scripts/probar-f1-servidor.sql (BEGIN…ROLLBACK).
--
-- APAGADA POR DEFECTO: solo nace una prueba si app_config.prueba_auto_activa vale EXACTAMENTE true (0067).
-- Sin fila, con otro valor o si la lectura falla: no hay prueba. Encender y apagar es un UPDATE, sin build.
--
-- Qué es la prueba:
--   · subscriptions(plan 'prueba_auto', status 'trialing', provider 'prueba', current_period_end = alta +
--     prueba_auto_dias días). Nace en un trigger AFTER INSERT de profiles (handle_new_user no se toca) y
--     SOLO si la cuenta no tiene ya fila en subscriptions (ON CONFLICT DO NOTHING): nunca pisa una compra,
--     una cortesía ni al owner. Cualquier fallo se traga: el alta de la cuenta no puede romperse por esto.
--   · Plan 'prueba_auto' en ai_plans: tier 'elite' (las funciones de Pro y Élite), pero todo con
--     claude-haiku-4-5 (routes default y registro), sin modo profundo (deep 0: Haiku no admite el esfuerzo
--     'xhigh' del profundo) y con un presupuesto total de la prueba de 1,00 $ (un UPDATE lo cambia).
--   · Tope diario de mensajes en el servidor: ai_begin_turn cuenta los turnos de chat de HOY (día local del
--     perfil, safe_tz) sin error y, si llegan a app_config.prueba_ia_mensajes_dia, responde
--     reason 'tope_diario'. La función coach lo devuelve como 402 'presupuesto_agotado' con su propio texto
--     (la 1.0.9 ya pinta ese motivo con el mensaje del servidor).
--
-- Por qué provider 'prueba' y no 'manual':
--   · apply_store_reconciliation (0036) CONSERVA las concesiones provider manual|stripe vigentes frente a
--     compras de sandbox (TestFlight, revisión de Apple) y de nivel igual o inferior. Con 'manual', quien
--     compra durante la prueba se quedaría en la prueba hasta que caducase. Con 'prueba', cualquier compra
--     verificada la sustituye, y sin derecho de tienda la fila se conserva tal cual (no se cancela).
--   · apply_store_event (0027) ya sobrescribe cualquier fila que no sea del owner ni de tienda más larga.
--   · stripeMayTakeOver (_shared/store-stripe.ts) deja que Stripe sustituya a la prueba (cambio en TS).
--
-- Funciones existentes que se reemplazan, con LA MISMA FIRMA, permisos y resultado para todo lo que no es
-- 'prueba_auto' (copia literal de la 0024 con el cambio marcado «0069»; el test compara la matriz entera):
--   · ai_state(uuid): la prueba es 'cortesia' O 'prueba_auto' en 'trialing' (sin días de gracia). Para la
--     prueba automática el gasto cuenta desde siempre (la cuenta nació con ella) y añade dos claves SOLO
--     para ese plan: tope_dia y mensajes_hoy.
--   · ai_begin_turn(uuid, text): el tope diario, solo para 'prueba_auto'.
--   · user_tier(uuid): misma regla de prueba sin gracia que ai_state.
--   · ai_status() (0058) no se toca: lee ai_state.
--
-- Compatibilidad con la 1.0.9: con el interruptor apagado no nace ninguna fila nueva y todo responde igual.
-- Encendido, la 1.0.9 ve plan 'prueba_auto' (planLabel lo pinta como «NIVL Pro», planDePago=false),
-- trial=true y renews = fin de la prueba; start_trial() devuelve 'ya_usada' (una prueba por cuenta).
--
-- Marcha atrás: apagar basta (`update app_config set value='false' where key='prueba_auto_activa'`).
-- Para quitarla del todo: drop trigger prueba_auto_al_nacer on public.profiles; re-ejecutar los bloques
-- ai_state / ai_begin_turn / user_tier de la 0024; cancelar las filas plan='prueba_auto' que queden y
-- después borrar el plan y devolver los CHECK de plan y provider a los valores de la 0024/0020.
-- Re-ejecutable.
begin;

-- ── 1. Valores admitidos ────────────────────────────────────────────
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check check (plan in (
  'mensual', 'anual',                 -- heredados (Stripe): son Pro
  'pro_mensual', 'pro_anual',
  'elite_mensual', 'elite_anual', 'elite_fundador',
  'cortesia', 'owner',
  'prueba_auto'                       -- 0069: la prueba automática al registrarse
));

alter table public.subscriptions drop constraint if exists subscriptions_provider_check;
alter table public.subscriptions add constraint subscriptions_provider_check
  check (provider in ('stripe', 'apple', 'google', 'manual', 'prueba'));

-- ── 2. El plan ──────────────────────────────────────────────────────
insert into public.ai_plans
  (plan, tier, monthly_budget_micro_usd, deep_budget_micro_usd, deep_turn_estimate_micro_usd, routes)
values
  ('prueba_auto', 'elite', 1000000, 0, 220000,
    '{"default":"claude-haiku-4-5","registro":"claude-haiku-4-5"}')
on conflict (plan) do nothing;

-- ── 3. Estado de la IA (copia de la 0024; cambios marcados «0069») ──
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
  v_out jsonb;
begin
  select * into v_sub from public.subscriptions where user_id = p_user;

  -- 0069: la prueba automática es una prueba como la de 7 días (sin días de gracia).
  v_trial := v_sub.user_id is not null
    and v_sub.status = 'trialing'
    and v_sub.plan in ('cortesia', 'prueba_auto');

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

  if v_trial and v_sub.plan = 'prueba_auto' then
    -- 0069: la cuenta nació con la prueba; su presupuesto es para toda la prueba.
    v_since := '-infinity'::timestamptz;
    v_renews := v_sub.current_period_end;
  elsif v_trial then
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

  v_out := jsonb_build_object(
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

  -- 0069: el tope diario de mensajes, solo en la prueba automática (el resto de planes, sin claves nuevas).
  if v_sub.plan = 'prueba_auto' then
    v_out := v_out || jsonb_build_object(
      'tope_dia', public._prueba_tope_dia(),
      'mensajes_hoy', public._prueba_mensajes_hoy(p_user)
    );
  end if;
  return v_out;
end;
$$;

-- Tope diario configurado: un número entero entre 0 y 500. Otra cosa (o sin fila) → 20, el del contrato.
create or replace function public._prueba_tope_dia() returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when jsonb_typeof(v) = 'number' then least(500, greatest(0, floor((v #>> '{}')::numeric)::integer))
    else 20 end
  from (select public.app_config_value('prueba_ia_mensajes_dia', '20'::jsonb) as v) c;
$$;

-- Turnos de chat de hoy (día local del perfil) que han salido bien. Los rituales del cron no cuentan.
create or replace function public._prueba_mensajes_hoy(p_user uuid) returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::integer
  from public.coach_runs r
  where r.user_id = p_user
    and r.kind = 'chat'
    and r.error is null
    and r.created_at >= coalesce(
      (select date_trunc('day', now() at time zone public.safe_tz(p.timezone)) at time zone public.safe_tz(p.timezone)
         from public.profiles p where p.id = p_user),
      date_trunc('day', now())
    );
$$;

-- ── 4. La puerta (copia de la 0024; cambio marcado «0069») ─────────
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

  -- 0069: la prueba automática tiene un tope diario de mensajes. Sin dato fiable, cerrado.
  if v_state->>'plan' = 'prueba_auto'
     and coalesce((v_state->>'mensajes_hoy')::integer, 0) >= coalesce((v_state->>'tope_dia')::integer, 0) then
    return v_state || jsonb_build_object('allowed', false, 'reason', 'tope_diario');
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

-- ── 5. Nivel de una cuenta (copia de la 0024; cambio marcado «0069») ─
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
        -- 0069: la prueba automática, sin gracia, como la de 7 días.
        when s.status = 'trialing' and s.plan in ('cortesia', 'prueba_auto')
          then coalesce(s.current_period_end > now(), false)
        else s.current_period_end is null
          or s.current_period_end > now() - interval '2 days'
      end
  ), 'free');
$$;

-- ── 6. La prueba nace con el perfil (solo con el interruptor encendido) ──
create or replace function public._prueba_auto_al_nacer() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_dias jsonb;
  v_n integer;
begin
  begin
    -- Solo el booleano true enciende. Cualquier otro valor, o sin fila: apagado.
    if public.app_config_value('prueba_auto_activa', 'false'::jsonb) is distinct from 'true'::jsonb then
      return null;
    end if;
    v_dias := public.app_config_value('prueba_auto_dias', '2'::jsonb);
    if jsonb_typeof(v_dias) is distinct from 'number' then return null; end if;
    v_n := least(14, greatest(1, floor((v_dias #>> '{}')::numeric)::integer));
    -- Nunca pisa nada: si ya hay fila (compra, cortesía, owner, prueba), no hace nada.
    insert into public.subscriptions (user_id, status, plan, provider, current_period_end, updated_at)
    values (new.id, 'trialing', 'prueba_auto', 'prueba', now() + make_interval(days => v_n), now())
    on conflict (user_id) do nothing;
  exception when others then
    -- El alta de la cuenta no se rompe por la prueba.
    raise warning 'prueba_auto: no se pudo crear la prueba (%)', sqlstate;
  end;
  return null;
end $$;
revoke all on function public._prueba_auto_al_nacer() from public, anon, authenticated;
drop trigger if exists prueba_auto_al_nacer on public.profiles;
create trigger prueba_auto_al_nacer after insert on public.profiles
  for each row execute function public._prueba_auto_al_nacer();

-- ── 7. El gasto de la prueba, para la alerta del 70 % del crédito ──
-- Solo servidor. Cuántas pruebas hay vivas y cuánto ha gastado la IA de cuentas en prueba automática.
create or replace function public.prueba_auto_resumen() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'activa', public.app_config_value('prueba_auto_activa', 'false'::jsonb) = 'true'::jsonb,
    'pruebas_vivas', (select count(*) from public.subscriptions s
      where s.plan = 'prueba_auto' and s.status = 'trialing' and s.current_period_end > now()),
    'pruebas_total', (select count(*) from public.subscriptions s where s.plan = 'prueba_auto'),
    'gasto_micro_usd', (select coalesce(sum(r.cost_micro_usd), 0) from public.coach_runs r
      join public.subscriptions s on s.user_id = r.user_id
      where s.plan = 'prueba_auto' and r.created_at <= coalesce(s.current_period_end, now()))
  );
$$;

-- ── Permisos ────────────────────────────────────────────────────────
-- create or replace conserva los de 0020/0024, pero se repiten para que esta migración se sostenga sola.
revoke all on function public.ai_state(uuid) from public, anon, authenticated;
grant execute on function public.ai_state(uuid) to service_role;
revoke all on function public.ai_begin_turn(uuid, text) from public, anon, authenticated;
grant execute on function public.ai_begin_turn(uuid, text) to service_role;
revoke all on function public.user_tier(uuid) from public, anon, authenticated;
grant execute on function public.user_tier(uuid) to service_role;
revoke all on function public._prueba_tope_dia() from public, anon, authenticated;
revoke all on function public._prueba_mensajes_hoy(uuid) from public, anon, authenticated;
revoke all on function public.prueba_auto_resumen() from public, anon, authenticated;
grant execute on function public.prueba_auto_resumen() to service_role;
-- ai_status (0058) llama a ai_state como definer: sus permisos no cambian.

comment on function public.ai_begin_turn(uuid, text) is
  'nivl:prueba-auto-0069 · Puerta del coach (0024) + tope diario de mensajes de la prueba automática.';
comment on function public.ai_state(uuid) is
  'nivl:prueba-auto-0069 · Estado de IA (0024); prueba_auto = prueba sin gracia, con tope_dia y mensajes_hoy.';

notify pgrst, 'reload schema';
commit;

-- NIVL · 0078 · Tope duro y atómico del gasto de IA, por usuario, con reserva antes de llamar al modelo.
-- Huella para scripts/apply-migrations.mjs:
--   coalesce(obj_description(to_regprocedure('public.ai_reservar(uuid,text,text,bigint,uuid,text)'), 'pg_proc') like '%nivl:ia-tope-0078%', false)
-- Prueba: scripts/test-ia-tope-abuso.mjs (PGlite con TODAS las migraciones reales: miles de peticiones
-- concurrentes, varios dispositivos, reintentos y fallos a mitad; el gasto nunca pasa del tope).
-- Informe y decisión: coordinacion-winter-arc/COSTE_IA_ELITE.md (Teferi, 21/10/2026: «que nadie pase del
-- máximo de IA ni en abuso máximo»). Explicación para humanos: docs/IA_TOPE.md.
--
-- Por qué. Hasta aquí el candado (0020/0024/0069) miraba el gasto DESPUÉS de cada vuelta del modelo: el
-- último turno de cada bolsillo podía rebasarlo (~0,4-1,5 $ de exceso por mes), y los trabajos en segundo
-- plano (resumen del hilo, cron) no esperaban a nadie. Ahora cada LLAMADA al proveedor:
--   1. reserva ANTES su coste máximo posible (entrada acotada por los bytes de la petición, salida por
--      max_tokens, a la tarifa más cara de escritura de caché) con `ai_reservar`, que toma el cerrojo de la
--      fila del usuario en `ai_cartera` (SELECT … FOR UPDATE) y solo inserta la reserva si
--      gastado + reservado + esta reserva <= presupuesto. Dos peticiones a la vez (dos móviles, reintentos,
--      el cron y el chat) se ponen en fila en ese cerrojo: la segunda ya ve la reserva de la primera;
--   2. al terminar se liquida con el coste real (`ai_liquidar`): lo que sobra se libera. Si falla sin
--      cobrar (el proveedor responde error), se libera entera; si falla sin saber cuánto se cobró, se
--      queda cobrada entera (peca de caro, nunca de barato);
--   3. una reserva que nadie liquida en 15 minutos (función muerta) se da por cobrada entera.
-- Como la reserva es una cota superior del coste, el gasto real nunca puede pasar del presupuesto:
-- tolerancia 0 (ver docs/IA_TOPE.md para la cota).
--
-- Además:
--   · Topes por función (`ai_topes_funcion`): turnos al día por función y coste máximo por llamada.
--   · Reparto diario: el bolsillo estándar no se gasta a más de `ia_ritmo_factor` (3) veces el ritmo que
--     le queda al mes (lo restante ÷ días que faltan × 3). Las recargas compradas no tienen ritmo.
--   · Recargas de IA de pago (`ai_recargas`): créditos que suben el bolsillo estándar; lo que no se usa en un
--     mes pasa al siguiente. Se aplican con `apply_ai_recargas`, que SOLO llama el servidor con la
--     información de cliente verificada de RevenueCat (store-reconcile.ts). Producto: nivl_ia_recarga_1.
--   · Élite pasa a 8 $/mes (6 $ estándar + 2 $ profundo), decisión de Teferi del 21/10/2026.
--   · ai_state/ai_status: la recarga entra en el presupuesto y la app recibe `ia` (cuánto queda, ritmo).
--
-- Funciones que se reemplazan: ai_state(uuid) (copia literal de la 0069 con los cambios marcados «0078»)
-- y ai_status() (copia de la 0058 + la clave `ia`). ai_begin_turn y user_tier no se tocan.
-- Re-ejecutable. Orden de despliegue: ESTA migración antes que las funciones coach/ritual/oracle nuevas
-- (sin `ai_reservar` las funciones nuevas cierran: 503, nunca gastan sin tope).
begin;

-- ── 1. Configuración: topes por función ───────────────────────────────
create table if not exists public.ai_topes_funcion (
  funcion text primary key check (funcion ~ '^[a-z_]{2,40}$'),
  -- Turnos (no llamadas) por día UTC; null = sin tope de cantidad (lo frena el dinero).
  max_turnos_dia integer check (max_turnos_dia is null or max_turnos_dia >= 0),
  -- Lo más que puede reservar UNA llamada al modelo de esta función, en microdólares.
  max_micro_llamada bigint not null check (max_micro_llamada > 0 and max_micro_llamada <= 10000000)
);
alter table public.ai_topes_funcion enable row level security;
insert into public.ai_topes_funcion (funcion, max_turnos_dia, max_micro_llamada) values
  ('chat', null, 1200000),          -- el coach de siempre (Sonnet en Élite)
  ('registro', null, 200000),       -- partes rápidos (Haiku)
  ('profundo', 3, 2500000),         -- modo profundo: 3 al día
  ('ritual', 8, 1500000),           -- brief, plan, revisión, cierre, escalada (cron o a demanda)
  ('estudio', 50, 300000),          -- flashcards, resúmenes, mapas, extractos, dieta y entreno generados
  ('pdf', 10, 1000000),             -- apuntes en PDF (reservado para cuando exista)
  ('clasificar', 20, 300000),       -- clasificar movimientos
  ('resumen', 6, 300000),           -- resumen visual semanal/mensual
  ('resumen_hilo', 40, 150000),     -- compactar el hilo (segundo plano)
  ('checkin', 2, 80000),            -- pregunta proactiva del cron
  ('oracle', 20, 300000)            -- el Oráculo
on conflict (funcion) do nothing;

-- ── 2. La cartera: una fila por usuario (el cerrojo) y el libro de reservas ──
create table if not exists public.ai_cartera (
  user_id uuid primary key references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now()
);
alter table public.ai_cartera enable row level security;

create table if not exists public.ai_cargos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  funcion text not null references public.ai_topes_funcion (funcion),
  modo text not null check (modo in ('estandar', 'profundo')),
  -- Todas las llamadas de un mismo turno comparten turno (para los topes de turnos al día).
  turno uuid not null,
  -- Clave de idempotencia opcional: el mismo reintento no reserva dos veces.
  idem text check (idem is null or char_length(idem) between 8 and 120),
  reservado_micro bigint not null check (reservado_micro > 0),
  real_micro bigint check (real_micro is null or real_micro >= 0),
  -- Si el coste real pasó de la reserva (no debería: la reserva es una cota). Se apunta para vigilarlo.
  exceso_micro bigint not null default 0 check (exceso_micro >= 0),
  -- Presupuesto ESTÁNDAR del plan (sin recarga) al reservar: sirve para saber cuánta recarga se usó.
  tope_plan_micro bigint not null default 0 check (tope_plan_micro >= 0),
  estado text not null default 'reservado' check (estado in ('reservado', 'liquidado', 'liberado', 'caducado')),
  created_at timestamptz not null default now(),
  liquidado_at timestamptz,
  check ((estado = 'reservado') = (real_micro is null))
);
alter table public.ai_cargos enable row level security;
create index if not exists ai_cargos_user_created_idx on public.ai_cargos (user_id, created_at desc);
create index if not exists ai_cargos_abiertos_idx on public.ai_cargos (user_id, created_at) where estado = 'reservado';
create unique index if not exists ai_cargos_idem_uniq on public.ai_cargos (user_id, idem) where idem is not null;

-- ── 3. Recargas de IA de pago ─────────────────────────────────────────
create table if not exists public.ai_recarga_productos (
  product_id text primary key check (product_id ~ '^[a-z0-9_.]{3,100}$'),
  micro_usd bigint not null check (micro_usd > 0 and micro_usd <= 50000000),
  activo boolean not null default true
);
alter table public.ai_recarga_productos enable row level security;
drop policy if exists "ai_recarga_productos read" on public.ai_recarga_productos;
create policy "ai_recarga_productos read" on public.ai_recarga_productos for select to authenticated using (activo);
-- Decisión (coordinador, 21/10/2026): consumible a 2,99 € → 1,50 $ de IA (2,99 € con IVA = 2,47 € netos;
-- con la tienda al 15 % = 2,10 € ≈ 2,35 $: margen ~0,85 $ por recarga; al 30 %, ~0,44 $). Teferi crea el
-- producto consumible en App Store Connect y Google Play con ESTE id y lo añade a RevenueCat (docs/IA_TOPE.md);
-- cambiar el crédito es un UPDATE.
insert into public.ai_recarga_productos (product_id, micro_usd) values ('nivl_ia_recarga_1', 1500000)
on conflict (product_id) do nothing;

create table if not exists public.ai_recargas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id text not null references public.ai_recarga_productos (product_id),
  micro_usd bigint not null check (micro_usd > 0),
  tienda text not null check (tienda in ('apple', 'google', 'manual')),
  entorno text not null check (entorno in ('PRODUCTION', 'SANDBOX', 'MANUAL')),
  -- Id de la compra en RevenueCat (non_subscriptions[].id): una compra, una recarga.
  transaccion text not null unique check (char_length(transaccion) between 1 and 200),
  comprada_at timestamptz not null,
  reembolsada_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.ai_recargas enable row level security;
drop policy if exists "ai_recargas own read" on public.ai_recargas;
create policy "ai_recargas own read" on public.ai_recargas for select to authenticated using (user_id = auth.uid());
create index if not exists ai_recargas_user_idx on public.ai_recargas (user_id);

-- Saldo de recarga que queda al empezar el periodo p_desde: lo comprado (sin reembolsar) menos lo que cada
-- mes anterior gastó POR ENCIMA del presupuesto estándar de su plan.
create or replace function public._ia_recarga_saldo(p_user uuid, p_desde timestamptz)
returns bigint language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_total bigint; v_usado bigint;
begin
  select coalesce(sum(micro_usd), 0) into v_total
  from public.ai_recargas where user_id = p_user and reembolsada_at is null and comprada_at <= now();
  if v_total = 0 then return 0; end if;
  select coalesce(sum(greatest(0, m.gasto - m.tope)), 0) into v_usado from (
    select date_trunc('month', c.created_at) as mes,
           sum(coalesce(c.real_micro, c.reservado_micro)) as gasto,
           max(c.tope_plan_micro) as tope
    from public.ai_cargos c
    where c.user_id = p_user and c.modo = 'estandar' and c.created_at < p_desde
    group by 1) m;
  return greatest(0, v_total - v_usado);
end $$;

-- ── 4. Élite a 8 $ (6 estándar + 2 profundo) ──────────────────────────
update public.ai_plans
set monthly_budget_micro_usd = 8000000, deep_budget_micro_usd = 2000000
where plan in ('elite_mensual', 'elite_anual', 'elite_fundador');

-- ── 5. El libro: 'estudio' entra en coach_runs (CHECK vivo de la 0047 + 'estudio') ──
alter table public.coach_runs drop constraint if exists coach_runs_kind_check;
alter table public.coach_runs add constraint coach_runs_kind_check check (
  kind = any (array[
    'chat', 'brief', 'plan', 'revision_semanal', 'cierre_mensual', 'import', 'escalada',
    'clasificar', 'resumen_semanal', 'resumen_mensual',
    'oracle', 'titular',
    'checkin', 'resumen_hilo',
    'estudio'
  ])
) not valid;

-- ── 6. Estado de la IA (copia de la 0069; cambios marcados «0078») ────
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
  v_recarga bigint;  -- 0078
begin
  select * into v_sub from public.subscriptions where user_id = p_user;

  -- 0069: la prueba automática es una prueba como la de 7 días (sin días de gracia).
  v_trial := v_sub.user_id is not null
    and v_sub.status = 'trialing'
    and v_sub.plan in ('cortesia', 'prueba_auto');

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
      'trial_available', v_sub.user_id is null,
      'routes', '{}'::jsonb
    );
  end if;

  select * into v_plan from public.ai_plans where plan = v_sub.plan;
  v_deep_budget := coalesce(v_plan.deep_budget_micro_usd, 0);
  v_std_budget := greatest(0, coalesce(v_plan.monthly_budget_micro_usd, 0) - v_deep_budget);

  if v_trial and v_sub.plan = 'prueba_auto' then
    v_since := '-infinity'::timestamptz;
    v_renews := v_sub.current_period_end;
  elsif v_trial then
    v_since := v_sub.current_period_end - interval '7 days';
    v_renews := v_sub.current_period_end;
  else
    v_since := date_trunc('month', now());
    v_renews := date_trunc('month', now()) + interval '1 month';
  end if;

  -- 0078: la recarga comprada sube el bolsillo estándar (lo que no se usó antes pasa a este periodo).
  v_recarga := public._ia_recarga_saldo(p_user, v_since);
  v_std_budget := v_std_budget + v_recarga;

  select
    coalesce(sum(cost_micro_usd) filter (where mode = 'estandar'), 0),
    coalesce(sum(cost_micro_usd) filter (where mode = 'profundo'), 0)
  into v_std_spent, v_deep_spent
  from public.coach_runs
  where user_id = p_user and created_at >= v_since;

  v_std_left := greatest(0, v_std_budget - v_std_spent);
  v_deep_left := greatest(0, v_deep_budget - v_deep_spent);

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
    'routes', coalesce(v_plan.routes, '{}'::jsonb),
    -- 0078: lo que aporta la recarga y desde cuándo cuenta el periodo (lo lee la cartera).
    'recarga', v_recarga,
    'periodo_desde', v_since
  );

  if v_sub.plan = 'prueba_auto' then
    v_out := v_out || jsonb_build_object(
      'tope_dia', public._prueba_tope_dia(),
      'mensajes_hoy', public._prueba_mensajes_hoy(p_user)
    );
  end if;
  return v_out;
end;
$$;

-- ── 7. La decisión (pura sobre la base): ¿cabe una reserva de p_micro? ──
-- No toma cerrojo: quien la llama para reservar (ai_reservar) ya lo tiene. Devuelve siempre las cifras.
create or replace function public._ia_decidir(
  p_user uuid, p_funcion text, p_modo text, p_micro bigint, p_turno uuid
) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_st jsonb;
  v_tope public.ai_topes_funcion;
  v_modo text := case when p_modo = 'profundo' then 'profundo' else 'estandar' end;
  v_desde timestamptz;
  v_renews date;
  v_hoy timestamptz := date_trunc('day', now());
  v_budget bigint; v_deep_budget bigint; v_recarga bigint; v_plan_std bigint;
  v_liq_std bigint; v_res_std bigint; v_liq_deep bigint; v_res_deep bigint;
  v_hoy_std bigint; v_antes_std bigint;
  v_usado_std bigint; v_usado_deep bigint;
  v_legacy_std bigint; v_legacy_deep bigint;
  v_turnos integer := 0;
  v_dias integer; v_factor numeric; v_limite_hoy bigint; v_recarga_libre bigint;
  v_cifras jsonb;
  v_motivo text := null;
begin
  v_st := public.ai_state(p_user);
  if not coalesce((v_st->>'entitled')::boolean, false) then
    return jsonb_build_object('ok', false, 'motivo', 'sin_suscripcion', 'entitled', false);
  end if;
  select * into v_tope from public.ai_topes_funcion where funcion = p_funcion;
  if v_tope.funcion is null then
    return jsonb_build_object('ok', false, 'motivo', 'funcion_desconocida', 'entitled', true);
  end if;

  v_desde := coalesce((v_st->>'periodo_desde')::timestamptz, date_trunc('month', now()));
  v_renews := coalesce((v_st->>'renews')::date, (date_trunc('month', now()) + interval '1 month')::date);
  v_budget := coalesce((v_st->>'budget')::bigint, 0);              -- estándar, con recarga
  v_deep_budget := coalesce((v_st->>'deep_budget')::bigint, 0);
  v_recarga := coalesce((v_st->>'recarga')::bigint, 0);
  v_plan_std := greatest(0, v_budget - v_recarga);
  -- Lo que apuntaron en coach_runs caminos que aún no pasan por la cartera (funciones sin desplegar).
  v_legacy_std := coalesce((v_st->>'spent')::bigint, 0);
  v_legacy_deep := greatest(0, v_deep_budget - coalesce((v_st->>'deep_remaining')::bigint, 0));

  select
    coalesce(sum(real_micro) filter (where modo = 'estandar' and estado <> 'reservado'), 0),
    coalesce(sum(reservado_micro) filter (where modo = 'estandar' and estado = 'reservado'), 0),
    coalesce(sum(real_micro) filter (where modo = 'profundo' and estado <> 'reservado'), 0),
    coalesce(sum(reservado_micro) filter (where modo = 'profundo' and estado = 'reservado'), 0),
    coalesce(sum(coalesce(real_micro, reservado_micro)) filter (where modo = 'estandar' and created_at >= v_hoy), 0),
    coalesce(sum(coalesce(real_micro, reservado_micro)) filter (where modo = 'estandar' and created_at < v_hoy), 0)
  into v_liq_std, v_res_std, v_liq_deep, v_res_deep, v_hoy_std, v_antes_std
  from public.ai_cargos
  where user_id = p_user and created_at >= v_desde;

  -- Lo comprometido: lo liquidado (o lo de coach_runs, si es mayor) más lo reservado en vuelo.
  v_usado_std := greatest(v_liq_std, v_legacy_std) + v_res_std;
  v_usado_deep := greatest(v_liq_deep, v_legacy_deep) + v_res_deep;

  -- Reparto diario del bolsillo estándar (no en las pruebas: duran días, no meses).
  v_dias := greatest(1, v_renews - (now() at time zone 'utc')::date);
  v_factor := coalesce((
    select least(31, greatest(1, (v #>> '{}')::numeric))
    from (select public.app_config_value('ia_ritmo_factor', '3'::jsonb) as v) c
    where jsonb_typeof(v) = 'number'), 3);
  v_recarga_libre := greatest(0, v_recarga - greatest(0, v_antes_std - v_plan_std));
  v_limite_hoy := case when coalesce((v_st->>'trial')::boolean, false) then v_budget
    else ceil(greatest(0, v_plan_std - v_antes_std) * least(1, v_factor / v_dias))::bigint + v_recarga_libre end;

  if p_turno is not null and v_tope.max_turnos_dia is not null then
    select count(distinct turno) into v_turnos from public.ai_cargos
    where user_id = p_user and funcion = p_funcion and created_at >= v_hoy and turno <> p_turno;
  end if;

  v_cifras := jsonb_build_object(
    'entitled', true,
    'tope', v_budget + v_deep_budget,
    'usado', least(v_budget + v_deep_budget, v_usado_std + v_usado_deep),
    'tope_estandar', v_budget, 'usado_estandar', v_usado_std,
    'tope_profundo', v_deep_budget, 'usado_profundo', v_usado_deep,
    'recarga', v_recarga,
    'limite_hoy', v_limite_hoy, 'usado_hoy', v_hoy_std,
    'renueva', to_char(v_renews, 'YYYY-MM-DD'),
    'tope_plan', v_plan_std
  );

  if p_micro is null or p_micro <= 0 then
    v_motivo := 'importe_invalido';
  elsif p_micro > v_tope.max_micro_llamada then
    v_motivo := 'tope_llamada';
  elsif v_modo = 'profundo' and v_usado_deep + p_micro > v_deep_budget then
    v_motivo := 'profundo_agotado';
  elsif v_modo = 'estandar' and v_usado_std + p_micro > v_budget then
    v_motivo := 'tope_mes';
  elsif v_tope.max_turnos_dia is not null and v_turnos >= v_tope.max_turnos_dia then
    v_motivo := 'tope_funcion';
  elsif v_modo = 'estandar' and v_hoy_std >= v_limite_hoy then
    v_motivo := 'ritmo_diario';
  end if;

  return v_cifras || jsonb_build_object('ok', v_motivo is null, 'motivo', v_motivo, 'modo', v_modo);
end $$;

-- ── 8. Reservar (atómico) ─────────────────────────────────────────────
create or replace function public.ai_reservar(
  p_user uuid, p_funcion text, p_modo text, p_micro bigint, p_turno uuid, p_idem text default null
) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_prev public.ai_cargos;
  v_dec jsonb;
  v_id uuid;
  v_modo text := case when p_modo = 'profundo' then 'profundo' else 'estandar' end;
begin
  if p_user is null or p_turno is null then
    return jsonb_build_object('ok', false, 'motivo', 'importe_invalido');
  end if;

  -- El cerrojo: una fila por usuario. Todas las reservas del mismo usuario pasan en fila por aquí, así que
  -- nadie ve un saldo que otra reserva concurrente ya ha comprometido.
  insert into public.ai_cartera (user_id) values (p_user) on conflict (user_id) do nothing;
  perform 1 from public.ai_cartera where user_id = p_user for update;

  -- Reintento con la misma clave: devuelve la reserva que ya había, no hace otra.
  if p_idem is not null then
    select * into v_prev from public.ai_cargos where user_id = p_user and idem = p_idem;
    if v_prev.id is not null then
      return jsonb_build_object('ok', v_prev.estado = 'reservado', 'id', v_prev.id, 'repetida', true,
        'motivo', case when v_prev.estado = 'reservado' then null else 'ya_liquidada' end);
    end if;
  end if;

  -- Reservas huérfanas (la función murió): se dan por cobradas enteras.
  update public.ai_cargos
  set estado = 'caducado', real_micro = reservado_micro, liquidado_at = now()
  where user_id = p_user and estado = 'reservado' and created_at < now() - interval '15 minutes';

  v_dec := public._ia_decidir(p_user, p_funcion, v_modo, p_micro, p_turno);
  if not coalesce((v_dec->>'ok')::boolean, false) then
    return v_dec;
  end if;

  insert into public.ai_cargos (user_id, funcion, modo, turno, idem, reservado_micro, tope_plan_micro)
  values (p_user, p_funcion, v_modo, p_turno, p_idem, p_micro, coalesce((v_dec->>'tope_plan')::bigint, 0))
  returning id into v_id;
  update public.ai_cartera set updated_at = now() where user_id = p_user;

  return v_dec || jsonb_build_object('id', v_id);
end $$;

-- ── 9. Liquidar con el coste real (idempotente) ──────────────────────
-- p_real = 0 libera la reserva entera. Nunca devuelve dinero de una reserva ya liquidada o caducada.
create or replace function public.ai_liquidar(p_id uuid, p_real bigint)
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_row public.ai_cargos;
begin
  update public.ai_cargos
  set estado = case when coalesce(p_real, 0) <= 0 then 'liberado' else 'liquidado' end,
      real_micro = greatest(0, coalesce(p_real, 0)),
      exceso_micro = greatest(0, coalesce(p_real, 0) - reservado_micro),
      liquidado_at = now()
  where id = p_id and estado = 'reservado'
  returning * into v_row;
  if v_row.id is null then
    return jsonb_build_object('ok', false, 'motivo', 'ya_liquidada');
  end if;
  if v_row.exceso_micro > 0 then
    raise warning 'ai_liquidar: coste real por encima de la reserva (% micro)', v_row.exceso_micro;
  end if;
  return jsonb_build_object('ok', true, 'estado', v_row.estado, 'real', v_row.real_micro);
end $$;

-- ── 10. La puerta previa (sin reservar) y el estado para la app ───────
create or replace function public.ai_puede(p_user uuid, p_funcion text, p_modo text default 'estandar')
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select public._ia_decidir(p_user, p_funcion, p_modo, 20000, gen_random_uuid());
$$;

create or replace function public.ai_cartera_estado(p_user uuid)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v jsonb;
begin
  v := public._ia_decidir(p_user, 'chat', 'estandar', 1, null);
  if not coalesce((v->>'entitled')::boolean, false) then
    return jsonb_build_object('entitled', false);
  end if;
  return jsonb_build_object(
    'entitled', true,
    'tope', (v->>'tope')::bigint, 'usado', (v->>'usado')::bigint,
    'tope_estandar', (v->>'tope_estandar')::bigint, 'usado_estandar', least((v->>'tope_estandar')::bigint, (v->>'usado_estandar')::bigint),
    'recarga', (v->>'recarga')::bigint,
    'limite_hoy', (v->>'limite_hoy')::bigint, 'usado_hoy', (v->>'usado_hoy')::bigint,
    'renueva', v->>'renueva',
    -- Lo que dice la puerta ahora mismo para un turno estándar (null = abierta).
    'motivo', v->>'motivo');
end $$;

-- ai_status (0058) + la cartera: la app ve cuánta IA le queda y si hoy ya ha llegado al ritmo.
create or replace function public.ai_status()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with s as (select public.ai_state(auth.uid()) as j)
  select (s.j - 'routes' - 'periodo_desde') || jsonb_build_object('vision',
    coalesce((s.j->>'entitled')::boolean, false)
    and coalesce(lower(nullif(btrim(s.j->'routes'->>'default'), '')), 'claude-') like 'claude-%')
    || jsonb_build_object('ia', public.ai_cartera_estado(auth.uid()))
  from s;
$$;

-- ── 11. Recargas: solo el servidor, con la compra ya verificada en RevenueCat ──
-- p_compras: [{id, product_id, store: 'app_store'|'play_store', sandbox: bool, purchased_at}]. Idempotente
-- por id de compra. Devuelve cuántas recargas nuevas se han apuntado.
create or replace function public.apply_ai_recargas(p_user uuid, p_compras jsonb)
returns integer
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_c jsonb; v_prod public.ai_recarga_productos; v_n integer := 0; v_ins uuid;
begin
  if p_user is null or jsonb_typeof(p_compras) is distinct from 'array' then return 0; end if;
  if jsonb_array_length(p_compras) > 500 then raise exception 'demasiadas compras'; end if;
  for v_c in select * from jsonb_array_elements(p_compras) loop
    select * into v_prod from public.ai_recarga_productos where product_id = v_c->>'product_id' and activo;
    if v_prod.product_id is null then continue; end if;
    if coalesce(char_length(v_c->>'id'), 0) not between 1 and 200 then continue; end if;
    if v_c->>'store' not in ('app_store', 'play_store') then continue; end if;
    insert into public.ai_recargas (user_id, product_id, micro_usd, tienda, entorno, transaccion, comprada_at)
    values (p_user, v_prod.product_id, v_prod.micro_usd,
      case when v_c->>'store' = 'play_store' then 'google' else 'apple' end,
      case when coalesce((v_c->>'sandbox')::boolean, true) then 'SANDBOX' else 'PRODUCTION' end,
      v_c->>'id',
      least(now(), coalesce((v_c->>'purchased_at')::timestamptz, now())))
    on conflict (transaccion) do nothing
    returning id into v_ins;
    if v_ins is not null then v_n := v_n + 1; v_ins := null; end if;
  end loop;
  return v_n;
end $$;

-- Reembolso de una recarga: deja de sumar. Lo ya gastado no se devuelve (ni se puede: ya se pagó al proveedor).
create or replace function public.revocar_ai_recarga(p_transaccion text)
returns boolean
language sql volatile security definer set search_path = public, pg_temp as $$
  with u as (update public.ai_recargas set reembolsada_at = now()
             where transaccion = p_transaccion and reembolsada_at is null returning 1)
  select exists (select 1 from u);
$$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public._ia_recarga_saldo(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public._ia_decidir(uuid, text, text, bigint, uuid) from public, anon, authenticated;
revoke all on function public.ai_reservar(uuid, text, text, bigint, uuid, text) from public, anon, authenticated;
grant execute on function public.ai_reservar(uuid, text, text, bigint, uuid, text) to service_role;
revoke all on function public.ai_liquidar(uuid, bigint) from public, anon, authenticated;
grant execute on function public.ai_liquidar(uuid, bigint) to service_role;
revoke all on function public.ai_puede(uuid, text, text) from public, anon, authenticated;
grant execute on function public.ai_puede(uuid, text, text) to service_role;
revoke all on function public.ai_cartera_estado(uuid) from public, anon, authenticated;
grant execute on function public.ai_cartera_estado(uuid) to service_role;
revoke all on function public.apply_ai_recargas(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.apply_ai_recargas(uuid, jsonb) to service_role;
revoke all on function public.revocar_ai_recarga(text) from public, anon, authenticated;
grant execute on function public.revocar_ai_recarga(text) to service_role;
revoke all on function public.ai_state(uuid) from public, anon, authenticated;
grant execute on function public.ai_state(uuid) to service_role;
revoke all on function public.ai_status() from public, anon;
grant execute on function public.ai_status() to authenticated;
-- Las tablas nuevas: sin escritura para nadie más que el servidor (las dos de lectura propia, arriba).
revoke all on public.ai_cartera, public.ai_cargos, public.ai_topes_funcion from anon, authenticated;
revoke insert, update, delete on public.ai_recargas, public.ai_recarga_productos from anon, authenticated;

comment on function public.ai_reservar(uuid, text, text, bigint, uuid, text) is
  'nivl:ia-tope-0078 · Reserva atómica (cerrojo por usuario) del coste máximo de una llamada de IA.';
comment on function public.ai_state(uuid) is
  'nivl:prueba-auto-0069 nivl:ia-tope-0078 · Estado de IA; la recarga suma al bolsillo estándar.';
comment on function public.ai_status() is
  'nivl:ai-status-vision nivl:ia-tope-0078 · Estado de IA del usuario sin rutas, con vision y la cartera (ia).';

notify pgrst, 'reload schema';
commit;

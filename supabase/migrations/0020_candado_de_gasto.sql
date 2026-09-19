-- NIVL · 0020 — El candado de gasto de la IA.
--
-- Hasta aquí la función `coach` atendía a cualquier cuenta autenticada, sin
-- mirar si pagaba y sin más tope que el de un turno suelto. Con la app abierta
-- al público eso es una fuga sin fondo: una sola cuenta gratuita en bucle
-- podía gastar en una tarde lo que no ingresa en un año.
--
-- A partir de aquí, cada turno de IA pasa por `ai_begin_turn`, que comprueba
-- TRES cosas en el servidor y en una sola transacción:
--   1. que la cuenta tiene derecho a IA (suscripción viva, cortesía o dueño),
--   2. que no ha agotado el presupuesto de IA de su plan este mes,
--   3. que no tiene ya otro turno en marcha (el cerrojo: sin él, veinte
--      peticiones en paralelo pasarían todas la comprobación 2 a la vez).
--
-- El presupuesto se mide en lo único que de verdad cuesta dinero: los
-- microdólares de `coach_runs`, que ya se apuntan turno a turno con la tarifa
-- del modelo. Nada de "N mensajes al mes": un mensaje con foto y cinco
-- herramientas cuesta veinte veces más que un "hola".
--
-- LA CUENTA QUE NO PUEDE FALLAR (ver docs/PRECIOS.md): el presupuesto de un
-- plan tiene que ser MENOR que lo que ese plan deja limpio al mes en su peor
-- caso (anual, con IVA y con la comisión de tienda del 30 %). Si cambias un
-- precio o un presupuesto, rehaz esa cuenta.

alter table public.subscriptions
  add column if not exists plan text not null default 'mensual',
  add column if not exists provider text not null default 'stripe';

alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check
  check (plan in ('mensual', 'anual', 'cortesia', 'owner'));

alter table public.subscriptions drop constraint if exists subscriptions_provider_check;
alter table public.subscriptions add constraint subscriptions_provider_check
  check (provider in ('stripe', 'apple', 'google', 'manual'));

-- Presupuesto mensual de IA por plan, en microdólares. Es una tabla y no una
-- constante para poder ajustarlo sin desplegar.
create table if not exists public.ai_plans (
  plan text primary key,
  monthly_budget_micro_usd bigint not null check (monthly_budget_micro_usd >= 0)
);

insert into public.ai_plans (plan, monthly_budget_micro_usd) values
  ('mensual', 2500000),
  ('anual', 2500000),
  ('cortesia', 2500000),
  ('owner', 40000000)
on conflict (plan) do nothing;

alter table public.ai_plans enable row level security;
drop policy if exists "ai_plans read" on public.ai_plans;
create policy "ai_plans read" on public.ai_plans for select to authenticated using (true);

-- El cerrojo de turno. Sin políticas: solo lo toca el servidor.
create table if not exists public.ai_turn_locks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  started_at timestamptz not null default now()
);
alter table public.ai_turn_locks enable row level security;

-- Estado de la IA de una cuenta. Interna: la usan las dos de abajo.
create or replace function public.ai_state(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_sub public.subscriptions;
  v_budget bigint;
  v_spent bigint;
  v_entitled boolean;
begin
  select * into v_sub from public.subscriptions where user_id = p_user;

  -- Dos días de gracia tras el fin de periodo: los webhooks de renovación
  -- llegan con retraso y cortarle la IA a quien acaba de pagar es lo peor que
  -- puede pasar el día del cobro.
  v_entitled := v_sub.user_id is not null
    and v_sub.status in ('active', 'trialing')
    and (v_sub.current_period_end is null or v_sub.current_period_end > now() - interval '2 days');

  if not v_entitled then
    return jsonb_build_object('entitled', false, 'plan', null, 'budget', 0, 'spent', 0, 'remaining', 0);
  end if;

  select monthly_budget_micro_usd into v_budget from public.ai_plans where plan = v_sub.plan;
  v_budget := coalesce(v_budget, 0);

  select coalesce(sum(cost_micro_usd), 0) into v_spent
  from public.coach_runs
  where user_id = p_user and created_at >= date_trunc('month', now());

  return jsonb_build_object(
    'entitled', true,
    'plan', v_sub.plan,
    'budget', v_budget,
    'spent', v_spent,
    'remaining', greatest(0, v_budget - v_spent),
    'renews', to_char(date_trunc('month', now()) + interval '1 month', 'YYYY-MM-DD')
  );
end;
$$;

-- Lo que llama la función `coach` antes de gastar un céntimo.
create or replace function public.ai_begin_turn(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_locked uuid;
begin
  v_state := public.ai_state(p_user);

  if not (v_state->>'entitled')::boolean then
    return v_state || jsonb_build_object('allowed', false, 'reason', 'sin_suscripcion');
  end if;

  -- Por debajo de 2 céntimos no cabe ni la llamada más barata.
  if (v_state->>'remaining')::bigint < 20000 then
    return v_state || jsonb_build_object('allowed', false, 'reason', 'presupuesto_agotado');
  end if;

  -- Un turno a la vez. Un cerrojo de más de 4 minutos es de una función que
  -- murió sin soltarlo (el límite de una Edge Function son ~150 s): se pisa.
  insert into public.ai_turn_locks (user_id, started_at)
  values (p_user, now())
  on conflict (user_id) do update
    set started_at = now()
    where public.ai_turn_locks.started_at < now() - interval '4 minutes'
  returning user_id into v_locked;

  if v_locked is null then
    return v_state || jsonb_build_object('allowed', false, 'reason', 'turno_en_curso');
  end if;

  return v_state || jsonb_build_object('allowed', true);
end;
$$;

create or replace function public.ai_end_turn(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.ai_turn_locks where user_id = p_user;
$$;

-- Lo que ve la app: su propio estado, sin cerrojo y sin poder mirar el de otro.
create or replace function public.ai_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.ai_state(auth.uid());
$$;

revoke all on function public.ai_state(uuid) from public, anon, authenticated;
revoke all on function public.ai_begin_turn(uuid) from public, anon, authenticated;
revoke all on function public.ai_end_turn(uuid) from public, anon, authenticated;
grant execute on function public.ai_state(uuid) to service_role;
grant execute on function public.ai_begin_turn(uuid) to service_role;
grant execute on function public.ai_end_turn(uuid) to service_role;
revoke all on function public.ai_status() from public, anon;
grant execute on function public.ai_status() to authenticated;

-- Quien ya está dentro no se queda sin coach el día que se cierra la puerta:
-- el dueño del proyecto pasa a 'owner' y el resto de cuentas existentes a
-- cortesía, con el presupuesto normal. Las cuentas NUEVAS nacen sin fila, es
-- decir, sin IA hasta que paguen.
insert into public.subscriptions (user_id, status, plan, provider)
select u.id, 'active',
  case when u.email = 'teferilaforga@gmail.com' then 'owner' else 'cortesia' end,
  'manual'
from auth.users u
on conflict (user_id) do nothing;

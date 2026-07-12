-- NIVL · 0006 — multi-usuario de pago: suscripciones, uso del Oráculo, onboarding
-- Pegar en SQL Editor después de 0005.

-- ── Suscripciones (SOLO las escribe el webhook de Stripe con service role) ──
create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'none'
    check (status in ('none', 'active', 'trialing', 'past_due', 'canceled')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- El usuario puede VER su suscripción; nadie desde el cliente puede escribirla.
-- (El webhook usa la service role key, que salta RLS.)
create policy "own subscription read" on public.subscriptions
  for select to authenticated
  using (auth.uid() = user_id);

-- ── Contador de uso del Oráculo premium (control de coste de API) ───
create table public.oracle_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  month text not null, -- 'YYYY-MM'
  count integer not null default 0,
  primary key (user_id, month)
);

alter table public.oracle_usage enable row level security;

create policy "own usage read" on public.oracle_usage
  for select to authenticated
  using (auth.uid() = user_id);
-- Sin políticas de escritura: solo la Edge Function (service role) incrementa.

-- ── Onboarding ──────────────────────────────────────────────────────
alter table public.profiles
  add column onboarding_done boolean not null default false;

-- Los cazadores existentes ya están jugando: no les saltes el onboarding.
update public.profiles set onboarding_done = true;

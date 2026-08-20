-- NIVL · 0016 — Las reglas del contrato se marcan cada día
-- Pegar en SQL Editor después de 0015.
--
-- Hasta aquí una regla solo existía cuando TÚ confesabas haberla roto. Eso
-- deja el contrato en la honestidad del peor momento del día: justo cuando
-- menos apetece abrir la app y escribir que has fallado.
--
-- Se invierte: cada regla se marca como CUMPLIDA, y el silencio cuenta como
-- rota. Es más duro y es lo que se pidió — el mismo criterio que ya usaba el
-- cierre con las misiones, donde no marcar es fallar.

create table public.rule_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rule_id uuid not null references public.rules (id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  -- Una marca por regla y día: dos toques no cuentan dos veces.
  unique (user_id, rule_id, date)
);

create index rule_checks_date_idx on public.rule_checks (user_id, date desc);

alter table public.rule_checks enable row level security;

create policy "own rule_checks" on public.rule_checks for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

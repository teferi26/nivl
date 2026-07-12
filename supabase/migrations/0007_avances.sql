-- NIVL · 0007 — Mis avances: peso corporal y metas medibles
-- Pegar en SQL Editor después de 0006.

-- ── Peso corporal (la métrica de avance físico) ─────────────────────
create table public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  weight_kg numeric not null check (weight_kg > 20 and weight_kg < 400),
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index body_metrics_date_idx on public.body_metrics (user_id, date desc);

-- ── Metas medibles (objetivo numérico con progreso real) ────────────
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  metric_type text not null default 'libre'
    check (metric_type in ('peso_corporal', 'ejercicio', 'libre')),
  exercise_name text, -- para metric_type = 'ejercicio' (enlaza con gym_lifts)
  start_value numeric not null,
  target_value numeric not null,
  current_value numeric, -- solo para 'libre' (las otras se calculan de datos reales)
  unit text not null default 'kg',
  deadline date,
  status text not null default 'active' check (status in ('active', 'achieved', 'abandoned')),
  created_at timestamptz not null default now(),
  achieved_at timestamptz
);

create index goals_status_idx on public.goals (user_id, status);

-- ── RLS ─────────────────────────────────────────────────────────────
alter table public.body_metrics enable row level security;
alter table public.goals enable row level security;

create policy "own body_metrics" on public.body_metrics for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own goals" on public.goals for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- NIVL · 0012 — El cuerpo: los datos que el coach necesita para programar
-- Pegar en SQL Editor después de 0011.
--
-- Hasta aquí el coach mandaba en el día pero era ciego al cuerpo: sabía que
-- habías ido al gimnasio, no si el peso te sobró o casi te aplasta. Y correr
-- y nadar no tenían dónde vivir, con un IRONMAN en 2029 como objetivo.
--
-- El bucle que abre esta migración es el que convierte a un coach en un
-- entrenador de verdad:
--
--   PRESCRIBE (training_prescriptions) → EJECUTAS (gym_lifts con RPE)
--     → ESTUDIA (tendencias, e1RM, ritmo) → AJUSTA la siguiente
--
-- Sin el RPE ese bucle no cierra: subir peso porque tocaba en la hoja es
-- programar a ciegas. Subirlo porque las últimas tres series salieron a 7
-- cuando pediste 8 es entrenar.

-- ── El esfuerzo real de cada serie ──────────────────────────────────
-- RPE 1-10 (10 = no me quedaba ninguna). Es el dato que decide si la
-- próxima sesión sube, mantiene o baja.
alter table public.gym_lifts
  add column if not exists rpe numeric,
  add column if not exists set_index integer not null default 0;

alter table public.gym_lifts
  drop constraint if exists gym_lifts_rpe_range;
alter table public.gym_lifts
  add constraint gym_lifts_rpe_range check (rpe is null or (rpe >= 1 and rpe <= 10));

-- ── Cardio: correr, nadar y el camino al IRONMAN ────────────────────
create table public.cardio_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('correr', 'nadar', 'bici', 'caminar', 'remo', 'otro')),
  distance_km numeric check (distance_km is null or (distance_km > 0 and distance_km < 500)),
  duration_min numeric not null check (duration_min > 0 and duration_min < 1440),
  avg_hr integer check (avg_hr is null or (avg_hr > 30 and avg_hr < 240)),
  rpe numeric check (rpe is null or (rpe >= 1 and rpe <= 10)),
  -- Z2 es el motor aeróbico; los intervalos son otra cosa y no se mezclan
  -- al calcular tendencias de ritmo.
  zone text not null default 'Z2' check (zone in ('Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'intervalos', 'libre')),
  notes text,
  xp_awarded integer not null default 0,
  created_at timestamptz not null default now(),
  -- Una sesión de cada tipo por día: dos carreras el mismo día se registran
  -- como una sola con el total.
  unique (user_id, date, kind)
);

create index cardio_sessions_date_idx on public.cardio_sessions (user_id, date desc);
create index cardio_sessions_kind_idx on public.cardio_sessions (user_id, kind, date desc);

-- ── Nutrición: objetivos vigentes ───────────────────────────────────
-- Los escribe el coach con su razonamiento, y se revisan cuando el peso no
-- se mueve al ritmo previsto. Solo uno activo a la vez.
create table public.nutrition_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  from_date date not null default current_date,
  kcal integer not null check (kcal between 1200 and 6000),
  protein_g integer not null check (protein_g between 40 and 400),
  carbs_g integer check (carbs_g is null or carbs_g between 0 and 900),
  fat_g integer check (fat_g is null or fat_g between 0 and 300),
  rationale text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index nutrition_targets_active_idx on public.nutrition_targets (user_id, active, from_date desc);

-- ── Parte diario de nutrición, deliberadamente ligero ───────────────
-- No es un contador de calorías: el cazador odia cocinar y registrar, y un
-- diario de alimentos que no se rellena no vale nada. Dos booleanos y el
-- peso ya permiten cruzar adherencia contra tendencia, que es lo que hace
-- falta para ajustar.
create table public.nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  hit_kcal boolean not null default false,
  hit_protein boolean not null default false,
  kcal_est integer check (kcal_est is null or kcal_est between 0 and 10000),
  protein_est integer check (protein_est is null or protein_est between 0 and 500),
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index nutrition_logs_date_idx on public.nutrition_logs (user_id, date desc);

-- Las comidas del plan pasan a estar cuantificadas: sin números, "pollo con
-- arroz" no se puede comparar con un objetivo de 190 g de proteína.
alter table public.meal_slots
  add column if not exists kcal integer,
  add column if not exists protein_g integer;

-- ── Lo que el coach prescribe para la próxima sesión ────────────────
-- reps es texto a propósito: un programa real dice "8-10" o "AMRAP", no
-- siempre un número exacto.
create table public.training_prescriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  exercise_name text not null,
  sets integer not null check (sets between 1 and 20),
  reps text not null,
  weight numeric check (weight is null or (weight >= 0 and weight < 1000)),
  rpe_target numeric check (rpe_target is null or (rpe_target >= 1 and rpe_target <= 10)),
  notes text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, date, exercise_name)
);

create index training_prescriptions_date_idx on public.training_prescriptions (user_id, date);

-- ── RLS ─────────────────────────────────────────────────────────────
alter table public.cardio_sessions enable row level security;
alter table public.nutrition_targets enable row level security;
alter table public.nutrition_logs enable row level security;
alter table public.training_prescriptions enable row level security;

create policy "own cardio_sessions" on public.cardio_sessions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own nutrition_targets" on public.nutrition_targets for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own nutrition_logs" on public.nutrition_logs for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own training_prescriptions" on public.training_prescriptions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

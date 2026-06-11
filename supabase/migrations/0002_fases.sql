-- NIVL · Fases 1.5-8 — mazmorras, agenda, cuerpo, diario, logros
-- Pegar completo en: Supabase Dashboard → SQL Editor → Run
-- (requiere 0001_init.sql ya aplicada)

-- ── Fase 1.5: válvulas de escape ──────────────────────────────────
alter table public.profiles add column protection_stones integer not null default 0;
alter table public.profiles add column freeze_until date;
alter table public.profiles add column freeze_reason text;
alter table public.profiles add column equipped_title text;

-- ── Fase 2: mazmorras (proyectos) y agenda ────────────────────────
create table public.dungeons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  rank text not null default 'D' check (rank in ('E', 'D', 'C', 'B', 'A', 'S')),
  description text,
  stat text not null default 'INT' check (stat in ('FUE', 'VIT', 'INT', 'AGI', 'PER')),
  deadline date,
  status text not null default 'active' check (status in ('active', 'cleared', 'abandoned')),
  created_at timestamptz not null default now(),
  cleared_at timestamptz
);

create table public.dungeon_tasks (
  id uuid primary key default gen_random_uuid(),
  dungeon_id uuid not null references public.dungeons (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  is_boss boolean not null default false,
  difficulty text not null default 'media' check (difficulty in ('trivial', 'facil', 'media', 'dificil', 'epica')),
  done boolean not null default false,
  done_at timestamptz,
  due_date date,
  position integer not null default 0
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  date date not null,
  time text,
  notes text,
  created_at timestamptz not null default now()
);

-- ── Fase 3: gimnasio, dieta y compra ──────────────────────────────
create table public.gym_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day_of_week integer not null check (day_of_week between 1 and 7),
  name text not null
);

create table public.gym_exercises (
  id uuid primary key default gen_random_uuid(),
  gym_day_id uuid not null references public.gym_days (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  sets integer not null default 3,
  reps integer not null default 10,
  weight numeric,
  position integer not null default 0
);

create table public.gym_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  gym_day_id uuid references public.gym_days (id) on delete set null,
  xp_awarded integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table public.gym_lifts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.gym_sessions (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_name text not null,
  weight numeric not null default 0,
  reps integer not null default 0
);

create table public.meal_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day_of_week integer not null check (day_of_week between 1 and 7),
  slot text not null check (slot in ('desayuno', 'comida', 'merienda', 'cena', 'snack')),
  description text not null,
  ingredients text
);

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  qty text,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── Fase 4: diario y logros ───────────────────────────────────────
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  mood integer check (mood between 1 and 5),
  energy integer check (energy between 1 and 5),
  text text,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  code text not null,
  unlocked_at timestamptz not null default now(),
  unique (user_id, code)
);

-- ── Índices ───────────────────────────────────────────────────────
create index dungeon_tasks_dungeon_idx on public.dungeon_tasks (dungeon_id, position);
create index dungeon_tasks_due_idx on public.dungeon_tasks (user_id, due_date) where not done;
create index calendar_events_date_idx on public.calendar_events (user_id, date);
create index gym_exercises_day_idx on public.gym_exercises (gym_day_id, position);
create index gym_lifts_session_idx on public.gym_lifts (session_id);
create index meal_slots_day_idx on public.meal_slots (user_id, day_of_week);
create index journal_date_idx on public.journal_entries (user_id, date desc);

-- ── RLS ───────────────────────────────────────────────────────────
alter table public.dungeons enable row level security;
alter table public.dungeon_tasks enable row level security;
alter table public.calendar_events enable row level security;
alter table public.gym_days enable row level security;
alter table public.gym_exercises enable row level security;
alter table public.gym_sessions enable row level security;
alter table public.gym_lifts enable row level security;
alter table public.meal_slots enable row level security;
alter table public.shopping_items enable row level security;
alter table public.journal_entries enable row level security;
alter table public.achievements enable row level security;

create policy "own dungeons" on public.dungeons for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own dungeon_tasks" on public.dungeon_tasks for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own calendar_events" on public.calendar_events for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own gym_days" on public.gym_days for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own gym_exercises" on public.gym_exercises for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own gym_sessions" on public.gym_sessions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own gym_lifts" on public.gym_lifts for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own meal_slots" on public.meal_slots for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own shopping_items" on public.shopping_items for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own journal_entries" on public.journal_entries for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own achievements" on public.achievements for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

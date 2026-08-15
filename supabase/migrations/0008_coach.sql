-- NIVL · 0008 — El coach: memoria persistente, conversación y plan del día
-- Pegar en SQL Editor después de 0007.
--
-- Esta migración convierte NIVL en el contenedor del coach: deja de ser un
-- registro de hábitos para pasar a mandar en el día. Tres piezas:
--   1. MEMORIA  — coach_dossier (lo estable) + coach_facts (el log fechado)
--   2. VOZ      — coach_threads / coach_messages (la conversación)
--   3. MANDO    — day_plans / day_blocks (las órdenes con hora)
-- Más push_tokens (para alcanzarte sin abrir la app) y coach_runs (coste).

-- ── Perfil: horarios y régimen ──────────────────────────────────────
-- coach_mode son las tres puertas que el coach ya usa cuando hay un valle:
--   A = régimen completo · B = mínimo viable · pausa = reflexión sobre el pacto
alter table public.profiles
  add column if not exists wake_time time not null default '07:00',
  add column if not exists sleep_time time not null default '23:00',
  add column if not exists timezone text not null default 'Europe/Madrid',
  add column if not exists coach_mode text not null default 'A';

alter table public.profiles
  drop constraint if exists profiles_coach_mode_check;
alter table public.profiles
  add constraint profiles_coach_mode_check check (coach_mode in ('A', 'B', 'pausa'));

-- ── 1. MEMORIA ──────────────────────────────────────────────────────
-- El dossier es lo que va cacheado en cada prompt: perfil, objetivos,
-- proyectos, reglas, protocolos y aprendizajes. Lo reescribe el coach cuando
-- algo estructural cambia; el resto del tiempo solo lee.
create table public.coach_dossier (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  content text not null default '',
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

-- Los hechos son el log: atómicos, fechados y con procedencia. Se recuperan
-- por recencia y categoría, así que un solo usuario puede acumular años sin
-- que el prompt crezca (las de 'aprendizaje' y 'regla' no caducan).
create table public.coach_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null default current_date,
  category text not null default 'log'
    check (category in ('perfil', 'objetivo', 'proyecto', 'regla', 'aprendizaje', 'log', 'metrica', 'venta')),
  content text not null,
  source text not null default 'coach'
    check (source in ('coach', 'usuario', 'import', 'sistema')),
  created_at timestamptz not null default now()
);

create index coach_facts_date_idx on public.coach_facts (user_id, date desc);
create index coach_facts_category_idx on public.coach_facts (user_id, category, date desc);

-- ── 2. VOZ ──────────────────────────────────────────────────────────
create table public.coach_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default 'El sistema',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index coach_threads_user_idx on public.coach_threads (user_id, archived, last_message_at desc);

-- content guarda los bloques de la API tal cual (text / thinking / tool_use /
-- tool_result). Se reenvían SIN modificar: el modelo rechaza bloques de
-- pensamiento alterados, así que aquí no se normaliza ni se recorta nada.
create table public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.coach_threads (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content jsonb not null,
  created_at timestamptz not null default now()
);

create index coach_messages_thread_idx on public.coach_messages (thread_id, created_at);

-- ── 3. MANDO ────────────────────────────────────────────────────────
create table public.day_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  status text not null default 'activo' check (status in ('borrador', 'activo', 'cerrado')),
  verdict text, -- veredicto de ayer
  brief text,   -- órdenes de hoy, con números
  generated_at timestamptz not null default now(),
  unique (user_id, date)
);

-- Los minutos desde medianoche evitan por completo los líos de zona horaria:
-- el plan es local por definición y se pinta tal cual.
create table public.day_blocks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.day_plans (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  start_min integer not null check (start_min >= 0 and start_min < 1440),
  end_min integer not null check (end_min > 0 and end_min <= 1440),
  title text not null,
  kind text not null default 'libre' check (kind in (
    'despertar', 'ritual', 'gym', 'aerobico', 'ventas', 'contenido',
    'deep_work', 'estudio', 'comida', 'redes', 'descanso', 'dormir', 'libre'
  )),
  detail text,
  quest_id uuid references public.quests (id) on delete set null,
  notify boolean not null default true,
  done boolean not null default false,
  position integer not null default 0,
  check (end_min > start_min)
);

create index day_blocks_plan_idx on public.day_blocks (plan_id, position);

-- ── Alcance proactivo ───────────────────────────────────────────────
create table public.push_tokens (
  token text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens (user_id);

-- ── Coste y auditoría ───────────────────────────────────────────────
-- El coste se guarda en millonésimas de dólar: un turno de chat cuesta
-- fracciones de céntimo y redondear a céntimos lo dejaría siempre en 0.
create table public.coach_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in (
    'chat', 'brief', 'plan', 'revision_semanal', 'cierre_mensual', 'import', 'escalada'
  )),
  model text,
  in_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  out_tokens integer not null default 0,
  cost_micro_usd bigint not null default 0,
  error text,
  created_at timestamptz not null default now()
);

create index coach_runs_user_idx on public.coach_runs (user_id, created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────
alter table public.coach_dossier enable row level security;
alter table public.coach_facts enable row level security;
alter table public.coach_threads enable row level security;
alter table public.coach_messages enable row level security;
alter table public.day_plans enable row level security;
alter table public.day_blocks enable row level security;
alter table public.push_tokens enable row level security;
alter table public.coach_runs enable row level security;

create policy "own coach_dossier" on public.coach_dossier for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own coach_facts" on public.coach_facts for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own coach_threads" on public.coach_threads for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own day_plans" on public.day_plans for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own push_tokens" on public.push_tokens for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Las hijas comprueban además la pertenencia del padre (patrón de 0003):
-- sin esto, un user_id falsificado podría colgar filas de un hilo o un plan
-- ajeno aunque la fila en sí pasara el filtro.
create policy "own coach_messages" on public.coach_messages for all to authenticated
  using (
    auth.uid() = user_id
    and exists (select 1 from public.coach_threads t where t.id = thread_id and t.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.coach_threads t where t.id = thread_id and t.user_id = auth.uid())
  );

create policy "own day_blocks" on public.day_blocks for all to authenticated
  using (
    auth.uid() = user_id
    and exists (select 1 from public.day_plans p where p.id = plan_id and p.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.day_plans p where p.id = plan_id and p.user_id = auth.uid())
  );

-- coach_runs es un libro de cuentas: el usuario lo lee, solo el servidor escribe.
create policy "read own coach_runs" on public.coach_runs for select to authenticated
  using (auth.uid() = user_id);

-- NIVL · 0014 — La memoria visual: fotos y el resumen que las cuenta
-- Pegar en SQL Editor después de 0013.
--
-- El sistema ya mide el cuerpo, el día y el dinero, pero todo eso son números.
-- Lo que sostiene la motivación a la semana cuarenta no es un número: es
-- acordarse de cómo fue. Una foto del gimnasio a las 6:00 de un martes que
-- costó levantarse dice más que "+50 XP".
--
-- Dos piezas:
--   · Las fotos dejan de ser solo "evidencia obligatoria" y pasan a poder
--     acompañar CUALQUIER misión cumplida, porque apetezca.
--   · Al cerrar la semana o el mes, esas fotos se convierten en un pase de
--     diapositivas con lo que pasó. Solo si hay fotos: un resumen vacío no
--     motiva a nadie, recuerda que no hiciste nada.

-- ── Fotos de misión ─────────────────────────────────────────────────
-- Ya existía completions.evidence_url, pero solo para las misiones marcadas
-- como "requiere evidencia" y con una foto por completada. Esto separa el
-- concepto: la evidencia es un contrato, la foto es un recuerdo.
create table public.quest_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  completion_id uuid references public.completions (id) on delete set null,
  quest_id uuid references public.quests (id) on delete set null,
  date date not null,
  path text not null,
  -- Lo que dijo al subirla. Es lo que convierte la foto en historia cuando se
  -- relee tres meses después.
  caption text,
  created_at timestamptz not null default now()
);

create index quest_photos_date_idx on public.quest_photos (user_id, date desc);

-- ── El resumen ──────────────────────────────────────────────────────
-- Las diapositivas se guardan generadas, no se recalculan al abrir: un resumen
-- que cambia cada vez que lo miras no es un recuerdo, y además costaría una
-- llamada al modelo por cada vistazo.
create table public.recaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('semanal', 'mensual')),
  period_start date not null,
  period_end date not null,
  -- Array de diapositivas: { tipo, titulo, texto, dato, foto }
  slides jsonb not null default '[]'::jsonb,
  photo_count integer not null default 0,
  seen_at timestamptz,
  created_at timestamptz not null default now(),
  -- Uno por periodo: pedirlo dos veces devuelve el mismo, no uno nuevo.
  unique (user_id, kind, period_start)
);

create index recaps_user_idx on public.recaps (user_id, created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────
alter table public.quest_photos enable row level security;
alter table public.recaps enable row level security;

create policy "own quest_photos" on public.quest_photos for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own recaps" on public.recaps for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

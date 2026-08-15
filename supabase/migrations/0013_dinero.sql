-- NIVL · 0013 — El dinero: en qué se te va y cuánto entra
-- Pegar en SQL Editor después de 0012.
--
-- El coach ya manda en el día y programa el cuerpo, pero el objetivo de la
-- escalera es económico (3.000 €/mes → 1M€) y hasta aquí era ciego a los
-- números que lo deciden. Un coach que te empuja a llamar más sin saber cuánto
-- entra ni por dónde se escapa está adivinando.
--
-- El mismo bucle que en el cuerpo:
--
--   ENTRA (movimientos del banco) → SE CATEGORIZA (reglas que aprenden)
--     → ESTUDIA (gasto por categoría, suscripciones, ahorro, meses de aire)
--       → AJUSTA (presupuestos y objetivos, y órdenes del día que van a ellos)
--
-- Un principio en todo el archivo: el importe manda y es siempre en la divisa
-- de la cuenta. Nada de guardar euros "aproximados" de un cargo en dólares.

-- ── Dónde vive el dinero ────────────────────────────────────────────
create table public.money_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  provider text not null default 'revolut'
    check (provider in ('revolut', 'banco', 'efectivo', 'inversion', 'otro')),
  currency text not null default 'EUR' check (char_length(currency) = 3),
  -- Saldo tal y como lo reportó la fuente, con su sello: un saldo sin fecha
  -- miente a los pocos días y el cálculo de meses de aire depende de él.
  balance numeric,
  balance_at timestamptz,
  -- Identificador en el banco o en el agregador, para reconciliar sin duplicar.
  external_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- ── Cada movimiento ─────────────────────────────────────────────────
-- Signo: negativo es gasto, positivo es ingreso. Es la convención del extracto
-- bancario y de todos los exportadores; invertirla obligaría a traducir en cada
-- consulta y garantiza un error de signo tarde o temprano.
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid references public.money_accounts (id) on delete set null,
  date date not null,
  amount numeric not null,
  currency text not null default 'EUR' check (char_length(currency) = 3),
  description text not null,
  -- Quién cobra o quién paga, ya normalizado. Es lo que agrupa "AMZN Mktp
  -- ES*2K4L9" y "AMZN Mktp ES*7H1P2" bajo un mismo nombre.
  counterparty text,
  category text not null default 'sin_clasificar' check (category in (
    'ingreso_negocio', 'ingreso_nomina', 'ingreso_otro',
    'vivienda', 'suministros', 'super', 'restaurante', 'transporte',
    'salud', 'gimnasio', 'suscripciones', 'ocio', 'ropa', 'formacion',
    'negocio', 'impuestos', 'comisiones', 'ahorro', 'inversion',
    'transferencia', 'otros', 'sin_clasificar'
  )),
  -- De dónde salió la fila. 'openbanking' y 'csv' son la misma verdad por dos
  -- caminos; 'manual' es el efectivo que el banco no ve.
  source text not null default 'manual'
    check (source in ('openbanking', 'csv', 'manual', 'coach')),
  -- Huella estable del movimiento (fecha + importe + descripción + cuenta).
  -- Es lo que permite reimportar el mismo extracto veinte veces sin duplicar
  -- un solo cargo, que es el fallo clásico de todo importador de finanzas.
  dedup_hash text not null,
  -- Los traspasos entre cuentas propias no son ni gasto ni ingreso: si cuentan,
  -- mover 500 € de Revolut al banco aparece como si te hubieras gastado 500.
  is_internal boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, dedup_hash)
);

create index transactions_date_idx on public.transactions (user_id, date desc);
create index transactions_category_idx on public.transactions (user_id, category, date desc);
create index transactions_counterparty_idx on public.transactions (user_id, counterparty);

-- ── Reglas de categorización, que aprenden ──────────────────────────
-- El coach las escribe cuando le corriges: "Mercadona es súper, no ocio". A
-- partir de ahí el importador las aplica solo. Prioridad alta gana.
create table public.category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Se compara con ILIKE '%patron%' contra descripción y contraparte.
  pattern text not null check (char_length(pattern) >= 2),
  category text not null,
  counterparty text,
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, pattern)
);

-- ── Presupuesto por categoría ───────────────────────────────────────
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null,
  monthly_limit numeric not null check (monthly_limit >= 0),
  rationale text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, category)
);

-- ── El plan económico vigente ───────────────────────────────────────
-- Equivalente de nutrition_targets para el dinero: lo fija el coach con su
-- razonamiento y se revisa cuando los números reales no lo acompañan.
create table public.money_plan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  from_date date not null default current_date,
  income_target numeric check (income_target is null or income_target >= 0),
  spend_cap numeric check (spend_cap is null or spend_cap >= 0),
  savings_target numeric check (savings_target is null or savings_target >= 0),
  -- Meses de aire que el cazador quiere tener siempre por delante. Es la
  -- cifra que convierte "voy justo" en una alarma con fecha.
  runway_target_months numeric check (runway_target_months is null or runway_target_months >= 0),
  currency text not null default 'EUR' check (char_length(currency) = 3),
  rationale text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index money_plan_active_idx on public.money_plan (user_id, active, from_date desc);

-- ── RLS ─────────────────────────────────────────────────────────────
-- Esto es lo más sensible que guarda la app. Misma política de pertenencia que
-- el resto, sin excepciones de lectura para nadie.
alter table public.money_accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.category_rules enable row level security;
alter table public.budgets enable row level security;
alter table public.money_plan enable row level security;

create policy "own money_accounts" on public.money_accounts for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own transactions" on public.transactions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own category_rules" on public.category_rules for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own budgets" on public.budgets for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own money_plan" on public.money_plan for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

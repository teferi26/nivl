-- 0115 · WORK: el núcleo del modo de trabajo (proyectos, entregas, sesiones de trabajo y revisiones
-- semanales) y la marca de prioridad de un solo día en `quests`. docs/modos/WORK.md
-- Huella: coalesce(obj_description(to_regclass('public.work_sessions'),'pg_class') like '%nivl:work-nucleo-0115%', false)
--
-- Escrita, NO aplicada (la aplica el dueño con `node scripts/apply-migrations.mjs`). Hasta entonces la
-- app no se rompe: src/work/datos.ts trata «la tabla no existe» como estado vacío.
--
-- Reglas:
--   · RLS estricta por usuario en las cuatro tablas. Las referencias entre tablas se validan con
--     triggers: no se cuelga una entrega del proyecto de otra cuenta ni una sesión de su misión.
--   · CERO economía: ninguna tabla mueve XP. Un bloque solo paga si completa una misión, y eso va por
--     `complete_quest`, que ya existe.
--   · Borrado: FK a auth.users on delete cascade (el borrado de la cuenta se lo lleva todo).
--   · Exportación: la añade la 0118.
begin;

-- ── Prioridad de un solo día ──────────────────────────────────────────
-- Una misión con `work_day` es una prioridad escrita ese día: la app la retira (active=false) al
-- día siguiente, ya hecho el cierre. work_rank guarda el orden en que se escribió.
alter table public.quests add column if not exists work_day date null;
alter table public.quests add column if not exists work_rank smallint null;
alter table public.quests drop constraint if exists quests_work_rank_check;
alter table public.quests add constraint quests_work_rank_check check (work_rank is null or work_rank between 1 and 3);
create index if not exists quests_work_day_idx on public.quests (user_id, work_day) where work_day is not null;

-- ── Proyectos ─────────────────────────────────────────────────────────
create table if not exists public.work_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  client_name text null check (client_name is null or char_length(client_name) <= 80),
  -- Tarifa por hora, opcional. Informativa y sin impuestos: nada aquí calcula fiscalidad.
  hourly_rate numeric(10,2) null check (hourly_rate is null or (hourly_rate >= 0 and hourly_rate <= 100000)),
  status text not null default 'activo' check (status in ('activo','pausado','cerrado')),
  position int not null default 0 check (position between 0 and 10000),
  created_at timestamptz not null default now()
);
create index if not exists work_projects_user_idx on public.work_projects (user_id, status, position);

-- ── Entregas ──────────────────────────────────────────────────────────
create table if not exists public.work_deliverables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid null references public.work_projects (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  due_date date null check (due_date is null or due_date between date '2000-01-01' and date '2100-12-31'),
  done boolean not null default false,
  -- Día local en que se cerró (el mismo criterio que el resto de NIVL).
  done_on date null,
  position int not null default 0 check (position between 0 and 10000),
  created_at timestamptz not null default now(),
  constraint work_deliverables_hecha check (done or done_on is null)
);
create index if not exists work_deliverables_user_idx on public.work_deliverables (user_id, done, due_date);

-- ── Sesiones: bloques terminados y horas apuntadas a mano ─────────────
create table if not exists public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid null references public.work_projects (id) on delete set null,
  deliverable_id uuid null references public.work_deliverables (id) on delete set null,
  -- La misión que pagó el bloque (si la había). Solo informativo: el pago es de complete_quest.
  quest_id uuid null references public.quests (id) on delete set null,
  -- Id generado en el teléfono: el mismo bloque no se registra dos veces (reintentos, dos pantallas).
  client_id text not null check (char_length(client_id) between 1 and 80),
  kind text not null default 'bloque' check (kind in ('bloque','manual')),
  -- Día y minuto LOCALES en que empezó.
  session_date date not null check (session_date between date '2000-01-01' and date '2100-12-31'),
  start_min smallint null check (start_min is null or start_min between 0 and 1439),
  minutes smallint not null check (minutes between 1 and 720),
  billable boolean not null default false,
  billed_on date null,
  note text null check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  unique (user_id, client_id)
);
create index if not exists work_sessions_user_idx on public.work_sessions (user_id, session_date desc);
create index if not exists work_sessions_project_idx on public.work_sessions (user_id, project_id) where project_id is not null;

-- ── Revisiones semanales ──────────────────────────────────────────────
create table if not exists public.work_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  closed jsonb not null default '[]'::jsonb check (jsonb_typeof(closed) = 'array' and jsonb_array_length(closed) <= 200),
  left_over jsonb not null default '[]'::jsonb check (jsonb_typeof(left_over) = 'array' and jsonb_array_length(left_over) <= 200),
  priorities jsonb not null default '[]'::jsonb check (jsonb_typeof(priorities) = 'array' and jsonb_array_length(priorities) <= 3),
  deep_minutes int not null default 0 check (deep_minutes between 0 and 10080),
  total_minutes int not null default 0 check (total_minutes between 0 and 10080),
  meeting_minutes int not null default 0 check (meeting_minutes between 0 and 10080),
  note text null check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

-- ── RLS: cada cuenta, lo suyo ─────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['work_projects','work_deliverables','work_sessions','work_reviews'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "work propio" on public.%I', t);
    execute format('create policy "work propio" on public.%I for all to authenticated '
                   'using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Nadie cambia el dueño de una fila.
create or replace function public._work_dueno_fijo()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'No se cambia el dueño' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public._work_dueno_fijo() from public, anon, authenticated;

-- Las referencias son de la misma cuenta. SECURITY DEFINER para poder mirar la fila referida aunque
-- la RLS la esconda; se valida contra el user_id de la fila nueva, que la RLS ya obliga a ser auth.uid().
create or replace function public._work_misma_cuenta()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  j jsonb := to_jsonb(new);
  ref uuid;
begin
  if (j->>'project_id') is not null then
    ref := (j->>'project_id')::uuid;
    if not exists (select 1 from public.work_projects p where p.id = ref and p.user_id = new.user_id) then
      raise exception 'Proyecto ajeno' using errcode = '42501';
    end if;
  end if;
  if (j->>'deliverable_id') is not null then
    ref := (j->>'deliverable_id')::uuid;
    if not exists (select 1 from public.work_deliverables d where d.id = ref and d.user_id = new.user_id) then
      raise exception 'Entrega ajena' using errcode = '42501';
    end if;
  end if;
  if (j->>'quest_id') is not null then
    ref := (j->>'quest_id')::uuid;
    if not exists (select 1 from public.quests q where q.id = ref and q.user_id = new.user_id) then
      raise exception 'Misión ajena' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
revoke all on function public._work_misma_cuenta() from public, anon, authenticated;

-- Topes por cuenta: generosos para años de uso; frenan un bucle.
create or replace function public._work_tope()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare n int; tope int := tg_argv[0]::int;
begin
  execute format('select count(*) from public.%I where user_id = $1', tg_table_name) into n using new.user_id;
  if n >= tope then
    raise exception 'Has llegado al máximo de filas de %', tg_table_name using errcode = '54000';
  end if;
  return new;
end $$;
revoke all on function public._work_tope() from public, anon, authenticated;

do $$
declare
  t text;
  topes jsonb := '{"work_projects":300,"work_deliverables":5000,"work_sessions":40000,"work_reviews":1000}';
begin
  foreach t in array array['work_projects','work_deliverables','work_sessions','work_reviews'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_dueno', t);
    execute format('create trigger %I before update on public.%I for each row execute function public._work_dueno_fijo()', t || '_dueno', t);
    execute format('drop trigger if exists %I on public.%I', t || '_tope', t);
    execute format('create trigger %I before insert on public.%I for each row execute function public._work_tope(%L)', t || '_tope', t, (topes->>t));
  end loop;
  foreach t in array array['work_deliverables','work_sessions'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_cuenta', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public._work_misma_cuenta()', t || '_cuenta', t);
  end loop;
end $$;

comment on table public.work_projects is 'nivl:work-nucleo-0115 · Proyectos de WORK. Tarifa informativa, sin impuestos. Sin XP.';
comment on table public.work_deliverables is 'nivl:work-nucleo-0115 · Entregas con fecha. Sin XP.';
comment on table public.work_sessions is 'nivl:work-nucleo-0115 · Bloques y horas. client_id idempotente. Cero XP propio: paga la misión (complete_quest).';
comment on table public.work_reviews is 'nivl:work-nucleo-0115 · Revisión semanal (foto de lo calculado en src/work/semana.ts).';

commit;

-- NIVL · 0107 · IRON Resistencia: la carrera objetivo y su plan de sesiones.
-- Huella: coalesce(obj_description(to_regclass('public.objetivos_carrera'), 'pg_class') like '%nivl:objetivos-carrera-0107%', false) and coalesce(obj_description(to_regclass('public.plan_sesiones'), 'pg_class') like '%nivl:plan-sesiones-0107%', false)
--
-- Un objetivo activo por persona (índice único parcial). El plan lo calcula
-- `generarPlan`; la fila guarda el resultado para que el coach pueda ajustar
-- una sesión concreta (`editada_por_coach`).
--
-- RLS en la fila hija no comprueba de quién es la fila a la que apunta: el
-- trigger `plan_sesion_referencias` lo hace con las dos referencias.
--
-- Salud: como `cardio_sessions` (ver 0105). Exportación y borrado de salud: 0108.
begin;

create table public.objetivos_carrera (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('sprint', 'olimpico', 'medio', 'ironman', '5k', '10k', 'media', 'maraton', 'otra')),
  nombre text check (nombre is null or char_length(nombre) <= 120),
  fecha date not null check (fecha between date '2000-01-01' and date '2100-12-31'),
  natacion_m numeric check (natacion_m is null or natacion_m between 0 and 100000),
  bici_m numeric check (bici_m is null or bici_m between 0 and 1000000),
  carrera_m numeric check (carrera_m is null or carrera_m between 0 and 500000),
  horas_semana numeric not null check (horas_semana > 0 and horas_semana <= 60),
  nivel text not null check (nivel in ('principiante', 'intermedio', 'avanzado')),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index objetivos_carrera_un_activo on public.objetivos_carrera (user_id) where activo;
create index objetivos_carrera_user_idx on public.objetivos_carrera (user_id, fecha desc);

create table public.plan_sesiones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  objetivo_id uuid not null references public.objetivos_carrera (id) on delete cascade,
  semana integer not null check (semana between 1 and 60),
  fecha date not null check (fecha between date '2000-01-01' and date '2100-12-31'),
  disciplina text not null check (disciplina in ('natacion', 'bici', 'carrera', 'brick', 'transicion', 'fuerza', 'descanso')),
  titulo text not null check (char_length(titulo) between 1 and 160),
  detalle text not null default '' check (char_length(detalle) <= 2000),
  duracion_min numeric not null default 0 check (duracion_min between 0 and 2880),
  zona text check (zona is null or zona in ('Z1', 'Z2', 'Z3', 'Z4', 'Z5')),
  clave boolean not null default false,
  fase text check (fase is null or fase in ('base', 'construccion', 'pico', 'afinado', 'carrera')),
  hecha_entreno_id uuid references public.entrenos_medidos (id) on delete set null,
  editada_por_coach boolean not null default false,
  nota_coach text check (nota_coach is null or char_length(nota_coach) <= 1000),
  created_at timestamptz not null default now()
);
create index plan_sesiones_fecha_idx on public.plan_sesiones (user_id, fecha);
create index plan_sesiones_objetivo_idx on public.plan_sesiones (objetivo_id, fecha);
create index plan_sesiones_hecha_idx on public.plan_sesiones (hecha_entreno_id) where hecha_entreno_id is not null;

alter table public.objetivos_carrera enable row level security;
alter table public.plan_sesiones enable row level security;
revoke all on public.objetivos_carrera, public.plan_sesiones from public, anon;
grant select, insert, update, delete on public.objetivos_carrera, public.plan_sesiones to authenticated;
grant all on public.objetivos_carrera, public.plan_sesiones to service_role;

do $$
declare t text;
begin
  foreach t in array array['objetivos_carrera', 'plan_sesiones'] loop
    execute format('create policy %I on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', 'own ' || t, t);
    execute format('create policy health_permission on public.%I as restrictive for all to authenticated using ((select public.health_consent_ok(auth.uid()))) with check ((select public.health_consent_ok(auth.uid())))', t);
    execute format('create trigger account_write_guard before insert or update on public.%I for each row execute function public.require_account_active(%L)', t, 'user_id');
    execute format('create trigger health_write before insert or update on public.%I for each row execute function public.require_health_write()', t);
  end loop;
end $$;

-- Solo se mira lo que cambia: el ON DELETE SET NULL de un entreno borrado y las
-- cascadas del borrado de cuenta no tienen nada que validar.
create function public.plan_sesion_referencias() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT' or new.objetivo_id is distinct from old.objetivo_id)
    and not exists(select 1 from public.objetivos_carrera o where o.id = new.objetivo_id and o.user_id = new.user_id) then
    raise exception 'Referencia ajena' using errcode = '42501';
  end if;
  if new.hecha_entreno_id is not null
    and (tg_op = 'INSERT' or new.hecha_entreno_id is distinct from old.hecha_entreno_id)
    and not exists(select 1 from public.entrenos_medidos e where e.id = new.hecha_entreno_id and e.user_id = new.user_id) then
    raise exception 'Referencia ajena' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.plan_sesion_referencias() from public, anon, authenticated, service_role;
create trigger plan_sesion_referencias before insert or update on public.plan_sesiones
  for each row execute function public.plan_sesion_referencias();

comment on table public.objetivos_carrera is
  'Carrera objetivo; dato de salud. nivl:objetivos-carrera-0107';
comment on table public.plan_sesiones is
  'Sesiones del plan de carrera; dato de salud. nivl:plan-sesiones-0107';

commit;

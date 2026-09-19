-- NIVL · 0019 — Un solo gesto, y la ficha física.
--
-- Hasta aquí, "he entrenado" había que decirlo hasta en cuatro sitios: la
-- misión de Hoy, la regla del contrato, el bloque del plan y la sesión del
-- gimnasio, cada uno en su tabla y sin hablarse. Lo mismo con el diario, el
-- peso, las comidas y el cardio. Y como el módulo y la misión pagaban cada uno
-- por su lado, el mismo entreno podía cobrar XP dos veces.
--
-- A partir de aquí manda el ACTO REAL. Una misión o una regla puede llevar un
-- `link` al módulo que la demuestra; al registrar la sesión, el peso o el
-- diario, la app marca sola todo lo enlazado (src/lib/links.ts).
--
-- El enlace se deduce del título en un trigger, para que valga igual venga la
-- misión de la app, del coach o de las de arranque. 'ninguno' es una decisión
-- explícita (no enlazar) y el trigger la respeta; NULL significa "dedúcelo".

create or replace function public.infer_link(p_title text)
returns text
language sql
immutable
as $$
  -- Conservador a propósito: un enlace de más marca como hecho algo que no se
  -- hizo, y eso es peor que tener que marcarlo a mano. "Entreno de ventas" no
  -- es gimnasio (\m y \M son límites de palabra). Caminar no enlaza: la
  -- pantalla de cardio no propaga los paseos, para que no salden un "Correr".
  select case
    when p_title ~* '(venta|pitch|llamada)' then 'ninguno'
    when p_title ~* '(\mgym\M|gimnasio|\mentren|\mpesas\M|\mpush\M|\mpull\M|\mlegs\M)' then 'gym'
    when p_title ~* '(\mcorrer\M|\mcardio\M|aer[oó]bic|\mnadar\M|nataci[oó]n|\mbici|\mz2\M)' then 'cardio'
    when p_title ~* '(\mpesar(se|me)?\M|b[aá]scula|peso corporal)' then 'peso'
    when p_title ~* '(^diario|diario del d[ií]a|escribir (en )?(el )?diario|reporte nocturno|\mjournal\M)' then 'diario'
    when p_title ~* '(registrar (las )?comidas|\mdieta\M|nutrici[oó]n|\mmacros\M|\mkcal\M|calor[ií]as)' then 'nutricion'
    else 'ninguno'
  end
$$;

alter table public.quests add column if not exists link text;
alter table public.rules add column if not exists link text;

alter table public.quests drop constraint if exists quests_link_check;
alter table public.quests add constraint quests_link_check
  check (link is null or link in ('gym', 'cardio', 'nutricion', 'peso', 'diario', 'ninguno'));

alter table public.rules drop constraint if exists rules_link_check;
alter table public.rules add constraint rules_link_check
  check (link is null or link in ('gym', 'cardio', 'nutricion', 'peso', 'diario', 'ninguno'));

create or replace function public.quests_set_link()
returns trigger
language plpgsql
as $$
begin
  -- Las de penalización nunca se enlazan: se cumplen haciendo lo que dicen,
  -- y "Correr 5 km" como castigo no debe saldarse con el cardio del plan.
  if new.is_penalty then
    new.link := 'ninguno';
  elsif new.link is null then
    new.link := public.infer_link(new.title);
  elsif tg_op = 'UPDATE'
    and new.title is distinct from old.title
    and new.link is not distinct from old.link then
    -- Renombrada sin tocar el enlace: se vuelve a deducir. Si no, "Gimnasio"
    -- convertida en "Estudiar 2 h" seguiría cobrándose con cada entreno.
    new.link := public.infer_link(new.title);
  end if;
  return new;
end;
$$;

drop trigger if exists quests_set_link on public.quests;
create trigger quests_set_link
  before insert or update of title, link on public.quests
  for each row execute function public.quests_set_link();

create or replace function public.rules_set_link()
returns trigger
language plpgsql
as $$
begin
  if new.link is null then
    new.link := public.infer_link(new.text);
  elsif tg_op = 'UPDATE'
    and new.text is distinct from old.text
    and new.link is not distinct from old.link then
    new.link := public.infer_link(new.text);
  end if;
  return new;
end;
$$;

drop trigger if exists rules_set_link on public.rules;
create trigger rules_set_link
  before insert or update of text, link on public.rules
  for each row execute function public.rules_set_link();

-- Lo que ya existía se enlaza ahora.
update public.quests
  set link = case when is_penalty then 'ninguno' else public.infer_link(title) end
  where link is null;
update public.rules set link = public.infer_link(text) where link is null;

create index if not exists quests_link_idx on public.quests (user_id, link) where active;

-- ── Ficha física ────────────────────────────────────────────────────
-- Sin altura, edad, sexo y actividad no se puede estimar un mantenimiento, y
-- sin lesiones, material y gustos el coach prescribe para un usuario medio que
-- no existe. Es una tabla aparte y no columnas del perfil porque son datos de
-- salud: así llevan su propia RLS y no viajan en cada select del perfil.
create table if not exists public.body_profile (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  height_cm integer check (height_cm is null or height_cm between 100 and 250),
  birth_year integer check (birth_year is null or birth_year between 1920 and 2020),
  sex text check (sex is null or sex in ('hombre', 'mujer')),
  activity text check (activity is null or activity in ('sedentario', 'ligero', 'moderado', 'alto', 'muy_alto')),
  goal text,
  injuries text,
  health_notes text,
  food_notes text,
  equipment text,
  experience text check (experience is null or experience in ('principiante', 'intermedio', 'avanzado')),
  updated_at timestamptz not null default now()
);

alter table public.body_profile enable row level security;

drop policy if exists "own body_profile" on public.body_profile;
create policy "own body_profile" on public.body_profile for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

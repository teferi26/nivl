-- NIVL · 0026 — Élite: los ludus y la insignia.
--
-- Un ludus (en el código y aquí, "elite group") es un grupo de 5 a 8
-- gladiadores Élite con el mismo objetivo que se miden entre ellos. Se pide
-- desde la app y lo forma el dueño a mano (scripts/ludus.mjs): con 100 plazas
-- de fundador, emparejar a mano es lo sensato.
--
-- LO QUE NO SE NEGOCIA:
--   · Nada de esto toca XP, racha, piedras ni el orden de ningún marcador. La
--     insignia es estética y el marcador del ludus usa EXACTAMENTE los mismos
--     recortes que friends_board (0021): sin penalizaciones, 500 XP por
--     completion como mucho. Pagar no hace ganar.
--   · Un compañero de ludus ve un marcador, no una vida (misma regla que
--     0021). Las tablas no tienen políticas: nadie las lee directamente. Lo
--     único que cruza son las RPC de abajo, y cada una solo devuelve el ludus
--     de quien pregunta.
--   · Solo un Élite (o el dueño) pide, entra y ve su ludus. Se revalida en el
--     servidor con user_tier (0024) en cada RPC y en el trigger que guarda la
--     tabla de miembros, así que ni un cliente trucado ni un error del script
--     meten a quien no paga.
--
-- El archivo es re-ejecutable (if not exists / or replace / drop if exists).

-- ── Tablas ──────────────────────────────────────────────────────────
create table if not exists public.elite_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  goal text not null check (goal in ('emprendedor', 'trabajador', 'deportista', 'estudiante', 'general')),
  capacity smallint not null default 8 check (capacity between 5 and 8),
  created_at timestamptz not null default now()
);
-- El script asigna por nombre: dos ludus con el mismo nombre serían ambiguos.
create unique index if not exists elite_groups_name_idx on public.elite_groups (lower(btrim(name)));

create table if not exists public.elite_group_members (
  group_id uuid not null references public.elite_groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
-- Un ludus por persona.
create unique index if not exists elite_group_members_user_idx on public.elite_group_members (user_id);

create table if not exists public.elite_group_requests (
  user_id uuid primary key references auth.users (id) on delete cascade,
  goal text not null check (goal in ('emprendedor', 'trabajador', 'deportista', 'estudiante', 'general')),
  note text check (char_length(note) <= 280),
  created_at timestamptz not null default now()
);

-- RLS activa y SIN políticas: para anon y authenticated eso ya es "prohibido".
-- El revoke lo deja dicho dos veces por si alguien añade una política
-- permisiva sin querer.
alter table public.elite_groups enable row level security;
alter table public.elite_group_members enable row level security;
alter table public.elite_group_requests enable row level security;
revoke all on public.elite_groups from anon, authenticated;
revoke all on public.elite_group_members from anon, authenticated;
revoke all on public.elite_group_requests from anon, authenticated;

-- ── El guardián de la tabla de miembros ─────────────────────────────
-- Entrar en un ludus lo hace el dueño con el script (Management API, como
-- postgres), no el cliente. Aun así, el trigger comprueba en el servidor:
--   · que quien entra es Élite (o el dueño): user_tier, no la palabra del script;
--   · que el ludus no pasa de su capacidad (5-8). El FOR UPDATE sobre el
--     ludus serializa dos altas simultáneas: sin él, las dos leerían "7 de 8"
--     y entrarían las dos.
-- Al entrar, su petición pendiente deja de estarlo.
create or replace function public.elite_group_members_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity smallint;
  v_count integer;
begin
  if public.user_tier(new.user_id) not in ('elite', 'owner') then
    raise exception 'Solo un Élite entra en un ludus';
  end if;

  select g.capacity into v_capacity
  from public.elite_groups g
  where g.id = new.group_id
  for update;
  if v_capacity is null then raise exception 'Ludus no encontrado'; end if;

  select count(*) into v_count
  from public.elite_group_members m
  where m.group_id = new.group_id
    and m.user_id <> new.user_id;
  if v_count >= v_capacity then
    raise exception 'El ludus está completo (% de %)', v_count, v_capacity;
  end if;

  delete from public.elite_group_requests r where r.user_id = new.user_id;
  return new;
end;
$$;

drop trigger if exists elite_group_members_guard on public.elite_group_members;
create trigger elite_group_members_guard
  before insert or update on public.elite_group_members
  for each row execute function public.elite_group_members_guard();

-- Bajar la capacidad por debajo de los que ya están dejaría un ludus imposible.
create or replace function public.elite_groups_capacity_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.elite_group_members m where m.group_id = new.id;
  if v_count > new.capacity then
    raise exception 'El ludus ya tiene % miembros; no cabe en %', v_count, new.capacity;
  end if;
  return new;
end;
$$;

drop trigger if exists elite_groups_capacity_guard on public.elite_groups;
create trigger elite_groups_capacity_guard
  before update of capacity on public.elite_groups
  for each row execute function public.elite_groups_capacity_guard();

-- ── Pedir plaza en un ludus ─────────────────────────────────────────
-- Devuelve jsonb {ok, reason} en vez de lanzar: los "no" de negocio no son
-- errores y la app los enseña con su frase.
create or replace function public.elite_request_group(p_goal text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if public.user_tier(v_uid) not in ('elite', 'owner') then
    return jsonb_build_object('ok', false, 'reason', 'no_elite');
  end if;
  if p_goal is null or p_goal not in ('emprendedor', 'trabajador', 'deportista', 'estudiante', 'general') then
    return jsonb_build_object('ok', false, 'reason', 'objetivo_invalido');
  end if;
  if exists (select 1 from public.elite_group_members m where m.user_id = v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'ya_en_ludus');
  end if;

  insert into public.elite_group_requests (user_id, goal, note)
  values (v_uid, p_goal, left(v_note, 280))
  on conflict (user_id) do update
    set goal = excluded.goal, note = excluded.note, created_at = now();
  return jsonb_build_object('ok', true);
end;
$$;

-- ── Mi ludus ────────────────────────────────────────────────────────
-- Solo el mío. Sin nombres de los demás: eso lo da el marcador, que ya
-- respeta social_visible.
create or replace function public.my_elite_group()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ok boolean;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  v_ok := public.user_tier(v_uid) in ('elite', 'owner');
  if not v_ok then
    return jsonb_build_object('eligible', false, 'group', null, 'requested', false);
  end if;

  return jsonb_build_object(
    'eligible', true,
    'group', (
      select jsonb_build_object(
        'name', g.name,
        'goal', g.goal,
        'capacity', g.capacity,
        'members', (select count(*) from public.elite_group_members x where x.group_id = g.id))
      from public.elite_group_members m
      join public.elite_groups g on g.id = m.group_id
      where m.user_id = v_uid
    ),
    'requested', exists (select 1 from public.elite_group_requests r where r.user_id = v_uid),
    'requested_goal', (select r.goal from public.elite_group_requests r where r.user_id = v_uid)
  );
end;
$$;

-- ── Insignias ───────────────────────────────────────────────────────
-- Las que puede ver quien pregunta: la suya, la de sus amigos aceptados y la
-- de su ludus, respetando social_visible. Solo el tier 'elite' la lleva: el
-- dueño no paga Élite y no se la pone.
create or replace function public.elite_badges()
returns table (user_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'No autenticado'; end if;

  return query
  with miembros as (
    select v_uid as uid
    union
    select case when f.requester = v_uid then f.addressee else f.requester end
    from public.friendships f
    where f.status = 'accepted' and (f.requester = v_uid or f.addressee = v_uid)
    union
    select m2.user_id
    from public.elite_group_members m1
    join public.elite_group_members m2 on m2.group_id = m1.group_id
    where m1.user_id = v_uid
  )
  select m.uid
  from miembros m
  join public.profiles p on p.id = m.uid
  where (m.uid = v_uid or p.social_visible)
    and public.user_tier(m.uid) = 'elite';
end;
$$;

-- ── El marcador del ludus ───────────────────────────────────────────
-- COPIA de friends_board (0021) cambiando SOLO el CTE `miembros` por los del
-- ludus de auth.uid() y devolviendo 0 filas si quien pregunta no es Élite.
-- Mismo RETURNS TABLE, mismos recortes (sin penalizaciones, least(xp, 500)),
-- mismo safe_tz: las mismas personas dan las mismas cifras en los dos
-- marcadores. No se refactoriza friends_board para compartir cuerpo: está en
-- producción y funciona. Si tocas una, toca la otra.
--
-- friendship_id sale siempre null: en un ludus no se "quita" a nadie desde la
-- app; lo decide el dueño.
create or replace function public.elite_group_board(p_days integer default 7)
returns table (
  user_id uuid,
  friendship_id uuid,
  is_me boolean,
  visible boolean,
  name text,
  avatar_url text,
  xp_total integer,
  streak_days integer,
  equipped_title text,
  profile_kind text,
  xp_window integer,
  days_active integer,
  scheduled integer,
  completed integer,
  compliance_pct integer,
  window_days integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_days integer := least(90, greatest(1, coalesce(p_days, 7)));
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if public.user_tier(v_uid) not in ('elite', 'owner') then return; end if;

  return query
  with miembros as (
    select m2.user_id as uid, null::uuid as fid
    from public.elite_group_members m1
    join public.elite_group_members m2 on m2.group_id = m1.group_id
    where m1.user_id = v_uid
  ),
  gente as (
    select
      m.uid,
      m.fid,
      (m.uid = v_uid) as soy_yo,
      (m.uid = v_uid or p.social_visible) as se_ve,
      p.name as nombre,
      p.avatar_url as retrato,
      p.xp_total as xp,
      p.streak_days as racha,
      p.equipped_title as titulo,
      p.profile_kind as tipo,
      z.tz,
      (now() at time zone z.tz)::date as hoy
    from miembros m
    join public.profiles p on p.id = m.uid
    cross join lateral (select public.safe_tz(p.timezone) as tz) z
  ),
  dias as (
    select g.uid, g.tz, g.hoy, (g.hoy - n.i) as dia
    from gente g
    cross join lateral generate_series(0, v_days - 1) as n(i)
    where g.se_ve
  ),
  programadas as (
    select d.uid, d.dia, d.hoy, (c.id is not null) as hecha
    from dias d
    join public.quests q on q.user_id = d.uid
    left join public.completions c
      on c.user_id = d.uid and c.quest_id = q.id and c.date = d.dia
    where q.active
      and not q.is_penalty
      and not q.is_bonus
      and q.acquired_at is null
      and extract(isodow from d.dia)::integer = any (q.days_of_week)
      and d.dia >= (q.created_at at time zone d.tz)::date
  ),
  cumplimiento as (
    select
      pr.uid,
      count(*) filter (where pr.dia < pr.hoy or pr.hecha)::integer as n_programadas,
      count(*) filter (where pr.hecha)::integer as n_completadas
    from programadas pr
    group by pr.uid
  ),
  ganado as (
    select
      g.uid,
      coalesce(sum(least(c.xp_awarded, 500)), 0)::integer as xp_ventana,
      count(distinct c.date)::integer as dias_activos
    from gente g
    join public.completions c
      on c.user_id = g.uid and c.date > g.hoy - v_days and c.date <= g.hoy
    join public.quests q on q.id = c.quest_id and not q.is_penalty
    where g.se_ve
    group by g.uid
  )
  select
    g.uid,
    g.fid,
    g.soy_yo,
    g.se_ve,
    left(g.nombre, 40),
    -- Solo una ruta dentro de SU carpeta. La política de storage NO se amplía:
    -- la cara de un compañero que no es tu amigo no se firma y la app cae a
    -- su inicial.
    case when g.se_ve and g.retrato like g.uid::text || '/%' then g.retrato end,
    case when g.se_ve then g.xp end,
    case when g.se_ve then g.racha end,
    case when g.se_ve then left(g.titulo, 60) end,
    case when g.se_ve then g.tipo end,
    case when g.se_ve then coalesce(ga.xp_ventana, 0) end,
    case when g.se_ve then coalesce(ga.dias_activos, 0) end,
    case when g.se_ve then coalesce(cu.n_programadas, 0) end,
    case when g.se_ve then coalesce(cu.n_completadas, 0) end,
    case
      when g.se_ve and coalesce(cu.n_programadas, 0) > 0
        then round(100.0 * cu.n_completadas / cu.n_programadas)::integer
    end,
    v_days
  from gente g
  left join cumplimiento cu on cu.uid = g.uid
  left join ganado ga on ga.uid = g.uid;
end;
$$;

-- ── Permisos ────────────────────────────────────────────────────────
-- Las funciones nuevas nacen con EXECUTE para PUBLIC (y en Supabase, para anon
-- y authenticated): se revoca todo y se concede solo lo que toca. user_tier
-- sigue siendo solo de service_role (0024): aquí se usa dentro de funciones
-- security definer.
revoke all on function public.elite_group_members_guard() from public, anon, authenticated;
revoke all on function public.elite_groups_capacity_guard() from public, anon, authenticated;
revoke all on function public.elite_request_group(text, text) from public, anon;
revoke all on function public.my_elite_group() from public, anon;
revoke all on function public.elite_badges() from public, anon;
revoke all on function public.elite_group_board(integer) from public, anon;
grant execute on function public.elite_request_group(text, text) to authenticated;
grant execute on function public.my_elite_group() to authenticated;
grant execute on function public.elite_badges() to authenticated;
grant execute on function public.elite_group_board(integer) to authenticated;

notify pgrst, 'reload schema';

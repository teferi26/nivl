-- NIVL · 0021 — Amigos: la arena deja de ser de uno solo.
--
-- Hasta aquí cada gladiador peleaba a solas. Esta capa deja añadir amigos por
-- código, competir por quién mejora más deprisa y quién cumple más, y presumir
-- de la semana en redes. Es gratis para todos: aquí no hay IA ni coste.
--
-- LO QUE NO SE NEGOCIA: un amigo ve un marcador, no una vida. Salud, dinero,
-- diario y coach NO salen nunca de su dueño. Por eso:
--   · La política de `profiles` sigue siendo "solo el dueño". Nadie lee el
--     perfil de otro: lo único que cruza la frontera son las columnas que las
--     RPC de abajo devuelven a mano, una a una.
--   · `friendships` no admite escritura directa. Si el cliente pudiera
--     insertar, cualquiera se fabricaría una fila 'accepted' con quien quisiera
--     y con ella el marcador y el retrato de esa persona.
--   · Todo lo que se calcula de otro (XP de la ventana, cumplimiento) se agrega
--     en SQL y sale como cifras: ni títulos de misiones ni fechas.
--
-- El archivo es re-ejecutable (if not exists / or replace / drop if exists):
-- una migración sin huella en apply-migrations se reintenta en cada pasada.

-- ── Columnas nuevas del perfil ──────────────────────────────────────
alter table public.profiles
  add column if not exists friend_code text,
  add column if not exists social_visible boolean not null default true;

-- Salir del ranking es decisión del dueño, como el nombre o el avatar.
-- friend_code NO se concede a propósito: desde la 0009 el UPDATE de profiles va
-- por columnas, así que sin este grant el cliente no puede cambiárselo (ni
-- elegirse uno bonito, ni pisar el de otro para recibir sus solicitudes).
grant update (social_visible) on public.profiles to authenticated;

-- ── El código de amigo ──────────────────────────────────────────────
-- 8 caracteres de un alfabeto de 32 sin 0/O/1/I: se dicta por teléfono y se
-- copia de una story sin dudar. 32^8 ≈ 1,1 billones de combinaciones; con el
-- freno de 30 intentos/hora de más abajo, adivinar uno a ciegas no es un plan.
--
-- La aleatoriedad sale de gen_random_uuid() (criptográfica y del núcleo de
-- Postgres) y no de gen_random_bytes: pgcrypto vive en el esquema `extensions`
-- y estas funciones fijan search_path = public. Se usan solo bytes del UUID sin
-- bits fijos de versión/variante (el 6 y el 8 los tienen), y 256 es múltiplo
-- de 32, así que el módulo no sesga ningún símbolo.
create or replace function public.gen_friend_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  c_alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c_bytes constant integer[] := array[0, 1, 2, 3, 4, 5, 10, 11];
  v_raw bytea;
  v_code text;
  v_i integer;
begin
  loop
    v_raw := uuid_send(gen_random_uuid());
    v_code := '';
    foreach v_i in array c_bytes loop
      v_code := v_code || substr(c_alfabeto, 1 + (get_byte(v_raw, v_i) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.profiles p where p.friend_code = v_code);
  end loop;
  return v_code;
end;
$$;

-- El código lo pone SIEMPRE el servidor. ensureProfile (data.ts) inserta el
-- perfil desde el cliente cuando el trigger de alta llega tarde, y un insert
-- del cliente podría traer el friend_code que quisiera: aquí se pisa.
create or replace function public.set_friend_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.friend_code := public.gen_friend_code();
  return new;
end;
$$;

drop trigger if exists profiles_friend_code on public.profiles;
create trigger profiles_friend_code
  before insert on public.profiles
  for each row execute function public.set_friend_code();

-- Los que ya estaban dentro. Fila a fila y no en un solo UPDATE: así cada
-- código nuevo ya ve los anteriores al comprobar que no está repetido.
do $$
declare
  r record;
begin
  for r in select id from public.profiles where friend_code is null loop
    update public.profiles set friend_code = public.gen_friend_code() where id = r.id;
  end loop;
end;
$$;

alter table public.profiles alter column friend_code set not null;

alter table public.profiles drop constraint if exists profiles_friend_code_key;
alter table public.profiles add constraint profiles_friend_code_key unique (friend_code);

alter table public.profiles drop constraint if exists profiles_friend_code_format;
alter table public.profiles add constraint profiles_friend_code_format
  check (friend_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$');

-- ── Amistades ───────────────────────────────────────────────────────
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references auth.users (id) on delete cascade,
  addressee uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  constraint friendships_no_self check (requester <> addressee)
);

-- Una sola fila por PAREJA, la pida quien la pida: sin esto A→B y B→A serían
-- dos amistades distintas y el tope de 100 y el "ya sois amigos" mentirían.
create unique index if not exists friendships_pair_idx
  on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index if not exists friendships_requester_idx on public.friendships (requester, status);
create index if not exists friendships_addressee_idx on public.friendships (addressee, status);

alter table public.friendships enable row level security;

-- Solo lectura y solo para sus dos miembros. No hay política de insert, update
-- ni delete: con RLS activa eso ya es "prohibido", y el revoke de debajo lo
-- deja dicho dos veces por si alguien añade una política permisiva sin querer.
drop policy if exists "friendships members read" on public.friendships;
create policy "friendships members read" on public.friendships
  for select to authenticated
  using (auth.uid() = requester or auth.uid() = addressee);

revoke all on public.friendships from anon, authenticated;
grant select on public.friendships to authenticated;

-- ── Freno de intentos ───────────────────────────────────────────────
-- Una fila por llamada a friend_request. Sin políticas ni permisos: solo la
-- toca la RPC (security definer).
create table if not exists public.friend_request_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists friend_request_log_user_idx
  on public.friend_request_log (user_id, created_at desc);
alter table public.friend_request_log enable row level security;
revoke all on public.friend_request_log from anon, authenticated;

-- ── Piezas internas ─────────────────────────────────────────────────

-- profiles.timezone es texto libre que edita su dueño. `at time zone` con una
-- zona inventada LANZA, y en friends_board eso tumbaría el marcador de todos
-- sus amigos: un solo perfil roto no puede apagar la arena de los demás.
create or replace function public.safe_tz(p_tz text)
returns text
language plpgsql
stable
set search_path = public
as $$
begin
  if p_tz is null or p_tz = '' then return 'Europe/Madrid'; end if;
  perform now() at time zone p_tz;
  return p_tz;
exception when others then
  return 'Europe/Madrid';
end;
$$;

-- Espejo de levelFromXp (src/lib/game.ts): coste del nivel n = round(100·n^1,5).
-- Si tocas una, toca la otra. Existe para que friend_requests devuelva el NIVEL
-- de un desconocido y no su XP exacto.
create or replace function public.level_from_xp(p_xp integer)
returns integer
language plpgsql
immutable
set search_path = public
as $$
declare
  v_level integer := 1;
  v_rest numeric := greatest(0, coalesce(p_xp, 0));
  v_cost numeric;
begin
  while v_level < 999 loop
    v_cost := round((100 * power(v_level::double precision, 1.5))::numeric);
    exit when v_rest < v_cost;
    v_rest := v_rest - v_cost;
    v_level := v_level + 1;
  end loop;
  return v_level;
end;
$$;

-- ¿La carpeta {user_id}/ del bucket es de un amigo aceptado (y visible)?
-- Compara como TEXTO: castear el nombre de carpeta a uuid lanzaría con
-- cualquier objeto mal nombrado y rompería los listados del bucket.
create or replace function public.is_friend_folder(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.friendships f
    join public.profiles p
      on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
    where f.status = 'accepted'
      and (f.requester = auth.uid() or f.addressee = auth.uid())
      and p.id::text = p_folder
      and p.social_visible
  );
$$;

-- ── Pedir amistad ───────────────────────────────────────────────────
-- Devuelve jsonb {ok, status|error, message, name} en vez de lanzar. No es
-- gusto: una excepción deshace la transacción entera, INCLUIDA la fila del
-- freno de intentos, y justo los intentos fallidos (códigos probados a ciegas)
-- son los que hay que contar.
create or replace function public.friend_request(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_other uuid;
  v_other_name text;
  v_row public.friendships;
  v_calls integer;
  v_friends integer;
  v_other_friends integer;
  v_pending integer;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;

  -- Un cerrojo por usuario: sin él, treinta llamadas en paralelo leerían todas
  -- "llevo 29" y pasarían, y lo mismo con los topes de amigos y pendientes.
  perform pg_advisory_xact_lock(hashtext('nivl_friend_request'), hashtext(v_uid::text));

  select count(*) into v_calls
  from public.friend_request_log l
  where l.user_id = v_uid and l.created_at > now() - interval '1 hour';
  if v_calls >= 30 then
    return jsonb_build_object('ok', false, 'error', 'limite',
      'message', 'Demasiados intentos. El sistema vuelve a escucharte dentro de una hora.');
  end if;

  insert into public.friend_request_log (user_id) values (v_uid);
  delete from public.friend_request_log l
  where l.user_id = v_uid and l.created_at < now() - interval '1 day';

  -- Se acepta con espacios, guiones o minúsculas: así llega de un mensaje.
  v_code := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if length(v_code) <> 8 then
    return jsonb_build_object('ok', false, 'error', 'codigo_invalido',
      'message', 'Ese código no es válido. Son 8 caracteres.');
  end if;

  select p.id, p.name into v_other, v_other_name
  from public.profiles p where p.friend_code = v_code;
  if v_other is null then
    return jsonb_build_object('ok', false, 'error', 'codigo_desconocido',
      'message', 'Ningún gladiador responde a ese código.');
  end if;
  if v_other = v_uid then
    return jsonb_build_object('ok', false, 'error', 'uno_mismo',
      'message', 'Ese código es el tuyo. El rival tiene que ser otro.');
  end if;

  select count(*) into v_friends
  from public.friendships f
  where f.status = 'accepted' and (f.requester = v_uid or f.addressee = v_uid);

  select * into v_row
  from public.friendships f
  where least(f.requester, f.addressee) = least(v_uid, v_other)
    and greatest(f.requester, f.addressee) = greatest(v_uid, v_other)
  for update;

  if found then
    if v_row.status = 'accepted' then
      return jsonb_build_object('ok', false, 'error', 'ya_amigos',
        'message', 'Ya sois amigos. Búscale en el ranking.');
    end if;
    if v_row.requester = v_uid then
      return jsonb_build_object('ok', false, 'error', 'ya_pendiente',
        'message', 'Ya le enviaste una solicitud. Falta su respuesta.');
    end if;

    -- La otra persona ya te lo había pedido: pedírselo tú es decir que sí.
    select count(*) into v_other_friends
    from public.friendships f
    where f.status = 'accepted' and (f.requester = v_other or f.addressee = v_other);
    if v_friends >= 100 then
      return jsonb_build_object('ok', false, 'error', 'tope_amigos',
        'message', 'Has llegado al máximo de 100 amigos.');
    end if;
    if v_other_friends >= 100 then
      return jsonb_build_object('ok', false, 'error', 'tope_amigos_otro',
        'message', 'Esa persona ya tiene el máximo de amigos.');
    end if;

    update public.friendships f set status = 'accepted', accepted_at = now() where f.id = v_row.id;
    return jsonb_build_object('ok', true, 'status', 'accepted', 'name', left(v_other_name, 40),
      'message', 'Ya os habíais buscado. Amistad aceptada.');
  end if;

  if v_friends >= 100 then
    return jsonb_build_object('ok', false, 'error', 'tope_amigos',
      'message', 'Has llegado al máximo de 100 amigos.');
  end if;

  select count(*) into v_pending
  from public.friendships f
  where f.status = 'pending' and f.requester = v_uid;
  if v_pending >= 20 then
    return jsonb_build_object('ok', false, 'error', 'tope_pendientes',
      'message', 'Tienes 20 solicitudes sin respuesta. Espera a que contesten o retira alguna.');
  end if;

  -- El cerrojo es por usuario, no por pareja: si los dos se piden a la vez, el
  -- índice único de la pareja para al segundo. Se traduce en vez de reventar.
  begin
    insert into public.friendships (requester, addressee) values (v_uid, v_other);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'ya_pendiente',
      'message', 'Ya hay una solicitud entre vosotros. Revisa tus pendientes.');
  end;

  return jsonb_build_object('ok', true, 'status', 'pending', 'name', left(v_other_name, 40),
    'message', 'Solicitud enviada.');
end;
$$;

-- ── Responder ───────────────────────────────────────────────────────
-- Solo quien RECIBE puede aceptar: si valiera cualquiera de los dos, quien
-- pide se aceptaría a sí mismo. Rechazar borra la fila; no se guarda rencor.
create or replace function public.friend_respond(p_friendship uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.friendships;
  v_mine integer;
  v_theirs integer;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if p_accept is null then raise exception 'Respuesta inválida'; end if;

  select * into v_row
  from public.friendships f
  where f.id = p_friendship and f.addressee = v_uid and f.status = 'pending'
  for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;

  if not p_accept then
    delete from public.friendships f where f.id = v_row.id;
    return 'rejected';
  end if;

  select count(*) into v_mine
  from public.friendships f
  where f.status = 'accepted' and (f.requester = v_uid or f.addressee = v_uid);
  select count(*) into v_theirs
  from public.friendships f
  where f.status = 'accepted' and (f.requester = v_row.requester or f.addressee = v_row.requester);
  if v_mine >= 100 then raise exception 'Has llegado al máximo de 100 amigos.'; end if;
  if v_theirs >= 100 then raise exception 'Esa persona ya tiene el máximo de amigos.'; end if;

  update public.friendships f set status = 'accepted', accepted_at = now() where f.id = v_row.id;
  return 'accepted';
end;
$$;

-- ── Quitar un amigo (o retirar una solicitud propia) ────────────────
create or replace function public.friend_remove(p_friendship uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rows integer;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;

  delete from public.friendships f
  where f.id = p_friendship and (f.requester = v_uid or f.addressee = v_uid);
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'Amistad no encontrada'; end if;
end;
$$;

-- ── El marcador ─────────────────────────────────────────────────────
-- Yo + mis amigos aceptados. ÚNICAMENTE lo que un marcador necesita.
--
-- Cumplimiento = completadas / programadas, con el mismo criterio que
-- questsScheduledOn (src/lib/closing.ts): solo misiones activas, sin
-- penalizaciones, sin hábitos consolidados, y por día de la semana ISO. Además
-- se quitan las extra (is_bonus: son opcionales, no "programadas") y solo se
-- cuenta cada misión desde el día en que se creó, o crear un hábito hoy
-- hundiría el porcentaje de toda la semana.
--
-- HOY solo cuenta lo ya completado: una misión pendiente a las 9 de la mañana
-- no es un fallo todavía. Así el porcentaje no castiga a quien madruga para
-- mirar el ranking, y aun así sube en directo al cumplir.
--
-- XP de la ventana = suma de completions.xp_awarded, con dos recortes:
--   · fuera las misiones de penalización: devuelven de golpe lo perdido en una
--     ausencia (miles de XP) y "quién mejora más" lo ganaría quien más faltó;
--   · cada completion pesa como mucho 500 (el techo real ronda 469). Las
--     completions las inserta el cliente y el CHECK admite hasta 50.000 para
--     las recuperaciones; sin este tope, una fila trucada gana el ranking.
--
-- "Hoy" es el de CADA gladiador (su timezone), porque completions.date es la
-- fecha local que puso su móvil.
--
-- Quien se ha ocultado (social_visible = false) sale sin cifras ni retrato,
-- solo con nombre y friendship_id: hace falta para poder quitarle; sin esa
-- fila sería una amistad fantasma que ocupa hueco y no se puede borrar.
create or replace function public.friends_board(p_days integer default 7)
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

  return query
  with miembros as (
    select v_uid as uid, null::uuid as fid
    union all
    select case when f.requester = v_uid then f.addressee else f.requester end, f.id
    from public.friendships f
    where f.status = 'accepted' and (f.requester = v_uid or f.addressee = v_uid)
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
    -- Solo una ruta dentro de SU carpeta. avatar_url es texto que edita su
    -- dueño: no se reparte a los amigos cualquier cadena que alguien escriba.
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

-- ── Solicitudes pendientes ──────────────────────────────────────────
-- De quien todavía NO es tu amigo solo sale nombre y nivel. Ni retrato ni XP:
--   · el código de amigo se publica en stories, así que cualquiera puede
--     mandarte una solicitud; si con ella viajara su foto, las solicitudes
--     serían una forma de enseñarle una imagen a quien no la ha pedido;
--   · y al revés: pedirle amistad a alguien no da derecho a ver su cara.
-- La política de storage de abajo va a juego: solo amigos ACEPTADOS.
create or replace function public.friend_requests()
returns table (
  friendship_id uuid,
  direction text,
  name text,
  level integer,
  created_at timestamptz
)
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
  select
    f.id,
    case when f.addressee = v_uid then 'incoming' else 'outgoing' end,
    left(p.name, 40),
    public.level_from_xp(p.xp_total),
    f.created_at
  from public.friendships f
  join public.profiles p
    on p.id = case when f.addressee = v_uid then f.requester else f.addressee end
  where f.status = 'pending' and (f.requester = v_uid or f.addressee = v_uid)
  order by f.created_at desc;
end;
$$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.gen_friend_code() from public, anon, authenticated;
revoke all on function public.set_friend_code() from public, anon, authenticated;
revoke all on function public.safe_tz(text) from public, anon;
revoke all on function public.level_from_xp(integer) from public, anon;
revoke all on function public.is_friend_folder(text) from public, anon;
revoke all on function public.friend_request(text) from public, anon;
revoke all on function public.friend_respond(uuid, boolean) from public, anon;
revoke all on function public.friend_remove(uuid) from public, anon;
revoke all on function public.friends_board(integer) from public, anon;
revoke all on function public.friend_requests() from public, anon;

grant execute on function public.safe_tz(text) to authenticated;
grant execute on function public.level_from_xp(integer) to authenticated;
-- La evalúa la política de storage con el rol del que pide la firma.
grant execute on function public.is_friend_folder(text) to authenticated;
grant execute on function public.friend_request(text) to authenticated;
grant execute on function public.friend_respond(uuid, boolean) to authenticated;
grant execute on function public.friend_remove(uuid) to authenticated;
grant execute on function public.friends_board(integer) to authenticated;
grant execute on function public.friend_requests() to authenticated;

-- ── El retrato de un amigo ──────────────────────────────────────────
-- El bucket `avatars` es privado y la política "own avatars" (0001) solo deja
-- entrar a cada uno en su carpeta {user_id}/. Esta añade UNA cosa: LEER la
-- carpeta de un amigo aceptado que no se haya ocultado. Solo select (firmar una
-- URL lo es); subir, pisar o borrar sigue siendo cosa del dueño. El bucket
-- `evidence` no se toca: las fotos de evidencia no son de nadie más.
drop policy if exists "friend avatars" on storage.objects;
create policy "friend avatars" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and public.is_friend_folder((storage.foldername(name))[1])
  );

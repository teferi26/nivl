-- Social safety: report, bilateral block and pre-publication profile review.
-- Applies equally to every account. Existing profiles also start pending.
begin;

create table if not exists public.social_blocks (
  blocker uuid not null references auth.users(id) on delete cascade,
  blocked uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker, blocked), check(blocker <> blocked)
);
create index if not exists social_blocks_reverse on public.social_blocks(blocked, blocker);
create table if not exists public.social_profile_reviews (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','approved','rejected','suspended')),
  approved_name text, approved_avatar text, approved_title text,
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz, review_note text
);
create table if not exists public.social_reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references auth.users(id) on delete cascade,
  subject uuid not null references auth.users(id) on delete cascade,
  reason text not null check(reason in ('name','avatar','harassment','impersonation')),
  displayed_name text, displayed_avatar text, displayed_title text,
  status text not null default 'open' check(status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now(), resolved_at timestamptz, resolution text,
  check(reporter <> subject)
);
create unique index if not exists social_reports_open on public.social_reports(reporter,subject,reason) where status='open';
create index if not exists social_reports_queue on public.social_reports(status,created_at);
-- Tombstones prevent delete/reupload from changing bytes behind an old signed URL.
create table if not exists public.social_avatar_paths (
  path text primary key,
  user_id uuid not null references auth.users(id) on delete cascade
);
alter table public.social_avatar_paths enable row level security;
revoke all on public.social_avatar_paths from public,anon,authenticated;
grant all on public.social_avatar_paths to service_role;
insert into public.social_avatar_paths(path,user_id)
select o.name,p.id from storage.objects o join public.profiles p on split_part(o.name,'/',1)=p.id::text
where o.bucket_id='avatars' on conflict do nothing;
insert into public.social_avatar_paths(path,user_id)
select avatar_url,id from public.profiles where avatar_url like id::text||'/%' on conflict do nothing;
alter table public.social_blocks enable row level security;
alter table public.social_profile_reviews enable row level security;
alter table public.social_reports enable row level security;
revoke all on public.social_blocks, public.social_profile_reviews, public.social_reports from public,anon,authenticated;
grant all on public.social_blocks, public.social_profile_reviews, public.social_reports to service_role;
insert into public.social_profile_reviews(user_id) select id from public.profiles on conflict do nothing;

create or replace function public.social_pair_allowed(p_a uuid,p_b uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select (auth.uid() is null or auth.uid() in (p_a,p_b)) and p_a is not null and p_b is not null and (
    p_a=p_b or (not exists(select 1 from public.social_blocks b where
      (b.blocker=p_a and b.blocked=p_b) or (b.blocker=p_b and b.blocked=p_a))
      and not exists(select 1 from public.social_profile_reviews r where r.user_id in (p_a,p_b) and r.status='suspended'))
  );
$$;
create or replace function public.social_known_user(p_viewer uuid,p_subject uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.friendships f where
    (f.requester=p_viewer and f.addressee=p_subject) or (f.addressee=p_viewer and f.requester=p_subject))
  or exists(select 1 from public.elite_group_members a join public.elite_group_members b on b.group_id=a.group_id
    where a.user_id=p_viewer and b.user_id=p_subject and public.user_tier(p_viewer) in ('elite','owner'));
$$;
create or replace function public.social_public_name(p_user uuid)
returns text language sql stable security definer set search_path=public as $$
  select coalesce((select r.approved_name from public.social_profile_reviews r join public.profiles p on p.id=r.user_id
    where r.user_id=p_user and r.status='approved' and r.approved_name=p.name), 'Gladiador '||left(p_user::text,6));
$$;
create or replace function public.social_profile_pending()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' or new.name is distinct from old.name or new.avatar_url is distinct from old.avatar_url
     or new.equipped_title is distinct from old.equipped_title then
    insert into public.social_profile_reviews(user_id) values(new.id)
    on conflict(user_id) do update set status=case when social_profile_reviews.status='suspended' then 'suspended' else 'pending' end,
      approved_name=null,approved_avatar=null,approved_title=null,updated_at=now(),reviewed_at=null,review_note=null;
  end if;
  return new;
end;
$$;
drop trigger if exists social_profile_pending on public.profiles;
create trigger social_profile_pending after insert or update of name,avatar_url,equipped_title on public.profiles
for each row execute function public.social_profile_pending();

-- Replacing bytes at an already reviewed path must invalidate approval too.
create or replace function public.social_avatar_pending()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.bucket_id='avatars' then
    update public.social_profile_reviews r set status=case when r.status='suspended' then 'suspended' else 'pending' end,
      approved_avatar=null,updated_at=now(),reviewed_at=null
    from public.profiles p where p.id=r.user_id and p.avatar_url=new.name;
  end if;
  return new;
end;
$$;
drop trigger if exists social_avatar_pending on storage.objects;
create trigger social_avatar_pending after insert or update of name,metadata,updated_at on storage.objects
for each row execute function public.social_avatar_pending();

create or replace function public.social_avatar_immutable()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_owner uuid;
begin
  if tg_op='UPDATE' then
    if old.bucket_id='avatars' or new.bucket_id='avatars' then
      if new.bucket_id is distinct from old.bucket_id or new.name is distinct from old.name
        or new.metadata is distinct from old.metadata or new.updated_at is distinct from old.updated_at
      then raise exception 'El retrato requiere una ruta nueva'; end if;
    end if;
  elsif new.bucket_id='avatars' then
    select id into v_owner from public.profiles where id::text=split_part(new.name,'/',1);
    if v_owner is null then raise exception 'Ruta de retrato no válida'; end if;
    insert into public.social_avatar_paths(path,user_id) values(new.name,v_owner) on conflict do nothing;
    if not found then raise exception 'El retrato requiere una ruta nueva'; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists social_avatar_immutable on storage.objects;
create trigger social_avatar_immutable before insert or update on storage.objects
for each row execute function public.social_avatar_immutable();
drop policy if exists social_avatar_no_overwrite on storage.objects;
create policy social_avatar_no_overwrite on storage.objects as restrictive for update to authenticated
using(bucket_id<>'avatars') with check(bucket_id<>'avatars');

create or replace function public.social_friend_guard()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(least(new.requester,new.addressee)::text||greatest(new.requester,new.addressee)::text,32));
  if not public.social_pair_allowed(new.requester,new.addressee) then raise exception 'Solicitud no disponible'; end if;
  return new;
end;
$$;
drop trigger if exists social_friend_guard on public.friendships;
create trigger social_friend_guard before insert or update on public.friendships for each row execute function public.social_friend_guard();

create or replace function public.social_block_user(p_user uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid();
begin
  if v_uid is null or p_user is null or v_uid=p_user then raise exception 'Usuario no disponible'; end if;
  perform pg_advisory_xact_lock(hashtextextended(least(v_uid,p_user)::text||greatest(v_uid,p_user)::text,32));
  if not public.social_known_user(v_uid,p_user) and not exists(select 1 from public.social_blocks where blocker=v_uid and blocked=p_user)
  then raise exception 'Usuario no disponible'; end if;
  insert into public.social_blocks(blocker,blocked) values(v_uid,p_user) on conflict do nothing;
  delete from public.friendships where (requester=v_uid and addressee=p_user) or (requester=p_user and addressee=v_uid);
end;
$$;
create or replace function public.social_unblock_user(p_user uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  delete from public.social_blocks where blocker=auth.uid() and blocked=p_user;
end;
$$;
create or replace function public.social_blocked_users()
returns table(user_id uuid,name text) language sql stable security definer set search_path=public as $$
  select b.blocked, public.social_public_name(b.blocked) from public.social_blocks b where b.blocker=auth.uid() order by b.created_at;
$$;
create or replace function public.social_report_user(p_user uuid,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid();
begin
  if v_uid is null or p_user is null or v_uid=p_user or p_reason is null or p_reason not in ('name','avatar','harassment','impersonation')
    then raise exception 'Denuncia no válida'; end if;
  if not public.social_known_user(v_uid,p_user) and not exists(select 1 from public.social_blocks where blocker=v_uid and blocked=p_user)
    then raise exception 'Usuario no disponible'; end if;
  perform pg_advisory_xact_lock(hashtextextended('social-report:'||v_uid::text,32));
  if exists(select 1 from public.social_reports where reporter=v_uid and subject=p_user and reason=p_reason and status='open') then return; end if;
  if (select count(*) from public.social_reports where reporter=v_uid and created_at>now()-interval '1 hour')>=10
    then raise exception 'Límite de denuncias alcanzado'; end if;
  insert into public.social_reports(reporter,subject,reason,displayed_name,displayed_avatar,displayed_title)
  select v_uid,p_user,p_reason,public.social_public_name(p_user),r.approved_avatar,r.approved_title
  from public.social_profile_reviews r where r.user_id=p_user;
end;
$$;

-- Only the exact reviewed snapshot can be approved. No client can invoke this.
create or replace function public.social_review_profile(p_user uuid,p_name text,p_avatar text,p_title text,
  p_avatar_updated_at timestamptz,p_decision text,p_note text)
returns void language plpgsql security definer set search_path=public as $$
declare p public.profiles; v_updated timestamptz;
begin
  if p_decision is null or p_decision not in ('approved','rejected','suspended') or length(btrim(coalesce(p_note,'')))<3
    then raise exception 'Decisión y motivo requeridos'; end if;
  select * into p from public.profiles where id=p_user for update;
  if not found or p.name is distinct from p_name or p.avatar_url is distinct from p_avatar or p.equipped_title is distinct from p_title
    then raise exception 'El perfil cambió; revisar de nuevo'; end if;
  if p_avatar is not null then
    select updated_at into v_updated from storage.objects where bucket_id='avatars' and name=p_avatar for update;
    if p_decision='approved' and (not found or p_avatar not like p_user::text||'/%' or v_updated is distinct from p_avatar_updated_at)
      then raise exception 'La foto cambió; revisar de nuevo'; end if;
  end if;
  update public.social_profile_reviews set status=p_decision,
    approved_name=case when p_decision='approved' then p_name end,
    approved_avatar=case when p_decision='approved' then p_avatar end,
    approved_title=case when p_decision='approved' then p_title end,
    reviewed_at=now(),updated_at=now(),review_note=left(p_note,500) where user_id=p_user;
end;
$$;

create or replace function public.social_avatar_readable(p_path text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p join public.social_profile_reviews r on r.user_id=p.id
    where p.avatar_url=p_path and p_path like p.id::text||'/%' and p.social_visible
      and r.status='approved' and r.approved_avatar=p_path
      and public.social_pair_allowed(auth.uid(),p.id) and (
        exists(select 1 from public.friendships f where f.status='accepted' and
          ((f.requester=auth.uid() and f.addressee=p.id) or (f.addressee=auth.uid() and f.requester=p.id)))
        or exists(select 1 from public.elite_group_members a join public.elite_group_members b on b.group_id=a.group_id
          where a.user_id=auth.uid() and b.user_id=p.id and public.user_tier(auth.uid()) in ('elite','owner'))));
$$;
drop policy if exists "friend avatars" on storage.objects;
create policy "friend avatars" on storage.objects for select to authenticated
using(bucket_id='avatars' and public.social_avatar_readable(name));
drop policy if exists social_avatar_safety on storage.objects;
create policy social_avatar_safety on storage.objects as restrictive for select to authenticated
using(bucket_id<>'avatars' or (storage.foldername(name))[1]=auth.uid()::text or public.social_avatar_readable(name));
drop policy if exists social_friend_safety on public.friendships;
create policy social_friend_safety on public.friendships as restrictive for select to authenticated
using(public.social_pair_allowed(requester,addressee));

-- RPC replacements below preserve the existing XP and health-consent rules.

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
      case when m.uid=v_uid then p.name else public.social_public_name(m.uid) end as nombre,
      case when m.uid=v_uid then p.avatar_url when r.status='approved' and r.approved_avatar=p.avatar_url then p.avatar_url end as retrato,
      p.xp_total as xp,
      p.streak_days as racha,
      case when m.uid=v_uid then p.equipped_title when r.status='approved' and r.approved_title=p.equipped_title then p.equipped_title end as titulo,
      p.profile_kind as tipo,
      z.tz,
      (now() at time zone z.tz)::date as hoy
    from miembros m
    join public.profiles p on p.id = m.uid
    left join public.social_profile_reviews r on r.user_id=m.uid
    cross join lateral (select public.safe_tz(p.timezone) as tz) z
    where public.social_pair_allowed(v_uid,m.uid)
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
      and (not public.health_row('quests',to_jsonb(q)) or public.health_consent_active(q.user_id))
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
      and (not public.health_row('quests',to_jsonb(q)) or public.health_consent_active(q.user_id))
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
      case when m.uid=v_uid then p.name else public.social_public_name(m.uid) end as nombre,
      case when m.uid=v_uid then p.avatar_url when r.status='approved' and r.approved_avatar=p.avatar_url then p.avatar_url end as retrato,
      p.xp_total as xp,
      p.streak_days as racha,
      case when m.uid=v_uid then p.equipped_title when r.status='approved' and r.approved_title=p.equipped_title then p.equipped_title end as titulo,
      p.profile_kind as tipo,
      z.tz,
      (now() at time zone z.tz)::date as hoy
    from miembros m
    join public.profiles p on p.id = m.uid
    left join public.social_profile_reviews r on r.user_id=m.uid
    cross join lateral (select public.safe_tz(p.timezone) as tz) z
    where public.social_pair_allowed(v_uid,m.uid)
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
      and (not public.health_row('quests',to_jsonb(q)) or public.health_consent_active(q.user_id))
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
      and (not public.health_row('quests',to_jsonb(q)) or public.health_consent_active(q.user_id))
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

  select p.id, public.social_public_name(p.id) into v_other, v_other_name
  from public.profiles p where p.friend_code = v_code;
  if v_other is null or not public.social_pair_allowed(v_uid,v_other) then
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
    public.social_public_name(p.id),
    public.level_from_xp(p.xp_total),
    f.created_at
  from public.friendships f
  join public.profiles p
    on p.id = case when f.addressee = v_uid then f.requester else f.addressee end
  where f.status = 'pending' and (f.requester = v_uid or f.addressee = v_uid) and public.social_pair_allowed(v_uid,p.id)
  order by f.created_at desc;
end;
$$;

create or replace function public.friend_requests_safe()
returns table (
  friendship_id uuid,
  user_id uuid,
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
    p.id,
    case when f.addressee = v_uid then 'incoming' else 'outgoing' end,
    public.social_public_name(p.id),
    public.level_from_xp(p.xp_total),
    f.created_at
  from public.friendships f
  join public.profiles p
    on p.id = case when f.addressee = v_uid then f.requester else f.addressee end
  where f.status = 'pending' and (f.requester = v_uid or f.addressee = v_uid) and public.social_pair_allowed(v_uid,p.id)
  order by f.created_at desc;
end;
$$;

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
    and public.user_tier(m.uid) = 'elite' and public.social_pair_allowed(v_uid,m.uid);
end;
$$;

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
      and p.social_visible and public.social_pair_allowed(auth.uid(),p.id)
  );
$$;

revoke all on function public.social_known_user(uuid,uuid) from public,anon,authenticated;
revoke all on function public.social_public_name(uuid) from public,anon,authenticated;
revoke all on function public.social_profile_pending() from public,anon,authenticated;
revoke all on function public.social_avatar_pending() from public,anon,authenticated;
revoke all on function public.social_avatar_immutable() from public,anon,authenticated;
revoke all on function public.social_friend_guard() from public,anon,authenticated;
revoke all on function public.social_pair_allowed(uuid,uuid) from public,anon,authenticated;
revoke all on function public.social_avatar_readable(text) from public,anon,authenticated;
revoke all on function public.social_block_user(uuid) from public,anon,authenticated;
revoke all on function public.social_unblock_user(uuid) from public,anon,authenticated;
revoke all on function public.social_blocked_users() from public,anon,authenticated;
revoke all on function public.social_report_user(uuid,text) from public,anon,authenticated;
revoke all on function public.friend_requests_safe() from public,anon,authenticated;
grant execute on function public.social_pair_allowed(uuid,uuid) to authenticated;
grant execute on function public.social_avatar_readable(text) to authenticated;
grant execute on function public.social_block_user(uuid) to authenticated;
grant execute on function public.social_unblock_user(uuid) to authenticated;
grant execute on function public.social_blocked_users() to authenticated;
grant execute on function public.social_report_user(uuid,text) to authenticated;
grant execute on function public.friend_requests_safe() to authenticated;
revoke all on function public.social_review_profile(uuid,text,text,text,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.social_review_profile(uuid,text,text,text,timestamptz,text,text) to service_role;
notify pgrst, 'reload schema';
commit;

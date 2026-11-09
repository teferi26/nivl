-- 0143 · Filtro automático de alias, títulos y fotos antes de que los vean otros (Apple 1.2).
-- Huella: to_regprocedure('public.social_filtro_aplicar(uuid,text,text,text,text,text,text)') is not null
--
-- Cada campo se publica por separado: cambiar el título no oculta la foto.
--   · Alias y título: una lista de términos en la base los para al guardar. Lo demás espera a la función
--     `perfil-filtro` (Haiku 5.5). Si el modelo no está disponible, pasan con la lista: falla abierto.
--   · Foto: no se ve hasta que el filtro o una persona la aprueban. Falla cerrado.
-- Enviar la foto a Anthropic necesita permiso expreso para esa foto (foto_permiso_path). Sin él, espera a
-- revisión manual en /moderacion. Denuncia, bloqueo y suspensión no cambian. Los perfiles ya publicados
-- tampoco: solo se filtra lo que cambie a partir de aquí.
begin;

alter table public.social_profile_reviews
  add column if not exists nombre_estado text check (nombre_estado in ('pendiente','ok','rechazado')),
  add column if not exists titulo_estado text check (titulo_estado in ('pendiente','ok','rechazado')),
  add column if not exists foto_estado text check (foto_estado in ('pendiente','ok','rechazado','revision')),
  add column if not exists foto_permiso_path text,
  add column if not exists filtro_intentos integer not null default 0,
  add column if not exists filtro_dia date;

-- Sin datos personales: solo el total del día, para el freno global y para ver el coste.
create table if not exists public.moderacion_filtro_dia (
  dia date primary key,
  llamadas integer not null default 0,
  micro_usd bigint not null default 0
);
alter table public.moderacion_filtro_dia enable row level security;
revoke all on public.moderacion_filtro_dia from public, anon, authenticated;
grant all on public.moderacion_filtro_dia to service_role;

-- La lista es corta a propósito: lo que tiene matices lo decide el modelo. Las palabras cortas o con
-- significado limpio van por palabra entera; las inequívocas, también pegadas o camufladas con números.
create or replace function public.social_texto_prohibido(p_texto text)
returns boolean language sql immutable set search_path = public, pg_temp as $$
  with t as (
    select lower(coalesce(p_texto, '')) as crudo,
      translate(lower(coalesce(p_texto, '')), 'áàäâãéèëêíìïîóòöôõúùüûñç@$013457', 'aaaaaeeeeiiiiooooouuuuncasoieast') as norm
  )
  select
    crudo ~ '(https?://|www\.|[a-z0-9-]+\.(com|net|org|es|io|app|me|ly)\y|@[a-z0-9_]{3,}|[0-9]{7,})'
    or norm ~ '(^|[^a-z])(puta|puto|putas|putos|zorra|polla|mierda|cabron|nazi|nazis|fuck|fucker|shit|bitch|cunt|whore|nigga|porn|porno|xxx|hure|fotze|salope|pute|encule|cazzo|vaffanculo|caralho|foder)($|[^a-z])'
    or regexp_replace(norm, '[^a-z]', '', 'g') ~ '(hitler|pedofil|violador|negrata|maricon|sudaca|nigger|faggot|kukluxklan|hijoputa|hijodeputa|gilipollas|motherfuck)'
  from t;
$$;

create or replace function public.social_texto_estado(p_texto text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select case when p_texto is null then null
    when public.social_texto_prohibido(p_texto) then 'rechazado' else 'pendiente' end;
$$;

create or replace function public.social_profile_pending()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_nombre boolean := tg_op = 'INSERT' or new.name is distinct from old.name;
  v_titulo boolean := tg_op = 'INSERT' or new.equipped_title is distinct from old.equipped_title;
  v_foto boolean := tg_op = 'INSERT' or new.avatar_url is distinct from old.avatar_url;
begin
  if not (v_nombre or v_titulo or v_foto) then
    return new;
  end if;
  insert into public.social_profile_reviews as r
    (user_id, status, nombre_estado, titulo_estado, foto_estado, review_note)
  values (new.id, 'approved', public.social_texto_estado(new.name), public.social_texto_estado(new.equipped_title),
    case when new.avatar_url is null then null else 'pendiente' end, 'auto')
  on conflict (user_id) do update set
    status = case when r.status = 'suspended' then 'suspended' else 'approved' end,
    approved_name = case when r.status = 'suspended' or v_nombre then null else r.approved_name end,
    approved_title = case when r.status = 'suspended' or v_titulo then null else r.approved_title end,
    approved_avatar = case when r.status = 'suspended' or v_foto then null else r.approved_avatar end,
    nombre_estado = case when v_nombre then public.social_texto_estado(new.name) else r.nombre_estado end,
    titulo_estado = case when v_titulo then public.social_texto_estado(new.equipped_title) else r.titulo_estado end,
    foto_estado = case when v_foto then (case when new.avatar_url is null then null else 'pendiente' end) else r.foto_estado end,
    foto_permiso_path = case when v_foto then null else r.foto_permiso_path end,
    updated_at = now(),
    reviewed_at = case when r.status = 'suspended' then r.reviewed_at end,
    review_note = case when r.status = 'suspended' then r.review_note else 'auto' end;
  return new;
end;
$function$;

-- La 0087 publicaba aquí la foto al subirla. Ahora solo la deja pendiente.
create or replace function public.social_avatar_pending()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.bucket_id = 'avatars' then
    update public.social_profile_reviews r set
      approved_avatar = null,
      foto_estado = case when r.status = 'suspended' then r.foto_estado else 'pendiente' end,
      updated_at = now(),
      reviewed_at = case when r.status = 'suspended' then r.reviewed_at end,
      review_note = case when r.status = 'suspended' then r.review_note else 'auto' end
    from public.profiles p
    where p.id = r.user_id and p.avatar_url = new.name;
  end if;
  return new;
end;
$function$;

-- El dueño de la foto autoriza enviar ESA foto al filtro. Cambiar de foto retira el permiso.
create or replace function public.social_filtro_permitir_foto(p_path text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or p_path is null or p_path not like v_uid::text || '/%' then
    raise exception 'Foto no válida' using errcode = '42501';
  end if;
  update public.social_profile_reviews r set foto_permiso_path = p_path
    from public.profiles p
    where p.id = r.user_id and r.user_id = v_uid and p.avatar_url = p_path;
  if not found then
    raise exception 'Foto no válida' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.social_filtro_permitir_foto(text) from public, anon;
grant execute on function public.social_filtro_permitir_foto(text) to authenticated;

-- Freno: 30 llamadas por persona y día, y un tope global diario. Sin cupo no se llama al modelo.
create or replace function public.social_filtro_reservar(p_user uuid, p_micro bigint)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_dia date := (now() at time zone 'utc')::date;
begin
  update public.social_profile_reviews set
    filtro_intentos = case when filtro_dia = v_dia then filtro_intentos + 1 else 1 end,
    filtro_dia = v_dia
  where user_id = p_user and (filtro_dia is distinct from v_dia or filtro_intentos < 30);
  if not found then
    return false;
  end if;
  insert into public.moderacion_filtro_dia as d (dia, llamadas, micro_usd) values (v_dia, 1, greatest(p_micro, 0))
  on conflict (dia) do update set llamadas = d.llamadas + 1, micro_usd = d.micro_usd + greatest(p_micro, 0)
  where d.llamadas < 20000 and d.micro_usd + greatest(p_micro, 0) <= 20000000;
  return found;
end;
$$;

create or replace function public.social_filtro_liquidar(p_reservado bigint, p_real bigint)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.moderacion_filtro_dia
     set micro_usd = greatest(0, micro_usd - greatest(p_reservado, 0) + greatest(p_real, 0))
   where dia = (now() at time zone 'utc')::date;
$$;

-- Aplica el veredicto solo si el campo sigue siendo el que se filtró. Null = sin veredicto para ese campo.
create or replace function public.social_filtro_aplicar(
  p_user uuid, p_name text, p_title text, p_avatar text, p_nombre text, p_titulo text, p_foto text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p public.profiles;
  r public.social_profile_reviews;
  v_nombre text;
  v_titulo text;
  v_foto text;
begin
  if (p_nombre is not null and p_nombre not in ('ok','rechazado'))
     or (p_titulo is not null and p_titulo not in ('ok','rechazado'))
     or (p_foto is not null and p_foto not in ('ok','rechazado','revision')) then
    raise exception 'Veredicto no válido' using errcode = '22023';
  end if;
  select * into p from public.profiles where id = p_user for update;
  select * into r from public.social_profile_reviews where user_id = p_user for update;
  if p.id is null or r.user_id is null or r.status = 'suspended' then
    return jsonb_build_object('nombre', null, 'titulo', null, 'foto', null);
  end if;
  if r.nombre_estado = 'pendiente' and p.name is not distinct from p_name then v_nombre := p_nombre; end if;
  if r.titulo_estado = 'pendiente' and p.equipped_title is not distinct from p_title then v_titulo := p_titulo; end if;
  if r.foto_estado in ('pendiente','revision') and p.avatar_url is not null and p.avatar_url = p_avatar then
    v_foto := p_foto;
    -- «ok» exige que la foto exista, sea suya y que su dueño haya autorizado enviarla.
    if v_foto = 'ok' and (r.foto_permiso_path is distinct from p_avatar or p_avatar not like p_user::text || '/%'
      or not exists (select 1 from storage.objects o where o.bucket_id = 'avatars' and o.name = p_avatar)) then
      v_foto := 'revision';
    end if;
  end if;
  if v_nombre is null and v_titulo is null and v_foto is null then
    return jsonb_build_object('nombre', r.nombre_estado, 'titulo', r.titulo_estado, 'foto', r.foto_estado);
  end if;
  update public.social_profile_reviews set
    nombre_estado = coalesce(v_nombre, nombre_estado),
    approved_name = case v_nombre when 'ok' then p.name when 'rechazado' then null else approved_name end,
    titulo_estado = coalesce(v_titulo, titulo_estado),
    approved_title = case v_titulo when 'ok' then p.equipped_title when 'rechazado' then null else approved_title end,
    foto_estado = coalesce(v_foto, foto_estado),
    approved_avatar = case v_foto when 'ok' then p.avatar_url when 'rechazado' then null when 'revision' then null else approved_avatar end,
    status = 'approved',
    updated_at = now(),
    reviewed_at = null,
    review_note = 'auto'
  where user_id = p_user
  returning nombre_estado, titulo_estado, foto_estado into v_nombre, v_titulo, v_foto;
  return jsonb_build_object('nombre', v_nombre, 'titulo', v_titulo, 'foto', v_foto);
end;
$$;

revoke all on function public.social_filtro_reservar(uuid, bigint) from public, anon, authenticated;
revoke all on function public.social_filtro_liquidar(bigint, bigint) from public, anon, authenticated;
revoke all on function public.social_filtro_aplicar(uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.social_filtro_reservar(uuid, bigint) to service_role;
grant execute on function public.social_filtro_liquidar(bigint, bigint) to service_role;
grant execute on function public.social_filtro_aplicar(uuid, text, text, text, text, text, text) to service_role;

-- Una decisión humana cierra también el filtro: sin esto, el modelo podría deshacerla después.
create or replace function public.social_review_profile(p_user uuid,p_name text,p_avatar text,p_title text,
  p_avatar_updated_at timestamptz,p_decision text,p_note text)
returns void language plpgsql security definer set search_path=public as $$
declare p public.profiles; v_updated timestamptz; v_estado text;
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
  v_estado := case p_decision when 'approved' then 'ok' when 'rejected' then 'rechazado' end;
  update public.social_profile_reviews set status=p_decision,
    approved_name=case when p_decision='approved' then p_name end,
    approved_avatar=case when p_decision='approved' then p_avatar end,
    approved_title=case when p_decision='approved' then p_title end,
    nombre_estado=coalesce(v_estado,nombre_estado),
    titulo_estado=case when p_title is null then null else coalesce(v_estado,titulo_estado) end,
    foto_estado=case when p_avatar is null then null else coalesce(v_estado,foto_estado) end,
    reviewed_at=now(),updated_at=now(),review_note=left(p_note,500) where user_id=p_user;
end;
$$;

create or replace function public.moderacion_perfil_json(p public.profiles, r public.social_profile_reviews)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'user_id', r.user_id,
    'nombre', p.name,
    'foto', p.avatar_url,
    'titulo', p.equipped_title,
    'estado', r.status,
    'version', r.updated_at,
    'revisado_en', r.reviewed_at,
    'nota', r.review_note,
    'filtro', jsonb_build_object('nombre', r.nombre_estado, 'titulo', r.titulo_estado, 'foto', r.foto_estado)
  )
$$;
revoke all on function public.moderacion_perfil_json(public.profiles, public.social_profile_reviews) from public, anon, authenticated;

create or replace function public.admin_moderacion_levantar(p_user uuid, p_version timestamptz, p_nota text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r public.social_profile_reviews;
  p public.profiles;
begin
  perform public.exigir_admin();
  if length(btrim(coalesce(p_nota, ''))) < 3 then
    raise exception 'Falta el motivo' using errcode = '22023';
  end if;
  select * into p from public.profiles where id = p_user for update;
  select * into r from public.social_profile_reviews where user_id = p_user for update;
  if r.user_id is null or p.id is null then
    return jsonb_build_object('ok', false, 'motivo', 'no_encontrado');
  end if;
  if r.status <> 'suspended' then
    return jsonb_build_object('ok', false, 'motivo', 'no_suspendido');
  end if;
  if r.updated_at is distinct from p_version then
    return jsonb_build_object('ok', false, 'motivo', 'perfil_cambio');
  end if;
  update public.social_profile_reviews
     set status = 'approved', approved_name = p.name, approved_avatar = p.avatar_url, approved_title = p.equipped_title,
         nombre_estado = 'ok',
         titulo_estado = case when p.equipped_title is null then null else 'ok' end,
         foto_estado = case when p.avatar_url is null then null else 'ok' end,
         reviewed_at = now(), updated_at = now(),
         review_note = public.moderacion_registro('suspensión levantada', p_nota)
   where user_id = p_user;
  return jsonb_build_object('ok', true);
end
$$;

create or replace function public.admin_moderacion_marcar_revisado(p_user uuid, p_version timestamptz, p_nota text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r public.social_profile_reviews;
  p public.profiles;
begin
  perform public.exigir_admin();
  select * into p from public.profiles where id = p_user for update;
  select * into r from public.social_profile_reviews where user_id = p_user for update;
  if r.user_id is null or p.id is null then
    return jsonb_build_object('ok', false, 'motivo', 'no_encontrado');
  end if;
  if r.status not in ('approved', 'pending') then
    return jsonb_build_object('ok', false, 'motivo', 'estado');
  end if;
  if r.updated_at is distinct from p_version then
    return jsonb_build_object('ok', false, 'motivo', 'perfil_cambio');
  end if;
  update public.social_profile_reviews
     set status = 'approved', approved_name = p.name, approved_avatar = p.avatar_url, approved_title = p.equipped_title,
         nombre_estado = 'ok',
         titulo_estado = case when p.equipped_title is null then null else 'ok' end,
         foto_estado = case when p.avatar_url is null then null else 'ok' end,
         reviewed_at = now(), updated_at = now(),
         review_note = public.moderacion_registro('revisado', p_nota)
   where user_id = p_user;
  return jsonb_build_object('ok', true);
end
$$;
revoke all on function public.admin_moderacion_levantar(uuid, timestamptz, text) from public, anon;
grant execute on function public.admin_moderacion_levantar(uuid, timestamptz, text) to authenticated;
revoke all on function public.admin_moderacion_marcar_revisado(uuid, timestamptz, text) from public, anon;
grant execute on function public.admin_moderacion_marcar_revisado(uuid, timestamptz, text) to authenticated;

commit;

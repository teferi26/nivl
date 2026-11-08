-- 0088 · Panel de moderación: bandeja y acciones solo para admin, y un aviso que dice de qué va.
-- Huella: coalesce(obj_description(to_regprocedure('public.admin_moderacion_bandeja(integer)'),'pg_proc') like '%nivl:panel-moderacion-0088%', false)
-- Orden: 0087 → esta → despliegue de `ritual` → OTA/binario de la app y web /admin.
--
-- La misma lista y las mismas acciones sirven a la app (/moderacion) y a la web
-- (nivl.app/admin). Quién es admin lo dice la tabla `admins` (0072), que no se toca aquí.
--
-- Registro: no hay tabla de auditoría en el proyecto, así que quién resolvió y
-- cómo queda en `resolution` (denuncias) y `review_note` (perfiles) con el
-- formato «acción · admin <uuid> · fecha UTC · nota».
--
-- Sin tablas nuevas: export_my_data no cambia.

begin;

-- ── Piezas internas ──────────────────────────────────────────────────
create or replace function public.moderacion_registro(p_accion text, p_nota text)
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select left(
    p_accion || ' · admin ' || coalesce(auth.uid()::text, 'desconocido') || ' · '
    || to_char(now() at time zone 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC'
    || case when btrim(coalesce(p_nota, '')) <> '' then ' · ' || btrim(p_nota) else '' end,
    500)
$$;
revoke all on function public.moderacion_registro(text, text) from public, anon, authenticated;

-- El motivo en cristiano. Mismos textos que la app enseña al denunciar.
create or replace function public.moderacion_motivo(p_tipo text, p_motivo text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_tipo
    when 'perfil' then case p_motivo
      when 'name' then 'Nombre o título ofensivo'
      when 'avatar' then 'Foto inapropiada'
      when 'harassment' then 'Acoso o amenazas'
      when 'impersonation' then 'Suplantación de identidad'
      else p_motivo end
    when 'ia' then case p_motivo
      when 'danino' then 'Puede hacer daño'
      when 'salud' then 'Consejo de salud peligroso'
      when 'dinero' then 'Consejo de dinero peligroso'
      when 'incorrecto' then 'Información falsa'
      when 'ofensivo' then 'Ofensivo o inapropiado'
      when 'otro' then 'Otro motivo'
      else p_motivo end
    else p_motivo end
$$;
revoke all on function public.moderacion_motivo(text, text) from public, anon, authenticated;

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
    'nota', r.review_note
  )
$$;
revoke all on function public.moderacion_perfil_json(public.profiles, public.social_profile_reviews) from public, anon, authenticated;

-- ── La bandeja ───────────────────────────────────────────────────────
create or replace function public.admin_moderacion_bandeja(p_limite integer default 200)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_limite integer := greatest(1, least(coalesce(p_limite, 200), 500));
begin
  perform public.exigir_admin();
  return jsonb_build_object(
    'recuento', jsonb_build_object(
      'denuncias_perfil', (select count(*) from public.social_reports where status = 'open'),
      'denuncias_ia', (select count(*) from public.ai_reports where status = 'open'),
      'perfiles', (select count(*) from public.social_profile_reviews r
        where r.status = 'pending' or (r.status = 'approved' and r.review_note = 'auto' and r.reviewed_at is null)),
      'suspendidos', (select count(*) from public.social_profile_reviews where status = 'suspended')
    ),
    'denuncias_perfil', coalesce((
      select jsonb_agg(x.fila order by x.creada)
      from (
        select s.created_at as creada, jsonb_build_object(
          'tipo', 'perfil',
          'id', s.id,
          'motivo', s.reason,
          'motivo_texto', public.moderacion_motivo('perfil', s.reason),
          'creada_en', s.created_at,
          'denunciante', jsonb_build_object('id', s.reporter, 'nombre', rp.name),
          'denunciado', jsonb_build_object(
            'id', s.subject, 'nombre', sp.name, 'foto', sp.avatar_url, 'titulo', sp.equipped_title,
            'estado', r.status, 'version', r.updated_at),
          'mostrado', jsonb_build_object('nombre', s.displayed_name, 'foto', s.displayed_avatar, 'titulo', s.displayed_title)
        ) as fila
        from public.social_reports s
        left join public.profiles rp on rp.id = s.reporter
        left join public.profiles sp on sp.id = s.subject
        left join public.social_profile_reviews r on r.user_id = s.subject
        where s.status = 'open'
        order by s.created_at
        limit v_limite
      ) x
    ), '[]'::jsonb),
    'denuncias_ia', coalesce((
      select jsonb_agg(x.fila order by x.creada)
      from (
        select a.created_at as creada, jsonb_build_object(
          'tipo', 'ia',
          'id', a.id,
          'origen', a.source,
          'origen_texto', case a.source when 'coach' then 'Coach' when 'oraculo' then 'Oráculo' else a.source end,
          'motivo', a.reason,
          'motivo_texto', public.moderacion_motivo('ia', a.reason),
          'texto', a.excerpt,
          'creada_en', a.created_at,
          'denunciante', jsonb_build_object('id', a.reporter, 'nombre', rp.name)
        ) as fila
        from public.ai_reports a
        left join public.profiles rp on rp.id = a.reporter
        where a.status = 'open'
        order by a.created_at
        limit v_limite
      ) x
    ), '[]'::jsonb),
    'perfiles', coalesce((
      select jsonb_agg(x.fila order by x.creada)
      from (
        select r.updated_at as creada, public.moderacion_perfil_json(p, r) as fila
        from public.social_profile_reviews r
        join public.profiles p on p.id = r.user_id
        where r.status = 'pending' or (r.status = 'approved' and r.review_note = 'auto' and r.reviewed_at is null)
        order by r.updated_at
        limit v_limite
      ) x
    ), '[]'::jsonb),
    'suspendidos', coalesce((
      select jsonb_agg(x.fila order by x.creada desc)
      from (
        select r.updated_at as creada, public.moderacion_perfil_json(p, r) as fila
        from public.social_profile_reviews r
        join public.profiles p on p.id = r.user_id
        where r.status = 'suspended'
        order by r.updated_at desc
        limit v_limite
      ) x
    ), '[]'::jsonb)
  );
end
$$;
revoke all on function public.admin_moderacion_bandeja(integer) from public, anon;
grant execute on function public.admin_moderacion_bandeja(integer) to authenticated;
comment on function public.admin_moderacion_bandeja(integer) is
  'Todo lo abierto en moderación, con contexto. Solo admin. nivl:panel-moderacion-0088';

-- ── Cerrar una denuncia ──────────────────────────────────────────────
-- Dos dispositivos pueden actuar a la vez: el segundo recibe ok=false, no un error.
-- ai_reports lleva account_write_guard: si quien denunció está borrando su
-- cuenta, el guard lanza 42501 y la fila desaparecerá con el borrado.
create or replace function public.moderacion_cerrar_denuncia(
  p_tipo text, p_id uuid, p_estado text, p_accion text, p_nota text
) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_filas integer;
begin
  if p_tipo is null or p_tipo not in ('perfil', 'ia') then
    raise exception 'Tipo inválido' using errcode = '22023';
  end if;
  begin
    if p_tipo = 'perfil' then
      update public.social_reports
         set status = p_estado, resolved_at = now(), resolution = public.moderacion_registro(p_accion, p_nota)
       where id = p_id and status = 'open';
    else
      update public.ai_reports
         set status = p_estado, resolved_at = now(), resolution = public.moderacion_registro(p_accion, p_nota)
       where id = p_id and status = 'open';
    end if;
    get diagnostics v_filas = row_count;
  exception when insufficient_privilege then
    return jsonb_build_object('ok', false, 'motivo', 'borrado_pendiente');
  end;
  if v_filas = 0 then
    return jsonb_build_object('ok', false, 'motivo', 'ya_cerrada');
  end if;
  return jsonb_build_object('ok', true);
end
$$;
revoke all on function public.moderacion_cerrar_denuncia(text, uuid, text, text, text) from public, anon, authenticated;

create or replace function public.admin_moderacion_descartar(p_tipo text, p_id uuid, p_nota text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.exigir_admin();
  return public.moderacion_cerrar_denuncia(p_tipo, p_id, 'dismissed', 'descartada', p_nota);
end
$$;
revoke all on function public.admin_moderacion_descartar(text, uuid, text) from public, anon;
grant execute on function public.admin_moderacion_descartar(text, uuid, text) to authenticated;

create or replace function public.admin_moderacion_resolver(p_tipo text, p_id uuid, p_nota text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.exigir_admin();
  return public.moderacion_cerrar_denuncia(p_tipo, p_id, 'resolved', 'resuelta', p_nota);
end
$$;
revoke all on function public.admin_moderacion_resolver(text, uuid, text) from public, anon;
grant execute on function public.admin_moderacion_resolver(text, uuid, text) to authenticated;

-- ── Perfiles ─────────────────────────────────────────────────────────
-- p_denuncia cierra, en el mismo paso, la denuncia que motivó la suspensión.
create or replace function public.admin_moderacion_suspender(p_user uuid, p_nota text, p_denuncia uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_estado text;
begin
  perform public.exigir_admin();
  if length(btrim(coalesce(p_nota, ''))) < 3 then
    raise exception 'Falta el motivo' using errcode = '22023';
  end if;
  select status into v_estado from public.social_profile_reviews where user_id = p_user for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'no_encontrado');
  end if;
  if v_estado <> 'suspended' then
    update public.social_profile_reviews
       set status = 'suspended', approved_name = null, approved_avatar = null, approved_title = null,
           reviewed_at = now(), updated_at = now(),
           review_note = public.moderacion_registro('suspendido', p_nota)
     where user_id = p_user;
  end if;
  if p_denuncia is not null then
    update public.social_reports
       set status = 'resolved', resolved_at = now(),
           resolution = public.moderacion_registro('resuelta con suspensión', p_nota)
     where id = p_denuncia and subject = p_user and status = 'open';
  end if;
  return jsonb_build_object('ok', true);
end
$$;
revoke all on function public.admin_moderacion_suspender(uuid, text, uuid) from public, anon;
grant execute on function public.admin_moderacion_suspender(uuid, text, uuid) to authenticated;

-- p_version es el `version` que vio el admin: si el perfil cambió después, no
-- se da por bueno lo que nadie ha mirado.
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
         reviewed_at = now(), updated_at = now(),
         review_note = public.moderacion_registro('suspensión levantada', p_nota)
   where user_id = p_user;
  return jsonb_build_object('ok', true);
end
$$;
revoke all on function public.admin_moderacion_levantar(uuid, timestamptz, text) from public, anon;
grant execute on function public.admin_moderacion_levantar(uuid, timestamptz, text) to authenticated;

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
         reviewed_at = now(), updated_at = now(),
         review_note = public.moderacion_registro('revisado', p_nota)
   where user_id = p_user;
  return jsonb_build_object('ok', true);
end
$$;
revoke all on function public.admin_moderacion_marcar_revisado(uuid, timestamptz, text) from public, anon;
grant execute on function public.admin_moderacion_marcar_revisado(uuid, timestamptz, text) to authenticated;

-- ── La suspensión conserva su registro ───────────────────────────────
-- La 0087 borraba review_note y reviewed_at de un perfil suspendido cuando su
-- dueño cambiaba el nombre: se perdía quién suspendió y por qué.
create or replace function public.social_profile_pending()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op='INSERT' or new.name is distinct from old.name or new.avatar_url is distinct from old.avatar_url
     or new.equipped_title is distinct from old.equipped_title then
    insert into public.social_profile_reviews(user_id,status,approved_name,approved_avatar,approved_title,review_note)
    values(new.id,'approved',new.name,new.avatar_url,new.equipped_title,'auto')
    on conflict(user_id) do update set
      status=case when social_profile_reviews.status='suspended' then 'suspended' else 'approved' end,
      approved_name=case when social_profile_reviews.status='suspended' then null else new.name end,
      approved_avatar=case when social_profile_reviews.status='suspended' then null else new.avatar_url end,
      approved_title=case when social_profile_reviews.status='suspended' then null else new.equipped_title end,
      updated_at=now(),
      reviewed_at=case when social_profile_reviews.status='suspended' then social_profile_reviews.reviewed_at end,
      review_note=case when social_profile_reviews.status='suspended' then social_profile_reviews.review_note else 'auto' end;
  end if;
  return new;
end;
$function$;

-- ── Ver la foto denunciada ───────────────────────────────────────────
-- El bucket `avatars` es privado: el admin firma la URL con su sesión, sin
-- service_role. Copia de la 0032 con una condición más delante.
create or replace function public.social_avatar_readable(p_path text)
returns boolean language sql stable security definer set search_path=public as $$
  select public.es_admin() or exists(select 1 from public.profiles p join public.social_profile_reviews r on r.user_id=p.id
    where p.avatar_url=p_path and p_path like p.id::text||'/%' and p.social_visible
      and r.status='approved' and r.approved_avatar=p_path
      and public.social_pair_allowed(auth.uid(),p.id) and (
        exists(select 1 from public.friendships f where f.status='accepted' and
          ((f.requester=auth.uid() and f.addressee=p.id) or (f.addressee=auth.uid() and f.requester=p.id)))
        or exists(select 1 from public.elite_group_members a join public.elite_group_members b on b.group_id=a.group_id
          where a.user_id=auth.uid() and b.user_id=p.id and public.user_tier(auth.uid()) in ('elite','owner'))));
$$;

-- ── El aviso dice de qué va ──────────────────────────────────────────
-- Sigue sin contenido: recuentos y, si solo hay una denuncia nueva, su tipo y
-- su motivo (códigos cerrados). Avisa a los owner de siempre y a los admin.
create or replace function public.moderation_digest() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_since timestamptz;
  v_denuncias integer;
  v_perfiles integer;
  v_open integer;
  v_owners uuid[];
  v_detalle jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select last_alert_at into v_since from public.moderation_alert_state where id = 1 for update;

  select
    (select count(*) from public.social_reports where status = 'open' and created_at > v_since)
    + (select count(*) from public.ai_reports where status = 'open' and created_at > v_since),
    (select count(*) from public.social_profile_reviews where status = 'pending' and updated_at > v_since),
    (select count(*) from public.social_reports where status = 'open')
    + (select count(*) from public.ai_reports where status = 'open')
    + (select count(*) from public.social_profile_reviews where status = 'pending')
  into v_denuncias, v_perfiles, v_open;

  if v_denuncias = 1 then
    select d into v_detalle from (
      select jsonb_build_object('tipo', 'perfil', 'motivo', reason) as d
        from public.social_reports where status = 'open' and created_at > v_since
      union all
      select jsonb_build_object('tipo', 'ia', 'motivo', reason)
        from public.ai_reports where status = 'open' and created_at > v_since
    ) x limit 1;
  end if;

  select coalesce(array_agg(distinct u), '{}') into v_owners from (
    select s.user_id as u from public.subscriptions s where public.user_tier(s.user_id) = 'owner'
    union
    select a.user_id from public.admins a
  ) o;

  if v_denuncias + v_perfiles > 0 then
    update public.moderation_alert_state set last_alert_at = now() where id = 1;
  end if;
  return jsonb_build_object(
    'nuevos', v_denuncias + v_perfiles,
    'denuncias', v_denuncias,
    'perfiles', v_perfiles,
    'abiertos', v_open,
    'detalle', v_detalle,
    'owners', to_jsonb(v_owners)
  );
end $$;
revoke all on function public.moderation_digest() from public, anon, authenticated;
grant execute on function public.moderation_digest() to service_role;

commit;

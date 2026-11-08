-- NIVL · 0125 · Enlace de Apple TV por código (flujo de dispositivo, RFC 8628).
-- Huella (scripts/apply-migrations.mjs): comentario nivl:tv-enlace-0125 en tv_emitir_codigo(text).
-- Prueba: scripts/test-tv-enlace.mjs. Contrato para el cliente: tv/CONTRATO.md.
--
-- Qué hace y por qué así:
--   · La TV nunca recibe un JWT de usuario ni teclea una contraseña. Pide un código, lo enseña (texto y QR
--     nivl://tv/XXXX-XXXX), la persona lo confirma en su iPhone ya identificada y la TV canjea su secreto de
--     sondeo por un token opaco de 256 bits. Ese token solo sirve para tv_datos (0126) y tv_cerrar_sesion.
--   · En la base solo hay SHA-256 del secreto y del token. El código (8 caracteres, 10 minutos, un solo uso)
--     sí va en claro: vive poco y hay que buscarlo por valor.
--   · Las tablas tienen RLS y ninguna política, y los grants revocados: solo se entra por estas RPC SECURITY
--     DEFINER con search_path fijo.
--   · Sesión de SOLO LECTURA: nada de aquí toca XP, racha ni registros.
--
-- El contador de fallos NO se reinicia al acertar. Si se reiniciara, quien tantea podría limpiarlo aprobando
-- un código propio cada nueve intentos.
--
-- Sin revocación automática al cambiar la contraseña: el token no depende de la sesión de Auth. El dueño la
-- revoca con tv_revocar y borrar la cuenta se la lleva por la FK en cascada.
begin;

create table if not exists public.tv_enlaces (
  id uuid primary key default gen_random_uuid(),
  codigo text not null check (codigo ~ '^[A-HJ-NP-Z2-9]{8}$'),
  secreto_hash bytea not null unique check (octet_length(secreto_hash) = 32),
  nombre text not null check (char_length(nombre) between 1 and 40),
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobado','denegado')),
  user_id uuid references auth.users(id) on delete cascade,
  creado_en timestamptz not null default now(),
  caduca_en timestamptz not null,
  aprobado_en timestamptz,
  ultimo_sondeo timestamptz,
  check ((estado = 'aprobado') = (user_id is not null))
);
create unique index if not exists tv_enlaces_codigo_pendiente on public.tv_enlaces(codigo) where estado = 'pendiente';
create index if not exists tv_enlaces_caduca on public.tv_enlaces(caduca_en);
create index if not exists tv_enlaces_usuario on public.tv_enlaces(user_id) where user_id is not null;

create table if not exists public.tv_dispositivos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 40),
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  creado_en timestamptz not null default now(),
  ultimo_uso timestamptz not null default now(),
  caduca_en timestamptz not null
);
create index if not exists tv_dispositivos_usuario on public.tv_dispositivos(user_id);
create index if not exists tv_dispositivos_caduca on public.tv_dispositivos(caduca_en);

create table if not exists public.tv_intentos (
  user_id uuid primary key references auth.users(id) on delete cascade,
  fallos integer not null default 0 check (fallos >= 0),
  ventana_desde timestamptz not null default now()
);

alter table public.tv_enlaces enable row level security;
alter table public.tv_dispositivos enable row level security;
alter table public.tv_intentos enable row level security;
revoke all on public.tv_enlaces, public.tv_dispositivos, public.tv_intentos from public, anon, authenticated;

-- Mismo guardián que el resto de tablas con dueño (0031): con borrado pendiente no se escribe.
drop trigger if exists account_write_guard on public.tv_enlaces;
create trigger account_write_guard before insert or update on public.tv_enlaces
  for each row when (new.user_id is not null) execute function public.require_account_active('user_id');
drop trigger if exists account_write_guard on public.tv_dispositivos;
create trigger account_write_guard before insert or update on public.tv_dispositivos
  for each row execute function public.require_account_active('user_id');
drop trigger if exists account_write_guard on public.tv_intentos;
create trigger account_write_guard before insert or update on public.tv_intentos
  for each row execute function public.require_account_active('user_id');

-- ── Piezas internas (sin EXECUTE para nadie salvo el dueño de las funciones) ─────────────────────
create or replace function public._tv_sha(p_valor text) returns bytea
language sql immutable set search_path = pg_catalog as $$ select sha256(convert_to(p_valor, 'UTF8')) $$;

-- Admite XXXX-XXXX o XXXXXXXX, en minúsculas y con espacios: el QR y una persona lo escriben distinto.
create or replace function public._tv_codigo(p_codigo text) returns text
language sql immutable set search_path = pg_catalog as $$
  select case when c ~ '^[A-HJ-NP-Z2-9]{8}$' then c end
  from (select upper(regexp_replace(coalesce(p_codigo, ''), '[\s-]', '', 'g')) as c) x
$$;

-- true cuando esta cuenta ya no puede probar más códigos en esta hora.
create or replace function public._tv_frenado(p_user uuid) returns boolean
language sql stable set search_path = public as $$
  select exists(select 1 from public.tv_intentos i
    where i.user_id = p_user and i.fallos >= 10 and i.ventana_desde > now() - interval '1 hour')
$$;

create or replace function public._tv_contar_fallo(p_user uuid) returns void
language sql set search_path = public as $$
  insert into public.tv_intentos as i (user_id, fallos, ventana_desde) values (p_user, 1, now())
  on conflict (user_id) do update set
    fallos = case when i.ventana_desde > now() - interval '1 hour' then i.fallos + 1 else 1 end,
    ventana_desde = case when i.ventana_desde > now() - interval '1 hour' then i.ventana_desde else now() end
$$;

revoke all on function public._tv_sha(text), public._tv_codigo(text), public._tv_frenado(uuid), public._tv_contar_fallo(uuid)
  from public, anon, authenticated, service_role;

-- ── La TV pide un código ─────────────────────────────────────────────────────────────────────────
-- Sin sesión. Limpia lo caducado y aplica un tope global de pendientes: no hay IP fiable a este nivel, así
-- que el tope es la defensa contra inundación. Con 32^8 códigos posibles, 5000 pendientes no ayudan a tantear.
create or replace function public.tv_emitir_codigo(p_nombre text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_tope constant integer := 5000;
  v_nombre text := left(btrim(regexp_replace(translate(coalesce(p_nombre, ''), '—–', '--'), '[[:cntrl:]]+', ' ', 'g')), 40);
  v_secreto text := encode(extensions.gen_random_bytes(32), 'hex');
  v_caduca timestamptz := now() + interval '10 minutes';
  v_bytes bytea;
  v_codigo text;
  v_id uuid;
  i integer;
  v_intento integer := 0;
begin
  delete from public.tv_enlaces where caduca_en <= now();
  delete from public.tv_dispositivos where caduca_en <= now();
  if (select count(*) from public.tv_enlaces where estado = 'pendiente') >= v_tope then
    return jsonb_build_object('estado', 'saturado', 'reintentar_seg', 60);
  end if;
  if v_nombre = '' then v_nombre := 'Apple TV'; end if;

  loop
    v_intento := v_intento + 1;
    v_bytes := extensions.gen_random_bytes(8);
    v_codigo := '';
    for i in 0..7 loop
      -- 32 símbolos y una máscara de 5 bits: distribución uniforme, sin sesgo de módulo.
      v_codigo := v_codigo || substr(v_alfabeto, (get_byte(v_bytes, i) & 31) + 1, 1);
    end loop;
    insert into public.tv_enlaces (codigo, secreto_hash, nombre, caduca_en)
      values (v_codigo, public._tv_sha(v_secreto), v_nombre, v_caduca)
      on conflict (codigo) where estado = 'pendiente' do nothing
      returning id into v_id;
    exit when v_id is not null;
    if v_intento >= 5 then return jsonb_build_object('estado', 'saturado', 'reintentar_seg', 60); end if;
  end loop;

  return jsonb_build_object('estado', 'ok', 'codigo', v_codigo, 'secreto', v_secreto,
    'caduca_en', v_caduca, 'sondeo_seg', 5);
end $$;

-- ── La TV pregunta si ya la han aprobado ─────────────────────────────────────────────────────────
-- Un secreto desconocido responde igual que uno caducado: no se distingue lo borrado de lo inventado.
-- El token se genera aquí, en el momento de entregarlo, y solo se guarda su hash: nunca existe en claro en
-- la base. Si la respuesta se pierde por la red, se vuelve a enlazar. Margen de 1 s sobre sondeo_seg por
-- la latencia: un cliente que espera 5 s entre respuestas no debe llevarse un aviso.
create or replace function public.tv_canjear(p_secreto text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_sondeo constant integer := 5;
  r public.tv_enlaces%rowtype;
  v_token text;
  v_caduca timestamptz := now() + interval '90 days';
begin
  if p_secreto is null or p_secreto !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('estado', 'caducado');
  end if;
  select * into r from public.tv_enlaces where secreto_hash = public._tv_sha(p_secreto) for update;
  if not found then return jsonb_build_object('estado', 'caducado'); end if;
  if r.caduca_en <= now() then
    delete from public.tv_enlaces where id = r.id;
    return jsonb_build_object('estado', 'caducado');
  end if;
  if r.ultimo_sondeo is not null and now() - r.ultimo_sondeo < make_interval(secs => v_sondeo - 1) then
    return jsonb_build_object('estado', 'pendiente', 'demasiado_rapido', true, 'sondeo_seg', v_sondeo);
  end if;

  if r.estado = 'denegado' then
    delete from public.tv_enlaces where id = r.id;
    return jsonb_build_object('estado', 'denegado');
  end if;
  if r.estado = 'pendiente' then
    update public.tv_enlaces set ultimo_sondeo = now() where id = r.id;
    return jsonb_build_object('estado', 'pendiente', 'sondeo_seg', v_sondeo);
  end if;

  -- Aprobado: se revalida la cuenta, porque el borrado pudo pedirse después de aprobar.
  perform pg_advisory_xact_lock(hashtextextended(r.user_id::text, 630030));
  if public.account_erasure_pending(r.user_id) then
    delete from public.tv_enlaces where id = r.id;
    return jsonb_build_object('estado', 'denegado');
  end if;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.tv_dispositivos (user_id, nombre, token_hash, caduca_en)
    values (r.user_id, r.nombre, public._tv_sha(v_token), v_caduca);
  delete from public.tv_enlaces where id = r.id;
  return jsonb_build_object('estado', 'aprobado', 'token', v_token, 'caduca_en', v_caduca);
end $$;

-- ── El iPhone confirma ───────────────────────────────────────────────────────────────────────────
-- Los "no" de negocio van como {ok:false, reason}: si lanzara, la transacción se desharía y el fallo no
-- quedaría contado.
create or replace function public.tv_aprobar(p_codigo text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  u uuid := auth.uid();
  v_tope constant integer := 5;
  v_codigo text := public._tv_codigo(p_codigo);
  r public.tv_enlaces%rowtype;
begin
  if u is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text, 630030));
  if public.account_erasure_pending(u) then return jsonb_build_object('ok', false, 'reason', 'borrado_pendiente'); end if;
  if public._tv_frenado(u) then return jsonb_build_object('ok', false, 'reason', 'demasiados_intentos'); end if;
  if v_codigo is null then return jsonb_build_object('ok', false, 'reason', 'codigo_invalido'); end if;

  select * into r from public.tv_enlaces
    where codigo = v_codigo and estado = 'pendiente' and caduca_en > now() for update;
  if not found then
    perform public._tv_contar_fallo(u);
    return jsonb_build_object('ok', false, 'reason', 'codigo_invalido');
  end if;

  delete from public.tv_dispositivos where user_id = u and caduca_en <= now();
  if (select count(*) from public.tv_dispositivos where user_id = u)
     + (select count(*) from public.tv_enlaces where user_id = u and estado = 'aprobado' and caduca_en > now()) >= v_tope then
    return jsonb_build_object('ok', false, 'reason', 'tope_tv', 'tope', v_tope);
  end if;

  -- Un minuto de margen: si se aprueba en el último segundo, la TV aún debe llegar a canjear.
  update public.tv_enlaces set estado = 'aprobado', user_id = u, aprobado_en = now(),
      caduca_en = greatest(caduca_en, now() + interval '1 minute')
    where id = r.id;
  return jsonb_build_object('ok', true, 'nombre', r.nombre);
end $$;

-- "Esto no lo he pedido yo": la TV deja de esperar y el código muere.
create or replace function public.tv_rechazar(p_codigo text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  u uuid := auth.uid();
  v_codigo text := public._tv_codigo(p_codigo);
  v_id uuid;
begin
  if u is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  if public.account_erasure_pending(u) then return jsonb_build_object('ok', false, 'reason', 'borrado_pendiente'); end if;
  if public._tv_frenado(u) then return jsonb_build_object('ok', false, 'reason', 'demasiados_intentos'); end if;
  if v_codigo is null then return jsonb_build_object('ok', false, 'reason', 'codigo_invalido'); end if;
  update public.tv_enlaces set estado = 'denegado'
    where codigo = v_codigo and estado = 'pendiente' and caduca_en > now() returning id into v_id;
  if v_id is null then
    perform public._tv_contar_fallo(u);
    return jsonb_build_object('ok', false, 'reason', 'codigo_invalido');
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ── Cerrar sesión desde la TV ────────────────────────────────────────────────────────────────────
-- Responde igual exista o no el token.
create or replace function public.tv_cerrar_sesion(p_token text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_token is not null and p_token ~ '^[0-9a-f]{64}$' then
    delete from public.tv_dispositivos where token_hash = public._tv_sha(p_token);
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ── El dueño ve y revoca sus TV desde el iPhone ──────────────────────────────────────────────────
create or replace function public.tv_mis_dispositivos()
returns table (id uuid, nombre text, creado_en timestamptz, ultimo_uso timestamptz, caduca_en timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  return query
    select d.id, d.nombre, d.creado_en, d.ultimo_uso, d.caduca_en
    from public.tv_dispositivos d
    where d.user_id = u and d.caduca_en > now()
    order by d.ultimo_uso desc, d.id;
end $$;

create or replace function public.tv_revocar(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  u uuid := auth.uid();
  v_id uuid;
begin
  if u is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  delete from public.tv_dispositivos where id = p_id and user_id = u returning id into v_id;
  return jsonb_build_object('ok', v_id is not null);
end $$;

-- ── Permisos ─────────────────────────────────────────────────────────────────────────────────────
revoke all on function public.tv_emitir_codigo(text), public.tv_canjear(text), public.tv_aprobar(text),
  public.tv_rechazar(text), public.tv_cerrar_sesion(text), public.tv_mis_dispositivos(), public.tv_revocar(uuid)
  from public, anon, authenticated;
grant execute on function public.tv_emitir_codigo(text), public.tv_canjear(text), public.tv_cerrar_sesion(text) to anon;
grant execute on function public.tv_aprobar(text), public.tv_rechazar(text), public.tv_mis_dispositivos(), public.tv_revocar(uuid)
  to authenticated;

comment on function public.tv_emitir_codigo(text) is 'nivl:tv-enlace-0125 · emite el código de enlace de Apple TV';

notify pgrst, 'reload schema';
commit;

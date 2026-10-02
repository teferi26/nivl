-- NIVL · 0045 — Invitaciones con recompensa cosmética «Reclutador» (Chat 2 · L2).
-- Número asignado por el coordinador el 02/10/2026. Entregado en
-- docs/payment-audit/propuestas/; el coordinador lo copia a supabase/migrations/ y
-- añade la huella a HUELLAS de scripts/apply-migrations.mjs:
--   '0045': `coalesce(obj_description(to_regprocedure('public.claim_invite(text)'), 'pg_proc') like '%nivl:invites-0045%', false)`
-- Test: node scripts/test-invites.mjs <ruta a @electric-sql/pglite/dist/index.js>
--
-- Contrato (FASE2-PLAN.md, D3 aprobada)
--   · Quien invita comparte su CÓDIGO DE AMIGO (profiles.friend_code, 0021). No
--     hay códigos nuevos: el mismo que se dicta para pedir amistad.
--   · claim_invite(p_code) lo llama el INVITADO (auth.uid()) en sus primeros 7
--     días. Una sola invitación por cuenta (invitee es la PK).
--   · settle_my_invites() lo llama QUIEN INVITA: una invitación pasa a 'activa'
--     cuando el invitado tuvo ≥3 días distintos con progreso entre created_at y
--     created_at+21 d y han pasado ≥7 días reales desde la reclamación; si
--     vencen los 21 días sin eso, 'caducada'. Tope antifraude por quien invita:
--     como mucho 3 activaciones en 30 días y 12 en 365 días; la que lo supera
--     queda en 'tope' y no cuenta para insignias.
--   · Insignias por invitados ACTIVOS (nombres de Chat 5, progression.ts):
--     1 → 'reclutador', 3 → 'lanista', 10 → 'senor_del_ludus'. Se apuntan en
--     invite_rewards (auditoría; unique por usuario y nivel).
--   · my_invites(): contadores (activos, pendientes, caducadas, tope) e
--     insignias propias. Nunca ids ni datos de invitados.
--   (Ajustes acordados por el coordinador con Chat 5 y Chat 3 el 02/10/2026.)
--
-- Lo que NO hace (y no debe hacer)
--   · Cero días de Pro desde el servidor (Apple 3.1.1): no toca subscriptions.
--   · Cero XP: no llama a award_xp ni toca profiles. La insignia es cosmética.
--   · Sin evento en public.events: 'invite_*' no está en la lista de tipos
--     generales del trigger de salud (0030 → 0035); insertarlo exigiría
--     consentimiento de salud o marcaría la fila como dato de salud. Las tablas
--     propias ya son el registro (created_at, settled_at, invite_rewards).
--
-- Compatibilidad con la app 1.0.7: puramente ADITIVA. Tablas y funciones nuevas;
-- no cambia firmas existentes, ni constraints de subscriptions, ni friend_request.
-- Comparte el freno de intentos de 0021 (friend_request_log, 30/hora): probar
-- códigos a ciegas aquí gasta del mismo cupo que pedir amistad.
--
-- Anti-abuso
--   · Autoinvitación, código inexistente, cuenta del invitado con >7 días,
--     doble reclamación (PK + on conflict), invitación recíproca (A↔B),
--     borrado pendiente del invitado (se dice) o del que invita (se responde
--     'desconocido': nunca se revela el borrado de otra persona, 0031).
--   · Tope de 10 invitaciones nuevas por código y día.
--   · El progreso se mide con datos que el cliente no escribe: completions
--     (solo complete_quest desde 0035; se usa completed_at, la hora del
--     servidor, NO la columna date que admite hasta 2 días atrás) y
--     xp_daily_ledger (0041, día calculado por el servidor). Residual aceptado
--     igual que 0041: cambiar profiles.timezone desplaza un día del libro.
--   · Advisory locks por invitado y por quien invita: llamadas en paralelo no
--     duplican ni saltan topes.
--
-- Re-ejecutable: if not exists / or replace / drop trigger if exists.

begin;

-- ── Tablas ──────────────────────────────────────────────────────────
create table if not exists public.invites (
  invitee uuid primary key references auth.users (id) on delete cascade,
  inviter uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  status text not null default 'pendiente'
    check (status in ('pendiente', 'activa', 'caducada', 'anulada', 'tope')),
  settled_at timestamptz,
  constraint invites_no_self check (invitee <> inviter)
);
create index if not exists invites_inviter_idx on public.invites (inviter, status);
create index if not exists invites_inviter_settled_idx on public.invites (inviter, settled_at) where status = 'activa';

create table if not exists public.invite_rewards (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('reclutador', 'lanista', 'senor_del_ludus')),
  created_at timestamptz not null default now(),
  unique (user_id, kind)
);

-- Sin políticas: con RLS activa eso es "prohibido" para el cliente. Solo las
-- RPC (security definer) leen y escriben.
alter table public.invites enable row level security;
alter table public.invite_rewards enable row level security;
revoke all on public.invites from public, anon, authenticated;
revoke all on public.invite_rewards from public, anon, authenticated;

-- Defensa en profundidad del borrado de cuenta (0031): las tablas creadas
-- después de 0031 no tienen su guardia. Solo si la función existe.
do $$
begin
  if to_regprocedure('public.require_account_active()') is not null then
    drop trigger if exists account_write_guard on public.invite_rewards;
    create trigger account_write_guard before insert or update on public.invite_rewards
      for each row execute function public.require_account_active('user_id');
    drop trigger if exists account_write_guard_invitee on public.invites;
    create trigger account_write_guard_invitee before insert or update on public.invites
      for each row execute function public.require_account_active('invitee');
    drop trigger if exists account_write_guard_inviter on public.invites;
    create trigger account_write_guard_inviter before insert or update on public.invites
      for each row execute function public.require_account_active('inviter');
  end if;
end $$;

-- ── Piezas internas ─────────────────────────────────────────────────

-- ¿Borrado de cuenta pendiente? Envuelve 0031 sin depender de que exista.
create or replace function public.invite_erasure_pending(p_user uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if to_regprocedure('public.account_erasure_pending(uuid)') is null then return false; end if;
  return public.account_erasure_pending(p_user);
end;
$$;

-- Días distintos con progreso de p_user en [p_from, p_to): misiones completadas
-- (por la hora del servidor) y XP de módulos del libro diario (0041).
create or replace function public.invite_progress_days(p_user uuid, p_from timestamptz, p_to timestamptz)
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tz text;
  v_from date;
  v_to date;
  v_days date[];
  v_more date[];
begin
  select public.safe_tz(p.timezone) into v_tz from public.profiles p where p.id = p_user;
  v_tz := coalesce(v_tz, 'Europe/Madrid');
  v_from := (p_from at time zone v_tz)::date;
  v_to := (p_to at time zone v_tz)::date;

  select coalesce(array_agg(distinct (c.completed_at at time zone v_tz)::date), '{}')
    into v_days
  from public.completions c
  where c.user_id = p_user and c.completed_at >= p_from and c.completed_at < p_to;

  if to_regclass('public.xp_daily_ledger') is not null then
    execute 'select coalesce(array_agg(distinct l.day), ''{}'') from public.xp_daily_ledger l
             where l.user_id = $1 and l.xp > 0 and l.day between $2 and $3'
      into v_more using p_user, v_from, v_to;
    v_days := v_days || v_more;
  end if;

  return (select count(distinct d)::integer from unnest(v_days) d);
end;
$$;

-- ── Reclamar (lo llama el invitado) ─────────────────────────────────
-- Devuelve {ok, reason}. Nunca lanza tras apuntar el intento: una excepción
-- desharía la fila del freno, y los intentos fallidos son los que cuentan.
create or replace function public.claim_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_inviter uuid;
  v_created timestamptz;
  v_calls integer;
  v_today integer;
  v_done uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'sin_sesion');
  end if;

  -- Antes de apuntar el intento: la guardia de 0031 rechaza escribir en
  -- friend_request_log con el borrado pendiente, y aquí no se lanza.
  if public.invite_erasure_pending(v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'borrado_pendiente');
  end if;

  perform pg_advisory_xact_lock(hashtext('nivl_friend_request'), hashtext(v_uid::text));

  select count(*) into v_calls
  from public.friend_request_log l
  where l.user_id = v_uid and l.created_at > now() - interval '1 hour';
  if v_calls >= 30 then
    return jsonb_build_object('ok', false, 'reason', 'limite');
  end if;
  insert into public.friend_request_log (user_id) values (v_uid);

  if exists (select 1 from public.invites i where i.invitee = v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'ya_invitado');
  end if;

  v_code := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if length(v_code) <> 8 then
    return jsonb_build_object('ok', false, 'reason', 'formato');
  end if;

  select p.id into v_inviter from public.profiles p where p.friend_code = v_code;
  -- El borrado pendiente de OTRA persona no se revela: se responde como si no existiera.
  if v_inviter is null or public.invite_erasure_pending(v_inviter) then
    return jsonb_build_object('ok', false, 'reason', 'desconocido');
  end if;
  if v_inviter = v_uid then
    return jsonb_build_object('ok', false, 'reason', 'propio');
  end if;

  select u.created_at into v_created from auth.users u where u.id = v_uid;
  if v_created is null or v_created < now() - interval '7 days' then
    return jsonb_build_object('ok', false, 'reason', 'fuera_de_plazo');
  end if;

  -- A trajo a B y ahora B "trae" a A: dos cuentas nuevas no se reparten insignias.
  if exists (select 1 from public.invites i where i.invitee = v_inviter and i.inviter = v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'reciproca');
  end if;

  perform pg_advisory_xact_lock(hashtext('nivl_invites_inviter'), hashtext(v_inviter::text));
  select count(*) into v_today
  from public.invites i
  where i.inviter = v_inviter and i.created_at > now() - interval '1 day';
  if v_today >= 10 then
    return jsonb_build_object('ok', false, 'reason', 'tope');
  end if;

  insert into public.invites (invitee, inviter)
  values (v_uid, v_inviter)
  on conflict (invitee) do nothing
  returning invitee into v_done;
  if v_done is null then
    return jsonb_build_object('ok', false, 'reason', 'ya_invitado');
  end if;

  return jsonb_build_object('ok', true, 'reason', null);
end;
$$;

comment on function public.claim_invite(text) is
  'nivl:invites-0045 · El invitado reclama el código de amigo de quien le invita. Sin XP ni días de Pro.';

-- ── Liquidar (lo llama quien invita; idempotente) ───────────────────
create or replace function public.settle_my_invites()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  r record;
  v_activas integer;
  v_pendientes integer;
  v_kind text;
  v_nuevas text[] := '{}';
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'sin_sesion');
  end if;
  if public.invite_erasure_pending(v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'borrado_pendiente');
  end if;

  perform pg_advisory_xact_lock(hashtext('nivl_invites_inviter'), hashtext(v_uid::text));

  for r in
    select i.invitee, i.created_at
    from public.invites i
    where i.inviter = v_uid and i.status = 'pendiente'
    order by i.created_at
    for update
  loop
    if now() >= r.created_at + interval '7 days'
       and not public.invite_erasure_pending(r.invitee)
       and public.invite_progress_days(r.invitee, r.created_at,
             least(now(), r.created_at + interval '21 days')) >= 3 then
      -- Tope antifraude: 3 activaciones en 30 días y 12 en 365 días.
      if (select count(*) from public.invites a
          where a.inviter = v_uid and a.status = 'activa' and a.settled_at > now() - interval '30 days') >= 3
         or (select count(*) from public.invites a
             where a.inviter = v_uid and a.status = 'activa' and a.settled_at > now() - interval '365 days') >= 12 then
        update public.invites set status = 'tope', settled_at = now() where invitee = r.invitee;
      else
        update public.invites set status = 'activa', settled_at = now() where invitee = r.invitee;
      end if;
    elsif now() >= r.created_at + interval '21 days' then
      update public.invites set status = 'caducada', settled_at = now() where invitee = r.invitee;
    end if;
  end loop;

  select count(*) filter (where status = 'activa'), count(*) filter (where status = 'pendiente')
    into v_activas, v_pendientes
  from public.invites where inviter = v_uid;

  for v_kind in
    insert into public.invite_rewards (user_id, kind)
    select v_uid, t.kind
    from (values (1, 'reclutador'), (3, 'lanista'), (10, 'senor_del_ludus')) t(umbral, kind)
    where v_activas >= t.umbral
    on conflict (user_id, kind) do nothing
    returning kind
  loop
    v_nuevas := v_nuevas || v_kind;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'activos', v_activas,
    'activas', v_activas,
    'pendientes', v_pendientes,
    'nuevas_insignias', to_jsonb(coalesce(
      (select array_agg(k order by array_position(array['reclutador','lanista','senor_del_ludus'], k))
       from unnest(v_nuevas) k), '{}'::text[]))
  );
end;
$$;

-- ── Mis invitaciones (solo cifras propias) ──────────────────────────
create or replace function public.my_invites()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_pend integer;
  v_act integer;
  v_cad integer;
  v_tope integer;
  v_insignias text[];
begin
  if v_uid is null then return null; end if;

  select count(*) filter (where status = 'pendiente'),
         count(*) filter (where status = 'activa'),
         count(*) filter (where status = 'caducada'),
         count(*) filter (where status = 'tope')
    into v_pend, v_act, v_cad, v_tope
  from public.invites where inviter = v_uid;

  select coalesce(array_agg(kind order by array_position(array['reclutador','lanista','senor_del_ludus'], kind)), '{}')
    into v_insignias
  from public.invite_rewards where user_id = v_uid;

  return jsonb_build_object(
    'activos', v_act,
    'pendientes', v_pend,
    'caducadas', v_cad,
    'tope', v_tope,
    'insignias', to_jsonb(v_insignias),
    'siguiente_umbral', (select min(u) from unnest(array[1, 3, 10]) u where u > v_act),
    'invitado', exists (select 1 from public.invites where invitee = v_uid)
  );
end;
$$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.invite_erasure_pending(uuid) from public, anon, authenticated;
revoke all on function public.invite_progress_days(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.claim_invite(text) from public, anon;
revoke all on function public.settle_my_invites() from public, anon;
revoke all on function public.my_invites() from public, anon;
grant execute on function public.claim_invite(text) to authenticated;
grant execute on function public.settle_my_invites() to authenticated;
grant execute on function public.my_invites() to authenticated;

commit;

notify pgrst, 'reload schema';

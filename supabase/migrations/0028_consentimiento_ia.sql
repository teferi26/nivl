-- NIVL · 0028 — Consentimiento para la IA, edad mínima y el nombre por defecto.
--
-- El coach manda a un proveedor de IA de terceros (Anthropic en EE. UU.;
-- DeepSeek en China, fuera del EEE) datos de salud y entreno, el diario, las
-- finanzas y las fotos que se adjunten. Eso pide, antes del primer turno:
--   · Guideline 5.1.2(i) de Apple: decir a quién va y pedir permiso explícito.
--   · RGPD art. 9.2.a (datos de salud) y art. 49.1.a (transferencia a un país
--     sin decisión de adecuación): consentimiento explícito, informado y
--     retirable en cualquier momento.
--
-- La prueba del consentimiento es un REGISTRO que solo crece (ai_consents):
-- cada aceptación y cada retirada es una fila con su fecha y la versión del
-- texto que se enseñó. Lo vigente es la última fila de la persona: si es
-- 'accept' y su versión es la actual (ai_consent_version()), hay consentimiento.
-- Si el texto cambia de forma material, se sube la versión aquí y en
-- src/lib/consentmath.ts (AI_CONSENT_VERSION) y todo el mundo vuelve a aceptar.
--
-- Quien lo exige es el SERVIDOR: las funciones `coach`, `ritual` y `oracle`
-- llaman a ai_consent_ok() antes de tocar un modelo. Sin consentimiento vigente,
-- cero llamadas. La app solo enseña la hoja y guarda la respuesta.
--
-- También la edad mínima (16, como dicen los Términos): age_confirmations,
-- confirmada una vez por cuenta en la app (src/components/EdadMinima.tsx) antes
-- de montar ninguna pantalla privada.
--
-- Además, el nombre por defecto: la 0018 ya cambió el DEFAULT a 'Gladiador',
-- pero las filas creadas antes siguen llamándose 'Cazador' (vocabulario
-- prohibido en la interfaz). Se reescriben aquí.
--
-- Re-ejecutable (if not exists / or replace / on conflict).

-- ── La versión del texto ────────────────────────────────────────────
-- Una sola fuente en el servidor. Tiene que casar con AI_CONSENT_VERSION de
-- src/lib/consentmath.ts (lo comprueba un test).
create or replace function public.ai_consent_version()
returns text
language sql
immutable
as $$ select '2026-09-27'::text $$;

grant execute on function public.ai_consent_version() to authenticated, service_role;

-- ── El registro ─────────────────────────────────────────────────────
create table if not exists public.ai_consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null check (action in ('accept', 'withdraw')),
  version text not null check (char_length(version) between 1 and 40),
  source text not null default 'app' check (source in ('app', 'migracion')),
  created_at timestamptz not null default now()
);
create index if not exists ai_consents_user_idx on public.ai_consents (user_id, created_at desc, id desc);

-- Cada cual ve su propio registro; nadie escribe directo (solo por las RPC de
-- abajo). Sin UPDATE ni DELETE: la prueba no se reescribe.
alter table public.ai_consents enable row level security;
revoke all on public.ai_consents from anon, authenticated;
grant select on public.ai_consents to authenticated;

drop policy if exists "ai_consents_own_read" on public.ai_consents;
create policy "ai_consents_own_read" on public.ai_consents
  for select to authenticated
  using (user_id = auth.uid());

-- ── ¿Hay consentimiento vigente? (servidor) ─────────────────────────
create or replace function public.ai_consent_ok(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select c.action = 'accept' and c.version = public.ai_consent_version()
    from public.ai_consents c
    where c.user_id = p_user
    order by c.created_at desc, c.id desc
    limit 1
  ), false)
$$;

revoke all on function public.ai_consent_ok(uuid) from public, anon, authenticated;
grant execute on function public.ai_consent_ok(uuid) to service_role;

-- ── Lo que ve la app ────────────────────────────────────────────────
create or replace function public.my_ai_consent()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'current_version', public.ai_consent_version(),
    'granted', public.ai_consent_ok(auth.uid()),
    'action', u.action,
    'version', u.version,
    'at', u.created_at
  )
  from (select 1) uno
  left join lateral (
    select c.action, c.version, c.created_at
    from public.ai_consents c
    where c.user_id = auth.uid()
    order by c.created_at desc, c.id desc
    limit 1
  ) u on true
$$;

revoke all on function public.my_ai_consent() from public, anon;
grant execute on function public.my_ai_consent() to authenticated;

-- Aceptar: solo la versión vigente. Una app vieja que enseñó otro texto no
-- puede dar por bueno un consentimiento que no ha leído.
create or replace function public.accept_ai_consent(p_version text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if p_version is distinct from public.ai_consent_version() then
    return jsonb_build_object('ok', false, 'reason', 'version_obsoleta', 'current_version', public.ai_consent_version());
  end if;
  insert into public.ai_consents (user_id, action, version) values (v_uid, 'accept', p_version);
  return jsonb_build_object('ok', true, 'version', p_version);
end;
$$;

revoke all on function public.accept_ai_consent(text) from public, anon;
grant execute on function public.accept_ai_consent(text) to authenticated;

-- Retirar: desde este momento el servidor deja de llamar al modelo. No borra
-- nada de lo que ya hay en NIVL (eso es "Eliminar cuenta").
create or replace function public.withdraw_ai_consent()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  insert into public.ai_consents (user_id, action, version)
  values (v_uid, 'withdraw', public.ai_consent_version());
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.withdraw_ai_consent() from public, anon;
grant execute on function public.withdraw_ai_consent() to authenticated;

-- ── El dueño, sembrado como aceptado ────────────────────────────────
-- Solo quien opera NIVL (plan 'owner', 0020), que usa el coach a diario y ha
-- redactado el propio texto: sin esto, sus rituales del cron se pararían hasta
-- abrir la hoja. Nadie más se siembra; el resto acepta en la app. La fila
-- lleva source = 'migracion' para distinguirla de una aceptación en la app, y
-- puede retirarlo en Perfil como cualquiera.
--
-- Idempotente: solo si el dueño no tiene NINGUNA fila. Si lo retiró, volver a
-- ejecutar la migración no se lo reactiva.
insert into public.ai_consents (user_id, action, version, source)
select distinct s.user_id, 'accept', public.ai_consent_version(), 'migracion'
from public.subscriptions s
where s.plan = 'owner'
  and not exists (select 1 from public.ai_consents c where c.user_id = s.user_id);

-- Confirmación de edad separada del consentimiento IA: todas las cuentas,
-- antiguas y nuevas, la confirman en la app. No se deduce de onboarding_done.
-- La única excepción es el dueño (sembrado más abajo, tras crear la tabla).
create table if not exists public.age_confirmations (
  user_id uuid primary key references auth.users (id) on delete cascade,
  min_age integer not null check (min_age = 16),
  confirmed_at timestamptz not null default now()
);
alter table public.age_confirmations enable row level security;
revoke all on public.age_confirmations from anon, authenticated;
grant select on public.age_confirmations to authenticated;
drop policy if exists "age_confirmations_own_read" on public.age_confirmations;
create policy "age_confirmations_own_read" on public.age_confirmations
  for select to authenticated using (user_id = auth.uid());

create or replace function public.my_age_confirmation()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.age_confirmations where user_id = auth.uid() and min_age = 16
  )
$$;
revoke all on function public.my_age_confirmation() from public, anon;
grant execute on function public.my_age_confirmation() to authenticated;

create or replace function public.confirm_minimum_age(p_min_age integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if p_min_age is distinct from 16 then return false; end if;
  insert into public.age_confirmations (user_id, min_age)
    values (v_uid, 16) on conflict (user_id) do nothing;
  return true;
end;
$$;
revoke all on function public.confirm_minimum_age(integer) from public, anon;
grant execute on function public.confirm_minimum_age(integer) to authenticated;

-- El dueño, con la edad confirmada (es mayor de edad y opera la app).
-- Idempotente por la clave primaria.
insert into public.age_confirmations (user_id, min_age)
select distinct s.user_id, 16
from public.subscriptions s
where s.plan = 'owner'
on conflict (user_id) do nothing;

-- ── El nombre por defecto ───────────────────────────────────────────
alter table public.profiles alter column name set default 'Gladiador';
update public.profiles set name = 'Gladiador' where name = 'Cazador';

-- NIVL · 0111 · Medición: HealthKit, GPS y reloj se activan aparte.
-- Huella: to_regprocedure('public.activar_medicion()') is not null.
--
-- Decisión del dueño (09/11/2026): quien ya aceptó el permiso de salud NO vuelve
-- a aceptarlo ni pierde acceso al actualizar. Por eso health_consent_version()
-- sigue siendo la v1: además, el binario 1.0.11 exige current_version = v1 y con
-- otra versión daría el permiso por no aceptado.
--
-- El permiso antiguo no enciende las fuentes nuevas. Cada persona las activa
-- una vez, tras leer qué se lee y para qué, y solo si conecta Salud, el GPS o el
-- reloj. Es una decisión por persona y por concesión del permiso: retirarlo sube
-- `revision`, deja de coincidir con `medicion_revision` y al volver a aceptar
-- hay que activar de nuevo. El permiso de IA no se toca: va aparte.
begin;

alter table public.health_state add column if not exists medicion_revision bigint;

-- Para las políticas: mismas garantías que health_consent_ok.
create or replace function public.medicion_ok(p_user uuid) returns boolean
language sql volatile security definer set search_path=public as $$
  select coalesce(public.health_consent_ok(p_user) and exists(
    select 1 from public.health_state s
    where s.user_id=p_user and s.medicion_revision is not distinct from s.revision
  ),false)
$$;
revoke all on function public.medicion_ok(uuid) from public,anon;
grant execute on function public.medicion_ok(uuid) to authenticated,service_role;

-- Queda en health_consents con su propia versión: es lo que se puede enseñar
-- después, y ya entra en la exportación y en el borrado.
create or replace function public.activar_medicion() returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid();
begin
  if u is null then raise exception 'No autenticado' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,630030));
  if not public.health_consent_ok(u) then
    return jsonb_build_object('ok',false,'reason','sin_permiso_salud');
  end if;
  if not public.medicion_ok(u) then
    insert into public.health_consents(user_id,action,version,source)
      values(u,'accept','2026-11-09-medicion-v1','app');
    update public.health_state set medicion_revision=revision,updated_at=clock_timestamp()
      where user_id=u;
  end if;
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.activar_medicion() from public,anon;
grant execute on function public.activar_medicion() to authenticated;

-- La 1.0.11 ignora la clave nueva.
create or replace function public.my_health_consent() returns jsonb language sql stable security definer
set search_path=public as $$
  select jsonb_build_object('accepted',public.health_consent_ok(auth.uid()),
    'current_version',public.health_consent_version(),
    'version',(select version from public.health_state where user_id=auth.uid()),
    'revision',coalesce((select revision from public.health_state where user_id=auth.uid()),0),
    'medicion_activa',public.medicion_ok(auth.uid()),
    'erasure_pending',exists(select 1 from public.health_erasure_jobs where user_id=auth.uid() and status='pending'))
$$;

-- El servidor también lo exige. Apuntar un entreno a mano no necesita activar.
create policy medicion_activa_insert on public.salud_diaria as restrictive for insert to authenticated
  with check ((select public.medicion_ok(auth.uid())));
create policy medicion_activa_update on public.salud_diaria as restrictive for update to authenticated
  with check ((select public.medicion_ok(auth.uid())));
create policy medicion_activa_insert on public.entrenos_medidos as restrictive for insert to authenticated
  with check (origen='manual' or (select public.medicion_ok(auth.uid())));
create policy medicion_activa_update on public.entrenos_medidos as restrictive for update to authenticated
  with check (origen='manual' or (select public.medicion_ok(auth.uid())));

commit;

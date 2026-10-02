-- 0037 · Moderación con responsable (Chat 3 · Seguridad; número asignado por el coordinador 02/10/2026).
--
-- SOC-1 (P1): las denuncias de perfiles (social_reports, 0032) y los perfiles
-- pendientes de revisión no avisan a nadie; solo se ven abriendo el SQL Editor.
-- AI-1 (P1, Apple 1.2 / Play políticas de IA generativa): no hay forma de
-- denunciar una respuesta del coach o del Oráculo.
--
-- 1. ai_reports + report_ai_message(p_source, p_message_id, p_reason, p_excerpt)
--    firma ya acordada con el Chat 4 para la UI (fallback mailto mientras no exista).
-- 2. moderation_digest(): solo service_role. La llama la función `ritual`
--    (cron horario existente, nivl-rituales) y empuja un aviso SIN contenido a
--    los dispositivos de las cuentas con nivel 'owner' cuando hay novedades.
--
-- Compatible: tablas y funciones nuevas, nada existente cambia.
-- Orden: migración → despliegue de `ritual` con el aviso → OTA del Chat 4 con
-- el botón de denuncia. Huella: to_regclass('public.ai_reports') is not null

begin;

create table if not exists public.ai_reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('coach', 'oraculo')),
  message_id uuid,
  reason text not null check (reason in ('danino', 'salud', 'dinero', 'incorrecto', 'ofensivo', 'otro')),
  excerpt text not null check (length(excerpt) between 1 and 2000),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text
);
create unique index if not exists ai_reports_once_per_message
  on public.ai_reports (reporter, message_id) where message_id is not null;
create index if not exists ai_reports_open on public.ai_reports (created_at) where status = 'open';
alter table public.ai_reports enable row level security;
revoke all on public.ai_reports from anon, authenticated;
-- Sin políticas: el cliente solo denuncia por la RPC y no lee la tabla.

drop trigger if exists account_write_guard on public.ai_reports;
create trigger account_write_guard before insert or update on public.ai_reports
  for each row execute function public.require_account_active('reporter');

create or replace function public.report_ai_message(
  p_source text, p_message_id uuid, p_reason text, p_excerpt text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_excerpt text := left(btrim(coalesce(p_excerpt, '')), 2000);
begin
  if v_uid is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  if p_source is null or p_source not in ('coach', 'oraculo') then
    raise exception 'Origen inválido' using errcode = '22023';
  end if;
  if p_reason is null or p_reason not in ('danino', 'salud', 'dinero', 'incorrecto', 'ofensivo', 'otro') then
    raise exception 'Motivo inválido' using errcode = '22023';
  end if;
  if v_excerpt = '' then raise exception 'Falta el texto denunciado' using errcode = '22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 630030));
  -- Un mensaje se denuncia una vez; repetir no es error.
  if p_message_id is not null and exists (
    select 1 from public.ai_reports where reporter = v_uid and message_id = p_message_id) then
    return jsonb_build_object('ok', true);
  end if;
  -- Freno anti-abuso: 20 denuncias al día por cuenta.
  if (select count(*) from public.ai_reports
      where reporter = v_uid and created_at > now() - interval '1 day') >= 20 then
    return jsonb_build_object('ok', false, 'reason', 'limite');
  end if;

  insert into public.ai_reports (reporter, source, message_id, reason, excerpt)
    values (v_uid, p_source, p_message_id, p_reason, v_excerpt);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.report_ai_message(text, uuid, text, text) from public, anon;
grant execute on function public.report_ai_message(text, uuid, text, text) to authenticated;

-- Estado del último aviso (una fila).
create table if not exists public.moderation_alert_state (
  id smallint primary key default 1 check (id = 1),
  last_alert_at timestamptz not null default '-infinity'
);
insert into public.moderation_alert_state (id) values (1) on conflict do nothing;
alter table public.moderation_alert_state enable row level security;
revoke all on public.moderation_alert_state from anon, authenticated;

-- Devuelve recuentos (sin contenido) y a quién avisar; marca el aviso.
create or replace function public.moderation_digest() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_since timestamptz;
  v_new integer;
  v_open integer;
  v_owners uuid[];
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select last_alert_at into v_since from public.moderation_alert_state where id = 1 for update;

  select
    (select count(*) from public.social_reports where status = 'open' and created_at > v_since)
    + (select count(*) from public.ai_reports where status = 'open' and created_at > v_since)
    + (select count(*) from public.social_profile_reviews where status = 'pending' and updated_at > v_since),
    (select count(*) from public.social_reports where status = 'open')
    + (select count(*) from public.ai_reports where status = 'open')
    + (select count(*) from public.social_profile_reviews where status = 'pending')
  into v_new, v_open;

  select coalesce(array_agg(s.user_id), '{}') into v_owners
    from public.subscriptions s where public.user_tier(s.user_id) = 'owner';

  if v_new > 0 then
    update public.moderation_alert_state set last_alert_at = now() where id = 1;
  end if;
  return jsonb_build_object('nuevos', v_new, 'abiertos', v_open, 'owners', to_jsonb(v_owners));
end $$;
revoke all on function public.moderation_digest() from public, anon, authenticated;
grant execute on function public.moderation_digest() to service_role;

commit;

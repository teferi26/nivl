-- NIVL · 0067 · Interruptores del servidor (Modos, fase 1; contrato MODOS-F1-CONTRATO.md, 18/10/2026).
-- Huella para scripts/apply-migrations.mjs:
--   coalesce(obj_description(to_regprocedure('public.app_flags()'), 'pg_proc') like '%nivl:app-config-0067%', false)
-- Prueba: scripts/test-modos-f1.mjs (PGlite, todas las migraciones reales) y scripts/probar-f1-servidor.sql (BEGIN…ROLLBACK).
--
-- Una tabla de configuración para encender y apagar lo nuevo SIN build ni revisión de Apple:
--   · public.app_config(key, value jsonb, public, updated_at). Leen anon y authenticated SOLO las filas
--     public = true (RLS). Nadie escribe salvo service_role (sin políticas de escritura y sin privilegios
--     de tabla para anon/authenticated). Se cambia con un UPDATE desde el panel o un script con la clave
--     de servicio: `update app_config set value = 'true' where key = 'modos_activos';`.
--   · public.app_flags() → jsonb con las claves públicas: { "modos_activos": false, … }. Es lo que lee el
--     cliente (src/lib/flags.ts → useFlags()). Si la RPC falla o falta una clave, el cliente la da por
--     APAGADA: regla de oro 2 del contrato.
--   · public.app_config_value(key, default) → el valor de una clave para las funciones del servidor
--     (0069 la usa). Nunca lanza: sin fila, devuelve el default. Solo service_role y SQL interno.
--
-- Semillas, TODAS apagadas (on conflict do nothing: re-ejecutar no pisa lo que se haya encendido a mano):
--   modos_activos = false · idiomas_activos = false · prueba_auto_activa = false · prueba_auto_dias = 2 ·
--   prueba_ia_mensajes_dia = 20 · valoracion_activa = false.
--
-- Compatibilidad con la 1.0.9: ADITIVA (tabla y funciones nuevas). La 1.0.9 no las llama.
--
-- Marcha atrás:
--   drop function if exists public.app_flags();
--   drop function if exists public.app_config_value(text, jsonb);
--   drop table if exists public.app_config;
--   (la 0069 lee app_config_value: si se deshace esta, antes hay que deshacer la 0069).
-- Re-ejecutable.
begin;

create table if not exists public.app_config (
  key text primary key check (key ~ '^[a-z0-9_]{1,64}$'),
  value jsonb not null,
  public boolean not null default false,
  updated_at timestamptz default now()
);

alter table public.app_config enable row level security;
revoke all on public.app_config from public, anon, authenticated;
grant select on public.app_config to anon, authenticated;
grant all on public.app_config to service_role;

drop policy if exists "app_config publica" on public.app_config;
create policy "app_config publica" on public.app_config
  for select to anon, authenticated
  using (public = true);

-- updated_at se mantiene solo: así se sabe cuándo se encendió o apagó algo.
create or replace function public._app_config_touch() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  return new;
end $$;
revoke all on function public._app_config_touch() from public, anon, authenticated;
drop trigger if exists app_config_touch on public.app_config;
create trigger app_config_touch before update on public.app_config
  for each row execute function public._app_config_touch();

insert into public.app_config (key, value, public) values
  ('modos_activos', 'false'::jsonb, true),
  ('idiomas_activos', 'false'::jsonb, true),
  ('prueba_auto_activa', 'false'::jsonb, true),
  ('prueba_auto_dias', '2'::jsonb, true),
  ('prueba_ia_mensajes_dia', '20'::jsonb, true),
  ('valoracion_activa', 'false'::jsonb, true)
on conflict (key) do nothing;

comment on table public.app_config is
  'Interruptores del servidor (0067). Lectura pública solo de las filas public = true; escritura solo service_role.';

-- Lo que lee la app. security definer con el filtro explícito: no depende de que la RLS esté bien puesta.
create or replace function public.app_flags() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_object_agg(c.key, c.value order by c.key), '{}'::jsonb)
  from public.app_config c
  where c.public = true;
$$;
revoke all on function public.app_flags() from public, anon, authenticated;
grant execute on function public.app_flags() to anon, authenticated, service_role;
comment on function public.app_flags() is
  'nivl:app-config-0067 · Claves públicas de app_config. Si falla o falta una clave, el cliente la da por apagada.';

-- Para el servidor: un valor con su default, sin lanzar nunca (también si la tabla no tiene la fila).
create or replace function public.app_config_value(p_key text, p_default jsonb default null) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select c.value from public.app_config c where c.key = p_key), p_default);
$$;
revoke all on function public.app_config_value(text, jsonb) from public, anon, authenticated;
grant execute on function public.app_config_value(text, jsonb) to service_role;

notify pgrst, 'reload schema';
commit;

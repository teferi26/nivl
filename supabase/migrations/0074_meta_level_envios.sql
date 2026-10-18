-- 0074 · «Comenta LEVEL → MD»: registro de envíos del webhook de Meta.
-- Huella: coalesce(obj_description(to_regclass('public.meta_level_envios'),'pg_class') like '%nivl:meta-level-0074%', false)
--
-- La función serverless de la web (nivl-web, api/meta/webhook.js) responde
-- por mensaje privado a quien comenta «LEVEL» en un reel de las cuentas de
-- NIVL. Esta tabla sirve para dos cosas:
--   1. Deduplicar: una sola respuesta por (autor, publicación). La fila se
--      reclama ANTES de enviar (estado 'pendiente'); si ya consta como
--      'enviado' no se vuelve a mandar nunca. Solo una fila en 'error' puede
--      reclamarse otra vez con un comentario nuevo.
--   2. El informe del embudo: cuenta, red y fecha.
--
-- Minimización (art. 5.1.c RGPD): NO se guarda el id de quien comenta, ni su
-- nombre, ni el texto, ni el id del comentario. Solo `autor_hash`, un SHA-256
-- del id con una sal secreta (META_HASH_SALT, solo en Vercel). `post_id` es el
-- id de una publicación propia de NIVL. `error_code` es el código numérico de
-- la Graph API, sin mensaje.
--
-- Acceso: RLS activado y sin políticas; ni `anon` ni `authenticated` tienen
-- permisos. Solo `service_role` (la función de Vercel por PostgREST).
-- Conservación: 90 días, purga diaria con pg_cron (como la 0073).
-- Solo aditiva: no toca nada existente.
begin;

create table if not exists public.meta_level_envios (
  id bigint generated always as identity primary key,
  cuenta text not null check (cuenta ~ '^[a-z0-9_]{1,40}$'),
  red text not null check (red in ('ig', 'fb')),
  post_id text not null check (post_id ~ '^[0-9A-Za-z_]{1,80}$'),
  autor_hash text not null check (autor_hash ~ '^[0-9a-f]{64}$'),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'enviado', 'error')),
  error_code text null check (error_code is null or error_code ~ '^[0-9A-Za-z_:.-]{1,40}$'),
  created_at timestamptz not null default now(),
  constraint meta_level_envios_unico unique (autor_hash, post_id)
);

create index if not exists meta_level_envios_created_idx on public.meta_level_envios (created_at);
create index if not exists meta_level_envios_cuenta_idx on public.meta_level_envios (cuenta, red, created_at desc);

alter table public.meta_level_envios enable row level security;
revoke all on public.meta_level_envios from public, anon, authenticated;
grant select, insert, update, delete on public.meta_level_envios to service_role;
grant usage, select on sequence public.meta_level_envios_id_seq to service_role;

-- Purga a 90 días.
create or replace function public.purgar_meta_level_envios()
returns integer
language sql
security definer
set search_path = public, pg_temp
as $$
  with borradas as (
    delete from public.meta_level_envios where created_at < now() - interval '90 days' returning 1
  )
  select count(*)::integer from borradas
$$;
revoke all on function public.purgar_meta_level_envios() from public, anon, authenticated;

-- Una vez al día, de madrugada en UTC. Sin pg_cron (pruebas locales) se avisa.
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'Sin pg_cron: la purga de meta_level_envios no se programa (solo pruebas locales).';
    return;
  end if;
  create extension if not exists pg_cron;
  perform cron.unschedule(jobname) from cron.job where jobname = 'nivl-purga-meta-level';
  perform cron.schedule('nivl-purga-meta-level', '37 3 * * *', 'select public.purgar_meta_level_envios();');
end
$$;

comment on table public.meta_level_envios is
  'Envíos de «Comenta LEVEL → MD» (webhook de Meta). Sin datos en claro; 90 días. nivl:meta-level-0074';

commit;

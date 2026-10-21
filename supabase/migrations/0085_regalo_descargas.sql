-- 0085 · Recuento ANÓNIMO de descargas del PDF del regalo de la web (nivl.app/regalo/...).
-- Huella: coalesce(obj_description(to_regclass('public.regalo_descargas'),'pg_class') like '%nivl:regalo-descargas-0085%', false)
--
-- La función serverless de la web (nivl-web, api/regalo/pdf.js) llama a
-- `regalo_contar(origen)` cada vez que alguien descarga el PDF y luego sirve el
-- archivo. Solo se guarda un contador agregado por (día, origen):
--   - sin id de usuario, sin IP, sin user-agent, sin cookies ni huella;
--   - `origen` es la etiqueta de campaña del enlace (p. ej. `clips_hb_yt`),
--     validada con la misma regex que la página; si no cumple, `otro`.
-- No hay datos personales (RGPD considerando 26): no requiere consentimiento.
--
-- Acceso: RLS activado y sin políticas; ni `anon` ni `authenticated` leen ni
-- escriben la tabla. La RPC es security definer y solo la ejecuta
-- `service_role` (la función de Vercel por PostgREST).
-- Conservación: 365 días, purga diaria con pg_cron (como la 0073 y la 0074).
-- Número alto (0085) para no chocar con las ramas nivl-1011/* (hasta 0077) ni
-- con la rama de IA (0078+). Solo aditiva: no toca nada existente.
begin;

create table if not exists public.regalo_descargas (
  dia date not null,
  origen text not null check (origen ~ '^[a-z0-9_.:-]{1,48}$'),
  n integer not null default 0 check (n >= 0),
  primary key (dia, origen)
);

alter table public.regalo_descargas enable row level security;
revoke all on public.regalo_descargas from public, anon, authenticated;
grant select, insert, update, delete on public.regalo_descargas to service_role;

-- Suma 1 al contador de hoy (UTC) para el origen. Nunca lanza error: si algo
-- falla devuelve null y la descarga sigue igual.
create or replace function public.regalo_contar(p_origen text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_origen text := lower(coalesce(p_origen, ''));
  v_n integer;
begin
  if v_origen !~ '^[a-z0-9_.:-]{1,48}$' then
    v_origen := 'otro';
  end if;
  insert into public.regalo_descargas as r (dia, origen, n)
  values ((now() at time zone 'utc')::date, v_origen, 1)
  on conflict (dia, origen) do update set n = r.n + 1
  returning r.n into v_n;
  return v_n;
exception when others then
  return null;
end
$$;
revoke all on function public.regalo_contar(text) from public, anon, authenticated;
grant execute on function public.regalo_contar(text) to service_role;

-- Purga a 365 días.
create or replace function public.purgar_regalo_descargas()
returns integer
language sql
security definer
set search_path = public, pg_temp
as $$
  with borradas as (
    delete from public.regalo_descargas
     where dia < (now() at time zone 'utc')::date - 365
    returning 1
  )
  select count(*)::integer from borradas
$$;
revoke all on function public.purgar_regalo_descargas() from public, anon, authenticated;

-- Una vez al día, de madrugada en UTC. Sin pg_cron (pruebas locales) se avisa.
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'Sin pg_cron: la purga de regalo_descargas no se programa (solo pruebas locales).';
    return;
  end if;
  create extension if not exists pg_cron;
  perform cron.unschedule(jobname) from cron.job where jobname = 'nivl-purga-regalo';
  perform cron.schedule('nivl-purga-regalo', '47 3 * * *', 'select public.purgar_regalo_descargas();');
end
$$;

comment on table public.regalo_descargas is
  'Descargas del PDF del regalo de la web: recuento agregado por día y origen, sin datos personales; 365 días. nivl:regalo-descargas-0085';

commit;

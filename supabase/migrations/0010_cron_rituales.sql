-- NIVL · 0010 — El latido: los rituales se disparan solos
-- Pegar en SQL Editor después de 0009.
--
-- Hasta aquí el coach solo existía cuando abrías la app. Con esto la base de
-- datos llama cada hora a la Edge Function `ritual`, que mira qué hora es en
-- la zona de cada cazador y decide si le toca brief, revisión, cierre de mes o
-- la carta de escalada. Después empuja el resultado por notificación.
--
-- Por qué CADA HORA y no "a las 5:30": el cron de Postgres corre en UTC y la
-- hora de despertar es local y cambia con el horario de verano. Disparar cada
-- hora y decidir en la función con la zona del usuario es lo único que
-- sobrevive a un cambio de hora sin saltarse un día.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- El secreto compartido con la Edge Function. Se genera AQUÍ, dentro de la
-- base de datos, y vive en el Vault: así no aparece en el repositorio ni en
-- ningún fichero de migración, y nadie tiene que inventárselo.
--
-- La URL del proyecto la escribe scripts/setup-cron.mjs, que sí la conoce.
-- Hasta entonces la función avisa y no dispara nada.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'nivl_ritual_secret') then
    perform vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'nivl_ritual_secret');
  end if;
end
$$;

-- Disparador. SECURITY DEFINER porque solo el dueño puede leer el Vault, y
-- revocado a todo el mundo salvo al propio cron (que corre como postgres).
create or replace function public.disparar_rituales()
returns bigint
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare
  v_secret text;
  v_url text;
  v_request_id bigint;
begin
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'nivl_ritual_secret';
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'nivl_project_url';

  if v_secret is null or v_url is null then
    raise notice 'Rituales sin configurar: falta el secreto o la URL del proyecto';
    return null;
  end if;

  select net.http_post(
    url := v_url || '/functions/v1/ritual',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-ritual-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.disparar_rituales() from public, anon, authenticated;

-- Cada hora en punto. Si ya existía, se reemplaza.
select cron.unschedule('nivl-rituales')
  where exists (select 1 from cron.job where jobname = 'nivl-rituales');

select cron.schedule('nivl-rituales', '0 * * * *', 'select public.disparar_rituales();');

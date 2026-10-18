-- 0070 · Embudo anónimo (Modos F1 · equipo analítica). docs/modos/F1-analitica.md
-- Huella: coalesce(obj_description(to_regprocedure('public.registrar_evento(text,text,jsonb,text,text,timestamptz)'),'pg_proc') like '%nivl:funnel-0070%', false)
--
-- Qué recorrido hace la gente: primer arranque, onboarding paso a paso,
-- registro, primera misión, aperturas D1/D3/D7, paywall y compra. Es una
-- tabla APARTE de `events` (la crónica del juego): `events` exige cuenta,
-- guarda texto escrito por la persona (el objetivo del onboarding) y la lee el
-- coach. El embudo empieza ANTES de la cuenta y no guarda nada escrito.
--
-- Anónimo de verdad:
--   · `install_id` es un identificador aleatorio que genera la app al
--     instalarse (AsyncStorage); no sale del dispositivo ni del correo.
--   · `props` solo admite, por evento, las claves de una lista blanca, y cada
--     valor es un número, un booleano o un código corto [a-z0-9_]. Un correo,
--     un nombre con mayúscula o una frase no caben.
--   · `user_id` lo pone el servidor (auth.uid()) y es null sin sesión. Sirve
--     para unir el embudo con `subscriptions`/`completions` en el panel admin
--     y para borrar todo al borrar la cuenta.
--   · Nadie lee la tabla desde la app: ni anon ni authenticated tienen
--     SELECT. Solo las RPC de admin de la 0072 (y service_role).
--
-- Solo aditiva: tabla, funciones y un trigger nuevos. Nada que use la 1.0.9.
-- El envío desde la app va detrás del flag `analitica_activa` (apagado; se
-- siembra aquí si `app_config` de la 0067 existe).
--
-- Exportación (RGPD art. 15/20): `funnel_events` entra en `export_my_data`
-- en la 0072, que envuelve la exportación vigente con las tres tablas nuevas
-- de 0070-0072. Se despliegan juntas.
begin;

create table if not exists public.funnel_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users (id) on delete cascade,
  install_id text not null check (install_id ~ '^[A-Za-z0-9-]{16,64}$'),
  evento text not null,
  props jsonb not null default '{}'::jsonb,
  app_version text null check (app_version is null or app_version ~ '^[0-9A-Za-z.+-]{1,24}$'),
  plataforma text null check (plataforma is null or plataforma in ('ios', 'android', 'web')),
  -- Cuándo pasó en el móvil (la cola offline puede llegar horas después),
  -- acotado por `registrar_evento` a los últimos 30 días.
  created_at timestamptz not null default now(),
  -- Cuándo llegó: el límite de envíos se mide con esto, no con lo que dice el móvil.
  recibido_en timestamptz not null default now()
);

create index if not exists funnel_events_evento_idx on public.funnel_events (evento, created_at);
create index if not exists funnel_events_install_idx on public.funnel_events (install_id, recibido_en);
create index if not exists funnel_events_recibido_idx on public.funnel_events (recibido_en);
create index if not exists funnel_events_user_idx on public.funnel_events (user_id) where user_id is not null;

alter table public.funnel_events enable row level security;
-- Sin políticas: ni leer ni escribir desde la app. Se escribe solo por la RPC.
revoke all on public.funnel_events from public, anon, authenticated;

-- ── Lista blanca: evento → claves admitidas en props ──────────────────
create or replace function public.funnel_claves_admitidas(p_evento text)
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_evento
    when 'primer_arranque' then array['previo']
    when 'onboarding_paso' then array['paso']
    when 'onboarding_fin' then array['salida']
    when 'registro' then array['resultado']
    when 'primera_mision_creada' then array['origen']
    when 'primera_mision_completada' then array['con_foto']
    when 'apertura_dia' then array['dia']
    when 'paywall_visto' then array['motivo', 'compacto']
    when 'compra_iniciada' then array['plan']
    when 'compra_ok' then array['plan', 'resultado']
    else null
  end
$$;

-- ¿Caben estas props en el evento? Objeto, 512 bytes como mucho, solo claves
-- de la lista y valores número (entero razonable), booleano o código corto.
create or replace function public.funnel_props_validas(p_evento text, p_props jsonb)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_claves text[] := public.funnel_claves_admitidas(p_evento);
  v_k text;
  v_v jsonb;
begin
  if v_claves is null or p_props is null or jsonb_typeof(p_props) <> 'object' then
    return false;
  end if;
  if octet_length(p_props::text) > 512 then
    return false;
  end if;
  for v_k, v_v in select key, value from jsonb_each(p_props) loop
    if not (v_k = any (v_claves)) then
      return false;
    end if;
    case jsonb_typeof(v_v)
      when 'boolean' then null;
      when 'number' then
        if (v_v #>> '{}')::numeric <> trunc((v_v #>> '{}')::numeric)
           or abs((v_v #>> '{}')::numeric) > 100000 then
          return false;
        end if;
      when 'string' then
        if (v_v #>> '{}') !~ '^[a-z0-9_]{1,32}$' then
          return false;
        end if;
      else
        return false;
    end case;
  end loop;
  return true;
end
$$;

-- ── La única puerta de entrada ────────────────────────────────────────
-- Devuelve true si se guardó y false si se descartó por el límite de envíos
-- (no es un error: la app lo da por entregado y no lo reintenta). Un evento o
-- unas props fuera de la lista blanca sí son error (22023): la app lo tira de
-- la cola en vez de reintentarlo para siempre.
create or replace function public.registrar_evento(
  p_install_id text,
  p_evento text,
  p_props jsonb default '{}'::jsonb,
  p_app_version text default null,
  p_plataforma text default null,
  p_ocurrido_en timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_props jsonb := coalesce(p_props, '{}'::jsonb);
  v_cuando timestamptz;
begin
  if p_install_id is null or p_install_id !~ '^[A-Za-z0-9-]{16,64}$' then
    raise exception 'install_id no válido' using errcode = '22023';
  end if;
  if public.funnel_claves_admitidas(p_evento) is null then
    raise exception 'evento no admitido' using errcode = '22023';
  end if;
  if not public.funnel_props_validas(p_evento, v_props) then
    raise exception 'props no admitidas' using errcode = '22023';
  end if;

  -- Límite por instalación (120 por hora) y global (3000 por minuto): sin
  -- cuenta cualquiera puede llamar, así que una inundación se descarta en
  -- silencio en vez de llenar la tabla.
  if (select count(*) from public.funnel_events
       where install_id = p_install_id and recibido_en > now() - interval '1 hour') >= 120 then
    return false;
  end if;
  if (select count(*) from public.funnel_events where recibido_en > now() - interval '1 minute') >= 3000 then
    return false;
  end if;

  v_cuando := case
    when p_ocurrido_en is not null
     and p_ocurrido_en between now() - interval '30 days' and now() + interval '5 minutes'
      then p_ocurrido_en
    else now()
  end;

  insert into public.funnel_events (user_id, install_id, evento, props, app_version, plataforma, created_at)
  values (
    auth.uid(),
    p_install_id,
    p_evento,
    v_props,
    case when p_app_version ~ '^[0-9A-Za-z.+-]{1,24}$' then p_app_version end,
    case when p_plataforma in ('ios', 'android', 'web') then p_plataforma end,
    v_cuando
  );
  return true;
end
$$;

revoke all on function public.registrar_evento(text, text, jsonb, text, text, timestamptz) from public;
grant execute on function public.registrar_evento(text, text, jsonb, text, text, timestamptz) to anon, authenticated;
revoke all on function public.funnel_claves_admitidas(text) from public, anon, authenticated;
revoke all on function public.funnel_props_validas(text, jsonb) from public, anon, authenticated;
comment on function public.registrar_evento(text, text, jsonb, text, text, timestamptz) is
  'Embudo anónimo: inserta un evento de la lista blanca. nivl:funnel-0070';

-- ── Borrado de cuenta ─────────────────────────────────────────────────
-- Al borrar Auth, la FK borra las filas con user_id. Este trigger se lleva
-- además las filas SIN cuenta de las mismas instalaciones (el primer arranque
-- y el onboarding previo al registro), para que no quede rastro que se pueda
-- unir a la persona.
create or replace function public.funnel_borrar_instalacion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.funnel_events where install_id = old.install_id and user_id is null;
  return null;
end
$$;
revoke all on function public.funnel_borrar_instalacion() from public, anon, authenticated;

drop trigger if exists funnel_events_borrado_cuenta on public.funnel_events;
create trigger funnel_events_borrado_cuenta
  after delete on public.funnel_events
  for each row
  when (old.user_id is not null)
  execute function public.funnel_borrar_instalacion();

-- ── Caducidad ─────────────────────────────────────────────────────────
-- 13 meses bastan para comparar un mes con el del año anterior. No hay cron:
-- lo ejecuta service_role (o el panel) cuando toque.
create or replace function public.purgar_funnel_events()
returns integer
language sql
security definer
set search_path = public, pg_temp
as $$
  with borradas as (
    delete from public.funnel_events where created_at < now() - interval '13 months' returning 1
  )
  select count(*)::integer from borradas
$$;
revoke all on function public.purgar_funnel_events() from public, anon, authenticated;

-- ── Flag (apagado). La 0067 crea app_config; si aún no existe, no se siembra.
do $$
begin
  if to_regclass('public.app_config') is not null then
    insert into public.app_config (key, value, public)
    values ('analitica_activa', 'false'::jsonb, true)
    on conflict (key) do nothing;
  end if;
end
$$;

commit;

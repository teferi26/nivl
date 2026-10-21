-- NIVL · 0085 · Interruptores por versión (1.0.11).
-- Huella: coalesce(obj_description(to_regprocedure('public._prueba_auto_al_nacer()'),'pg_proc') like '%nivl:interruptores-1011-0085%', false)
--
-- Por qué: la 1.0.10 publicada lee `modos_activos`, `idiomas_activos`,
-- `prueba_auto_activa`, `valoracion_activa` (0067), `analitica_activa` (0070)
-- y `opinion_activa` (0071). Si se encendieran para todos, la 1.0.10 enseñaría
-- la interfaz VIEJA de Modos F1, que Teferi rechazó. Desde la 1.0.11 la app
-- lee claves nuevas (src/lib/flagsmath.ts → CLAVE_SERVIDOR, analitica.ts,
-- peticiones.ts) y las viejas se quedan APAGADAS PARA SIEMPRE.
--
-- Lo que hace:
--   1. Siembra en app_config, públicas y APAGADAS: modos_1011, idiomas_1011,
--      prueba_auto_1011, valoracion_1011, analitica_1011 y opinion_1011.
--      `prueba_auto_dias` y `prueba_ia_mensajes_dia` no cambian (números del
--      servidor, sin interfaz propia).
--   2. La prueba automática (0069) nace con `prueba_auto_1011`, no con
--      `prueba_auto_activa`: _prueba_auto_al_nacer y prueba_auto_resumen se
--      redefinen leyendo la clave nueva (el resto, idéntico a la 0069).
--
-- Número: 0085 para no chocar con las 0078+ de la rama nivl-1011/ia-barata.
--
-- Encender (solo service_role), cuando la 1.0.11 esté publicada:
--   update app_config set value = 'true' where key = 'modos_1011';
-- Marcha atrás: apagar basta. Las claves viejas NO se encienden nunca.

begin;

insert into public.app_config (key, value, public) values
  ('modos_1011', 'false'::jsonb, true),
  ('idiomas_1011', 'false'::jsonb, true),
  ('prueba_auto_1011', 'false'::jsonb, true),
  ('valoracion_1011', 'false'::jsonb, true),
  ('analitica_1011', 'false'::jsonb, true),
  ('opinion_1011', 'false'::jsonb, true)
on conflict (key) do nothing;

-- ── La prueba nace con el perfil (solo con `prueba_auto_1011`) ─────────
create or replace function public._prueba_auto_al_nacer() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_dias jsonb;
  v_n integer;
begin
  begin
    -- Solo el booleano true enciende. Cualquier otro valor, o sin fila: apagado.
    -- 1.0.11: la clave es `prueba_auto_1011` (`prueba_auto_activa` es de la 1.0.10, apagada).
    if public.app_config_value('prueba_auto_1011', 'false'::jsonb) is distinct from 'true'::jsonb then
      return null;
    end if;
    v_dias := public.app_config_value('prueba_auto_dias', '2'::jsonb);
    if jsonb_typeof(v_dias) is distinct from 'number' then return null; end if;
    v_n := least(14, greatest(1, floor((v_dias #>> '{}')::numeric)::integer));
    -- Nunca pisa nada: si ya hay fila (compra, cortesía, owner, prueba), no hace nada.
    insert into public.subscriptions (user_id, status, plan, provider, current_period_end, updated_at)
    values (new.id, 'trialing', 'prueba_auto', 'prueba', now() + make_interval(days => v_n), now())
    on conflict (user_id) do nothing;
  exception when others then
    -- El alta de la cuenta no se rompe por la prueba.
    raise warning 'prueba_auto: no se pudo crear la prueba (%)', sqlstate;
  end;
  return null;
end $$;
revoke all on function public._prueba_auto_al_nacer() from public, anon, authenticated;
comment on function public._prueba_auto_al_nacer() is
  'Prueba automática de Élite al nacer el perfil, con app_config.prueba_auto_1011. nivl:interruptores-1011-0085';

-- ── El gasto de la prueba (solo servidor), con la clave nueva ─────────
create or replace function public.prueba_auto_resumen() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'activa', public.app_config_value('prueba_auto_1011', 'false'::jsonb) = 'true'::jsonb,
    'pruebas_vivas', (select count(*) from public.subscriptions s
      where s.plan = 'prueba_auto' and s.status = 'trialing' and s.current_period_end > now()),
    'pruebas_total', (select count(*) from public.subscriptions s where s.plan = 'prueba_auto'),
    'gasto_micro_usd', (select coalesce(sum(r.cost_micro_usd), 0) from public.coach_runs r
      join public.subscriptions s on s.user_id = r.user_id
      where s.plan = 'prueba_auto' and r.created_at <= coalesce(s.current_period_end, now()))
  );
$$;
revoke all on function public.prueba_auto_resumen() from public, anon, authenticated;
grant execute on function public.prueba_auto_resumen() to service_role;

commit;

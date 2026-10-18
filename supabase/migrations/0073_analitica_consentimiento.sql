-- 0073 · Analítica con consentimiento previo (dictamen LSSI-ANALITICA-NIVL.md, 18/10/2026).
-- Huella: coalesce(obj_description(to_regprocedure('public.olvidar_instalacion(text)'),'pg_proc') like '%nivl:analitica-consentimiento-0073%', false)
--
-- El embudo pasa a tener como base el consentimiento (art. 22.2 LSSI y art.
-- 6.1.a RGPD). La app no guarda ni envía nada sin un «acepta» vigente. Esta
-- migración añade lo que necesita el servidor:
--   1. Evento `consentimiento_analitica` con `version` en la lista blanca:
--      prueba del consentimiento, con hora y versión del texto (art. 7.1 RGPD).
--   2. `olvidar_instalacion(p_install_id)`: al revocar en Perfil, borra los
--      eventos de esa instalación (art. 17.1.b). Solo las filas sin cuenta o
--      de la propia cuenta; el uuid v4 hace inviable adivinar uno ajeno.
--   3. Purgas programadas (pg_cron, como `nivl-rituales` en la 0010):
--      `funnel_events` a 12 meses y `app_feedback` a 24 meses. Sin pg_cron
--      (pruebas locales) no se programa nada y se avisa.
-- Solo aditiva: la 0070 no se edita; `funnel_claves_admitidas` se reemplaza
-- con la misma lista más el evento nuevo.
begin;

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
    when 'consentimiento_analitica' then array['version']
    else null
  end
$$;
revoke all on function public.funnel_claves_admitidas(text) from public, anon, authenticated;

-- ── Revocación ────────────────────────────────────────────────────────
create or replace function public.olvidar_instalacion(p_install_id text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  if p_install_id is null or p_install_id !~ '^[A-Za-z0-9-]{16,64}$' then
    raise exception 'install_id no válido' using errcode = '22023';
  end if;
  delete from public.funnel_events
   where install_id = p_install_id
     and (user_id is null or user_id = auth.uid());
  get diagnostics v_n = row_count;
  return v_n;
end
$$;
revoke all on function public.olvidar_instalacion(text) from public;
grant execute on function public.olvidar_instalacion(text) to anon, authenticated;
comment on function public.olvidar_instalacion(text) is
  'Revocar la medición de uso: borra los eventos de la instalación. nivl:analitica-consentimiento-0073';

-- ── Purgas ────────────────────────────────────────────────────────────
-- La 0070 la dejó en 12 meses; se reafirma aquí por si se aplicó una versión anterior.
create or replace function public.purgar_funnel_events()
returns integer
language sql
security definer
set search_path = public, pg_temp
as $$
  with borradas as (
    delete from public.funnel_events where created_at < now() - interval '12 months' returning 1
  )
  select count(*)::integer from borradas
$$;
revoke all on function public.purgar_funnel_events() from public, anon, authenticated;

create or replace function public.purgar_app_feedback()
returns integer
language sql
security definer
set search_path = public, pg_temp
as $$
  with borradas as (
    delete from public.app_feedback where created_at < now() - interval '24 months' returning 1
  )
  select count(*)::integer from borradas
$$;
revoke all on function public.purgar_app_feedback() from public, anon, authenticated;

-- Una vez al día, de madrugada en UTC. Si ya existían, se reemplazan.
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'Sin pg_cron: las purgas de analítica no se programan (solo pruebas locales).';
    return;
  end if;
  create extension if not exists pg_cron;
  perform cron.unschedule(jobname) from cron.job
   where jobname in ('nivl-purga-funnel', 'nivl-purga-opiniones');
  perform cron.schedule('nivl-purga-funnel', '17 3 * * *', 'select public.purgar_funnel_events();');
  perform cron.schedule('nivl-purga-opiniones', '27 3 * * *', 'select public.purgar_app_feedback();');
end
$$;

commit;

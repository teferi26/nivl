-- 0072 · Métricas del panel admin + exportación de 0070-0072 (Modos F1 · analítica).
-- docs/modos/F1-analitica.md (contrato de cada RPC).
-- Huella: coalesce(obj_description(to_regprocedure('public.es_admin()'),'pg_proc') like '%nivl:admin-0072%', false)
--         and coalesce(obj_description(to_regprocedure('public.export_my_data()'),'pg_proc') like '%nivl:export-analitica-0072%', false)
--
-- Rol admin EN SERVIDOR: tabla `public.admins(user_id)`. No hay ningún correo
-- escrito en el cliente ni en estas funciones. Dar de alta al dueño es un
-- insert con service_role (SQL Editor o script local), nunca desde la app:
--   insert into public.admins (user_id)
--     select id from auth.users where email = '<correo del dueño>';
-- La tabla está cerrada a anon y authenticated (RLS sin políticas). La web
-- pregunta `es_admin()` para pintar el panel; cada RPC `admin_*` lo vuelve a
-- comprobar (42501 si no), así que esconder el panel no es la seguridad.
--
-- Las RPC solo devuelven agregados (recuentos por día, por paso, por plan).
-- La única que devuelve texto es `admin_opiniones`, sin user_id ni correo.
--
-- Exportación: `export_my_data` se ENVUELVE (rename + función nueva que
-- añade claves) en vez de copiarse: así esta migración suma `funnel_events`,
-- `app_feedback` y `admins` a la exportación que haya vigente al aplicarla,
-- incluida la que deje la 0068 de servidor (user_modes, mode_xp). Para un
-- usuario 1.0.9 el resultado es el de antes más tres claves con listas vacías.
begin;

-- ── Admins ────────────────────────────────────────────────────────────
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from public, anon, authenticated;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
     and exists (select 1 from public.admins a where a.user_id = auth.uid())
$$;
revoke all on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;
comment on function public.es_admin() is '¿La sesión es de un admin? (tabla admins). nivl:admin-0072';

create or replace function public.exigir_admin()
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo admin' using errcode = '42501';
  end if;
end
$$;
revoke all on function public.exigir_admin() from public, anon, authenticated;

-- Ventana de fechas común: por defecto los últimos 30 días; como mucho 366.
create or replace function public.admin_ventana(p_desde date, p_hasta date)
returns table (desde date, hasta date)
language plpgsql
stable
set search_path = public, pg_temp
as $$
begin
  hasta := coalesce(p_hasta, (now() at time zone 'Europe/Madrid')::date);
  desde := coalesce(p_desde, hasta - 30);
  if desde > hasta then
    raise exception 'Fechas al revés' using errcode = '22023';
  end if;
  if hasta - desde > 366 then
    raise exception 'Ventana de más de 366 días' using errcode = '22023';
  end if;
  return next;
end
$$;
revoke all on function public.admin_ventana(date, date) from public, anon, authenticated;

-- ── 1. Resumen (la cabecera del panel) ────────────────────────────────
create or replace function public.admin_resumen()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
begin
  perform public.exigir_admin();
  return jsonb_build_object(
    'usuarios', (select count(*) from public.profiles),
    'altas_hoy', (select count(*) from public.profiles where (created_at at time zone 'Europe/Madrid')::date = v_hoy),
    'altas_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'altas_30d', (select count(*) from public.profiles where created_at > now() - interval '30 days'),
    'activos_hoy', (select count(*) from public.profiles where last_open_on = v_hoy),
    'activos_7d', (select count(*) from public.profiles where last_open_on > v_hoy - 7),
    'activos_30d', (select count(*) from public.profiles where last_open_on > v_hoy - 30),
    'onboarding_hecho', (select count(*) from public.profiles where onboarding_done),
    'instalaciones', (select count(distinct install_id) from public.funnel_events
                       where evento = 'primer_arranque' and not coalesce((props ->> 'previo')::boolean, false)),
    'instalaciones_previas', (select count(distinct install_id) from public.funnel_events
                               where evento = 'primer_arranque' and coalesce((props ->> 'previo')::boolean, false)),
    'suscripciones_vivas', (select count(*) from public.subscriptions
                             where status in ('active', 'trialing')
                               and (current_period_end is null or current_period_end > now())
                               and plan not in ('owner')),
    'opiniones', (select count(*) from public.app_feedback),
    'calculado_en', now()
  );
end
$$;

-- ── 2. Altas por día ──────────────────────────────────────────────────
-- Cuentas creadas (profiles) e instalaciones nuevas (primer_arranque).
create or replace function public.admin_altas_por_dia(p_desde date default null, p_hasta date default null)
returns table (dia date, altas bigint, instalaciones bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_desde date; v_hasta date;
begin
  perform public.exigir_admin();
  select w.desde, w.hasta into v_desde, v_hasta from public.admin_ventana(p_desde, p_hasta) w;
  return query
    select d::date,
      (select count(*) from public.profiles p
        where (p.created_at at time zone 'Europe/Madrid')::date = d::date),
      (select count(distinct f.install_id) from public.funnel_events f
        where f.evento = 'primer_arranque' and not coalesce((f.props ->> 'previo')::boolean, false)
          and (f.created_at at time zone 'Europe/Madrid')::date = d::date)
    from generate_series(v_desde, v_hasta, interval '1 day') d
    order by 1;
end
$$;

-- ── 3. Embudo por paso ────────────────────────────────────────────────
-- Cohorte: instalaciones NUEVAS (primer_arranque sin `previo`: quien ya usaba
-- una versión anterior no cuenta) cuyo primer arranque cae en la ventana. Para cada
-- paso, cuántas de ellas llegaron (alguna vez). Responde «dónde se quedan».
create or replace function public.admin_embudo(p_desde date default null, p_hasta date default null)
returns table (orden integer, paso text, instalaciones bigint, porcentaje numeric)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_desde date; v_hasta date;
begin
  perform public.exigir_admin();
  select w.desde, w.hasta into v_desde, v_hasta from public.admin_ventana(p_desde, p_hasta) w;
  return query
    with cohorte as (
      select distinct f.install_id from public.funnel_events f
      where f.evento = 'primer_arranque' and not coalesce((f.props ->> 'previo')::boolean, false)
        and (f.created_at at time zone 'Europe/Madrid')::date between v_desde and v_hasta
    ),
    ev as (
      select f.install_id, f.evento, f.props from public.funnel_events f
      join cohorte c using (install_id)
    ),
    pasos(orden, paso, evento, clave, valor) as (
      values
        (1, 'primer_arranque', 'primer_arranque', null::text, null::int),
        (2, 'registro', 'registro', null, null),
        (3, 'onboarding_paso_1', 'onboarding_paso', 'paso', 1),
        (4, 'onboarding_paso_2', 'onboarding_paso', 'paso', 2),
        (5, 'onboarding_paso_3', 'onboarding_paso', 'paso', 3),
        (6, 'onboarding_paso_4', 'onboarding_paso', 'paso', 4),
        (7, 'onboarding_paso_5', 'onboarding_paso', 'paso', 5),
        (8, 'onboarding_paso_6', 'onboarding_paso', 'paso', 6),
        (9, 'onboarding_fin', 'onboarding_fin', null, null),
        (10, 'primera_mision_creada', 'primera_mision_creada', null, null),
        (11, 'primera_mision_completada', 'primera_mision_completada', null, null),
        (12, 'd1', 'apertura_dia', 'dia', 1),
        (13, 'd3', 'apertura_dia', 'dia', 3),
        (14, 'd7', 'apertura_dia', 'dia', 7),
        (15, 'paywall_visto', 'paywall_visto', null, null),
        (16, 'compra_iniciada', 'compra_iniciada', null, null),
        (17, 'compra_ok', 'compra_ok', null, null)
    ),
    total as (select count(*)::numeric n from cohorte)
    select p.orden, p.paso,
      (select count(distinct ev.install_id) from ev
        where ev.evento = p.evento
          and (p.clave is null or (ev.props ->> p.clave)::int = p.valor)),
      case when (select n from total) = 0 then 0::numeric
        else round(100 * (select count(distinct ev.install_id) from ev
          where ev.evento = p.evento
            and (p.clave is null or (ev.props ->> p.clave)::int = p.valor)) / (select n from total), 1)
      end
    from pasos p
    order by p.orden;
end
$$;

-- Último paso alcanzado por cada instalación de la cohorte (dónde se quedan).
create or replace function public.admin_donde_se_quedan(p_desde date default null, p_hasta date default null)
returns table (ultimo_paso text, instalaciones bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_desde date; v_hasta date;
begin
  perform public.exigir_admin();
  select w.desde, w.hasta into v_desde, v_hasta from public.admin_ventana(p_desde, p_hasta) w;
  return query
    with cohorte as (
      select distinct f.install_id from public.funnel_events f
      where f.evento = 'primer_arranque' and not coalesce((f.props ->> 'previo')::boolean, false)
        and (f.created_at at time zone 'Europe/Madrid')::date between v_desde and v_hasta
    ),
    rango as (
      select f.install_id,
        case f.evento
          when 'primer_arranque' then 1
          when 'registro' then 2
          when 'onboarding_paso' then 2 + least(greatest(coalesce((f.props ->> 'paso')::int, 0), 0), 6)
          when 'onboarding_fin' then 9
          when 'primera_mision_creada' then 10
          when 'primera_mision_completada' then 11
          else 0
        end r
      from public.funnel_events f join cohorte c using (install_id)
    ),
    maximo as (select install_id, max(r) r from rango group by install_id)
    select case m.r
        when 1 then 'primer_arranque'
        when 2 then 'registro'
        when 9 then 'onboarding_fin'
        when 10 then 'primera_mision_creada'
        when 11 then 'primera_mision_completada'
        else 'onboarding_paso_' || (m.r - 2)
      end,
      count(*)
    from maximo m
    group by m.r
    order by m.r;
end
$$;

-- ── 4. Retención D1 / D3 / D7 por cohorte de instalación ──────────────
-- `dia` lo calcula el móvil con su fecha local (días desde el primer
-- arranque). D7 cuenta solo las cohortes que ya tienen 7 días.
create or replace function public.admin_retencion(p_desde date default null, p_hasta date default null)
returns table (cohorte date, instalaciones bigint, d1 bigint, d3 bigint, d7 bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_desde date; v_hasta date;
begin
  perform public.exigir_admin();
  select w.desde, w.hasta into v_desde, v_hasta from public.admin_ventana(p_desde, p_hasta) w;
  return query
    with primeras as (
      select f.install_id, min((f.created_at at time zone 'Europe/Madrid')::date) dia0
      from public.funnel_events f
      where f.evento = 'primer_arranque' and not coalesce((f.props ->> 'previo')::boolean, false)
      group by f.install_id
    ),
    aperturas as (
      select distinct f.install_id, (f.props ->> 'dia')::int dia
      from public.funnel_events f
      where f.evento = 'apertura_dia' and (f.props ->> 'dia')::int in (1, 3, 7)
    )
    select p.dia0,
      count(*),
      count(*) filter (where exists (select 1 from aperturas a where a.install_id = p.install_id and a.dia = 1)),
      count(*) filter (where exists (select 1 from aperturas a where a.install_id = p.install_id and a.dia = 3)),
      count(*) filter (where exists (select 1 from aperturas a where a.install_id = p.install_id and a.dia = 7))
    from primeras p
    where p.dia0 between v_desde and v_hasta
    group by p.dia0
    order by p.dia0;
end
$$;

-- ── 5. Misiones completadas por día ───────────────────────────────────
create or replace function public.admin_misiones_por_dia(p_desde date default null, p_hasta date default null)
returns table (dia date, completadas bigint, usuarios bigint, creadas bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_desde date; v_hasta date;
begin
  perform public.exigir_admin();
  select w.desde, w.hasta into v_desde, v_hasta from public.admin_ventana(p_desde, p_hasta) w;
  return query
    select d::date,
      (select count(*) from public.completions c where c.date = d::date),
      (select count(distinct c.user_id) from public.completions c where c.date = d::date),
      (select count(*) from public.quests q where (q.created_at at time zone 'Europe/Madrid')::date = d::date)
    from generate_series(v_desde, v_hasta, interval '1 day') d
    order by 1;
end
$$;

-- ── 6. Uso por módulo (qué usan más y qué no) ─────────────────────────
-- Personas distintas y registros en la ventana, por módulo. Solo recuentos.
create or replace function public.admin_uso_modulos(p_desde date default null, p_hasta date default null)
returns table (modulo text, usuarios bigint, registros bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_desde date; v_hasta date;
  v_ini timestamptz; v_fin timestamptz;
begin
  perform public.exigir_admin();
  select w.desde, w.hasta into v_desde, v_hasta from public.admin_ventana(p_desde, p_hasta) w;
  v_ini := v_desde::timestamp at time zone 'Europe/Madrid';
  v_fin := (v_hasta + 1)::timestamp at time zone 'Europe/Madrid';
  return query
    select 'misiones'::text, count(distinct user_id), count(*) from public.completions where date between v_desde and v_hasta
    union all
    select 'gym', count(distinct user_id), count(*) from public.gym_sessions where date between v_desde and v_hasta
    union all
    select 'cardio', count(distinct user_id), count(*) from public.cardio_sessions where date between v_desde and v_hasta
    union all
    select 'nutricion', count(distinct user_id), count(*) from public.nutrition_logs where date between v_desde and v_hasta
    union all
    select 'peso', count(distinct user_id), count(*) from public.body_metrics where date between v_desde and v_hasta
    union all
    select 'diario', count(distinct user_id), count(*) from public.journal_entries where date between v_desde and v_hasta
    union all
    select 'dinero', count(distinct user_id), count(*) from public.transactions where date between v_desde and v_hasta
    union all
    select 'coach', count(distinct user_id), count(*) from public.coach_messages
      where role = 'user' and created_at >= v_ini and created_at < v_fin
    union all
    select 'fotos_progreso', count(distinct user_id), count(*) from public.progress_photos
      where created_at >= v_ini and created_at < v_fin
    union all
    select 'campanas', count(distinct user_id), count(*) from public.dungeons
      where created_at >= v_ini and created_at < v_fin
    union all
    select 'amigos', count(distinct requester), count(*) from public.friendships
      where created_at >= v_ini and created_at < v_fin
    union all
    select 'subidas_de_nivel', count(distinct user_id), count(*) from public.events
      where type = 'level_up' and created_at >= v_ini and created_at < v_fin
    order by 2 desc, 3 desc;
end
$$;

-- ── 7. Conversiones ───────────────────────────────────────────────────
-- Foto de `subscriptions` (por plan, estado y proveedor), cobros reales de
-- `store_sales` en la ventana y el embudo de compra de `funnel_events`.
create or replace function public.admin_conversiones(p_desde date default null, p_hasta date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_desde date; v_hasta date;
  v_ini timestamptz; v_fin timestamptz;
begin
  perform public.exigir_admin();
  select w.desde, w.hasta into v_desde, v_hasta from public.admin_ventana(p_desde, p_hasta) w;
  v_ini := v_desde::timestamp at time zone 'Europe/Madrid';
  v_fin := (v_hasta + 1)::timestamp at time zone 'Europe/Madrid';
  return jsonb_build_object(
    'desde', v_desde,
    'hasta', v_hasta,
    'suscripciones', (
      select coalesce(jsonb_agg(jsonb_build_object('plan', plan, 'status', status, 'provider', provider, 'vivas', n)
        order by n desc), '[]'::jsonb)
      from (
        select s.plan, s.status, s.provider, count(*) n
        from public.subscriptions s
        where s.status in ('active', 'trialing', 'past_due')
          and (s.current_period_end is null or s.current_period_end > now())
        group by 1, 2, 3
      ) x
    ),
    'pruebas_iniciadas', (
      select count(*) from public.subscriptions s
      where s.plan = 'cortesia' and s.status = 'trialing' and s.updated_at >= v_ini and s.updated_at < v_fin
    ),
    'cobros', (
      select coalesce(jsonb_agg(jsonb_build_object('store', store, 'product_id', product_id, 'currency', currency,
        'cobros', n, 'primeros_pagos', primeros, 'importe_cents', importe, 'neto_cents', neto, 'reembolsados', reemb)
        order by n desc), '[]'::jsonb)
      from (
        select s.store, s.product_id, s.currency, count(*) n,
          count(*) filter (where s.payment_number = 1) primeros,
          sum(s.price_cents) importe, sum(s.net_cents) neto,
          count(*) filter (where s.refunded_at is not null) reemb
        from public.store_sales s
        where s.purchased_at >= v_ini and s.purchased_at < v_fin
        group by 1, 2, 3
      ) y
    ),
    'embudo_compra', jsonb_build_object(
      'paywall_visto', (select count(distinct install_id) from public.funnel_events
        where evento = 'paywall_visto' and created_at >= v_ini and created_at < v_fin),
      'compra_iniciada', (select count(distinct install_id) from public.funnel_events
        where evento = 'compra_iniciada' and created_at >= v_ini and created_at < v_fin),
      'compra_ok', (select count(distinct install_id) from public.funnel_events
        where evento = 'compra_ok' and created_at >= v_ini and created_at < v_fin)
    ),
    'paywall_por_motivo', (
      select coalesce(jsonb_object_agg(m, n), '{}'::jsonb) from (
        select coalesce(props ->> 'motivo', 'sin_motivo') m, count(distinct install_id) n
        from public.funnel_events
        where evento = 'paywall_visto' and created_at >= v_ini and created_at < v_fin
        group by 1
      ) z
    )
  );
end
$$;

-- ── 8. Opiniones ──────────────────────────────────────────────────────
-- Paginadas hacia atrás por fecha. Sin user_id ni correo: el panel enseña lo
-- que se escribió, no quién.
create or replace function public.admin_opiniones(p_limite integer default 50, p_antes timestamptz default null)
returns table (id uuid, created_at timestamptz, version text, gusta text, cambiaria text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.exigir_admin();
  return query
    select f.id, f.created_at, f.version, f.gusta, f.cambiaria
    from public.app_feedback f
    where p_antes is null or f.created_at < p_antes
    order by f.created_at desc
    limit least(greatest(coalesce(p_limite, 50), 1), 200);
end
$$;

-- Permisos: solo authenticated (y dentro, solo admin).
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.admin_resumen()',
    'public.admin_altas_por_dia(date,date)',
    'public.admin_embudo(date,date)',
    'public.admin_donde_se_quedan(date,date)',
    'public.admin_retencion(date,date)',
    'public.admin_misiones_por_dia(date,date)',
    'public.admin_uso_modulos(date,date)',
    'public.admin_conversiones(date,date)',
    'public.admin_opiniones(integer,timestamptz)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end
$$;

-- ── Exportación: envolver la vigente y añadir las tablas de 0070-0072 ──
do $$
declare
  v_comentario text := coalesce(obj_description(to_regprocedure('public.export_my_data()'), 'pg_proc'), '');
begin
  if to_regprocedure('public.export_my_data_antes_0072()') is null then
    alter function public.export_my_data() rename to export_my_data_antes_0072;
  end if;
  revoke all on function public.export_my_data_antes_0072() from public, anon, authenticated;

  create or replace function public.export_my_data()
  returns jsonb
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $f$
  declare
    u uuid := auth.uid();
  begin
    if u is null then
      raise exception 'No autenticado' using errcode = '42501';
    end if;
    return public.export_my_data_antes_0072() || jsonb_build_object(
      'funnel_events', (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at), '[]'::jsonb)
                          from public.funnel_events r where r.user_id = u),
      'app_feedback', (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at), '[]'::jsonb)
                         from public.app_feedback r where r.user_id = u),
      'admins', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
                   from public.admins r where r.user_id = u)
    );
  end
  $f$;
  revoke all on function public.export_my_data() from public, anon;
  grant execute on function public.export_my_data() to authenticated;
  -- Se conservan las huellas de las migraciones anteriores (0040-0068).
  execute format('comment on function public.export_my_data() is %L',
    trim(regexp_replace(v_comentario, '\s*nivl:export-analitica-0072', '', 'g') || ' nivl:export-analitica-0072'));
end
$$;

commit;

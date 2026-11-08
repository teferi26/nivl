-- NIVL · 0126 · Todo lo que pinta la TV, en una sola lectura.
-- Huella (scripts/apply-migrations.mjs): comentario nivl:tv-datos-0126 en tv_datos(text, date).
-- Prueba: scripts/test-tv-enlace.mjs. Contrato: tv/CONTRATO.md.
--
-- Depende de la 0125, 0021/0032 (friends_board), 0026/0032 (elite_group_board, my_elite_group, elite_badges),
-- 0052 (friends_ranks), 0030 (health_row, health_consent_active) y 0031 (account_erasure_pending).
--
-- LO QUE NO SE NEGOCIA
--   · Reutiliza las RPC sociales y no las copia: tras validar el token fija, solo para esta transacción, las
--     claims que lee auth.uid() y llama a las originales. Un arreglo futuro de visibilidad, bloqueo o
--     suspensión llega también a la TV. Las claims se restauran antes de devolver.
--   · Solo lectura: lo único que escribe es la marca de lectura y la caducidad deslizante del propio token.
--   · Techo absoluto: 90 días deslizantes, nunca más de 365 desde que se enlazó. Pasado eso, enlazar otra vez.
--   · Frecuencia en servidor: una lectura por token cada 5 s, sin colas. El token se lee sin cerrojo; el turno
--     se toma con FOR UPDATE SKIP LOCKED, así N peticiones a la vez no ocupan N conexiones esperando.
--   · Salud (0030): rutina y peso solo con consentimiento vigente. Las misiones de salud siguen el filtro de
--     friends_board. Nunca correo, dinero, diario, fotos ni retratos.
--   · Token inválido, caducado, revocado o cuenta con borrado pendiente: la misma respuesta exacta.
--
-- DE DÓNDE SALE CADA COSA
--   · rutina: la prescripción del coach para hoy (training_prescriptions, por position) si la hay; si no, el
--     día de la rutina semanal (gym_days por isodow, gym_exercises por position), el mismo que abre useGym.
--     El descanso no está guardado en ninguna tabla: descanso_seg es un valor fijo de 90 s.
--   · arena: friends_board(7), friends_ranks() y elite_badges(), solo filas visibles y en el orden de
--     socialmath.clasificar con la métrica xp (la que abre Amigos).
--   · ludus: my_elite_group() y elite_group_board(7), por nombre. 0026: el ludus no reparte puesto.
--   · semana: misiones con los criterios de _dia_en_vivo (0048) y friends_board. Falla lo programado no hecho
--     de un día ya pasado y no congelado (computeDayClose). xp_ganado usa los recortes de friends_board
--     (sin penalizaciones, 500 por completion) sobre la semana natural.
--   · mapa: la misma cuenta, 84 días de lunes a domingo. Con la lista actual de misiones: borrar una misión
--     la saca también de su historia aquí, igual que en friends_board.
--   · peso: pendientePorDia de analytics.ts y bodymath.ts, en double precision y con el mismo orden de
--     operaciones. Ventana de 56 días, regresión sobre los 28 últimos si hay 3 o más; si no, sobre los 56
--     (analytics.ts). kg/semana = pendiente × 7, a dos decimales como toFixed(2). Si tocas la fórmula, toca
--     las otras dos.
--   · racha: rachaVisible de closing.ts (streak_days, más 1 si hoy ya está cerrado). Tolerancia 0,3 copiada
--     de TOLERANCIA_DIA: si tocas una, toca la otra.
begin;

create or replace function public.tv_datos(p_token text, p_hoy date default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_invalida constant jsonb := jsonb_build_object('estado', 'sesion_invalida');
  d public.tv_dispositivos%rowtype;
  v_techo constant interval := interval '365 days';
  v_intervalo constant integer := 5;
  v_caduca timestamptz;
  u uuid;
  p public.profiles%rowtype;
  v_tz text;
  v_hoy date;
  v_utc date := (now() at time zone 'utc')::date;
  v_lunes date;
  v_inicio date;
  v_salud boolean;
  v_claims text := current_setting('request.jwt.claims', true);
  v_sub text := current_setting('request.jwt.claim.sub', true);
  v_role text := current_setting('request.jwt.claim.role', true);
  v_rango text;
  v_elite boolean;
  v_grupo jsonb;
  v_rutina jsonb;
  v_arena jsonb;
  v_ludus jsonb := null;
  v_dias jsonb;
  v_mapa jsonb;
  v_hechas integer;
  v_falladas integer;
  v_xp integer;
  v_prog_hoy integer;
  v_hechas_hoy integer;
  v_racha integer;
  v_pesos jsonb := '[]'::jsonb;
  v_pendiente double precision := null;
  v_semanal numeric := null;
  v_inicio_recta numeric := null;
  v_fin_recta numeric := null;
  v_lectura text := 'Pésate al menos tres veces para leer la tendencia.';
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return v_invalida; end if;
  select * into d from public.tv_dispositivos where token_hash = public._tv_sha(p_token);
  if not found then return v_invalida; end if;
  if d.caduca_en <= now() or d.creado_en <= now() - v_techo then
    delete from public.tv_dispositivos where id = d.id;
    return v_invalida;
  end if;
  u := d.user_id;
  if public.account_erasure_pending(u) then return v_invalida; end if;
  select * into p from public.profiles where id = u;
  if not found then return v_invalida; end if;

  -- El turno de esta lectura. Quien llegue mientras otra está en curso se va sin esperar.
  perform 1 from public.tv_dispositivos t
    where t.id = d.id and (t.ultima_lectura is null or t.ultima_lectura <= now() - make_interval(secs => v_intervalo))
    for update skip locked;
  if not found then
    return jsonb_build_object('estado', 'demasiado_rapido', 'reintentar_seg', v_intervalo);
  end if;
  update public.tv_dispositivos t set
      ultima_lectura = now(),
      ultimo_uso = case when t.ultimo_uso <= now() - interval '1 day' then now() else t.ultimo_uso end,
      caduca_en = case when t.ultimo_uso <= now() - interval '1 day'
        then least(now() + interval '90 days', t.creado_en + v_techo) else t.caduca_en end
    where t.id = d.id
    returning t.caduca_en into v_caduca;

  v_tz := public.safe_tz(p.timezone);
  -- La fecha de la TV solo vale a un día o menos de la del servidor; si no, manda la zona del perfil.
  v_hoy := case when p_hoy is not null and abs(p_hoy - v_utc) <= 1 then p_hoy else (now() at time zone v_tz)::date end;
  v_lunes := v_hoy - (extract(isodow from v_hoy)::integer - 1);
  v_inicio := v_lunes - 77;
  v_salud := public.health_consent_active(u);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  -- ── Rango propio: el mismo cálculo por logros registrados que friends_ranks ──
  select coalesce((array['E','D','C','B','A','S'])[max(array_position(array['E','D','C','B','A','S'], substr(x.code, 7)))], 'E')
    into v_rango
    from public.achievements x where x.user_id = u and x.code ~ '^rango_[DCBAS]$';

  v_elite := exists(select 1 from public.elite_badges() b where b.user_id = u);

  -- ── Rutina del día ──
  if v_salud then
    select jsonb_build_object(
        'fuente', 'prescripcion',
        'nombre', coalesce((select g.name from public.gym_days g where g.user_id = u
                              and g.day_of_week = extract(isodow from v_hoy)::integer order by g.id limit 1), 'Entreno prescrito'),
        'dia_semana', extract(isodow from v_hoy)::integer,
        'hecha', exists(select 1 from public.gym_sessions s where s.user_id = u and s.date = v_hoy),
        'ejercicios', jsonb_agg(jsonb_build_object('id', t.id, 'nombre', t.exercise_name, 'series', t.sets,
          'reps', t.reps, 'carga_kg', nullif(t.weight, 0), 'descanso_seg', 90) order by t.position, t.id))
      into v_rutina
      from public.training_prescriptions t
      where t.user_id = u and t.date = v_hoy
      having count(*) > 0;

    if v_rutina is null then
      select jsonb_build_object(
          'fuente', 'rutina',
          'nombre', g.name,
          'dia_semana', g.day_of_week,
          'hecha', exists(select 1 from public.gym_sessions s where s.user_id = u and s.date = v_hoy),
          'ejercicios', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'nombre', e.name,
              'series', greatest(1, e.sets), 'reps', e.reps::text, 'carga_kg', nullif(e.weight, 0), 'descanso_seg', 90)
              order by e.position, e.id)
            from public.gym_exercises e where e.gym_day_id = g.id and e.user_id = u), '[]'::jsonb))
        into v_rutina
        from public.gym_days g
        where g.user_id = u and g.day_of_week = extract(isodow from v_hoy)::integer
        order by g.id limit 1;
    end if;
  end if;

  -- ── Arena: las RPC originales ──
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', b.user_id, 'soy_yo', b.is_me, 'nombre', coalesce(nullif(btrim(b.name), ''), 'Gladiador'),
      'titulo', coalesce(b.equipped_title, case x.rango when 'S' then 'Leyenda' when 'A' then 'Héroe de la arena'
        when 'B' then 'Campeón' when 'C' then 'Veterano' when 'D' then 'Gladiador' else 'Tiro' end),
      'rango', x.rango, 'xp_total', coalesce(b.xp_total, 0), 'xp_ventana', coalesce(b.xp_window, 0),
      'racha', coalesce(b.streak_days, 0), 'cumplimiento_pct', b.compliance_pct,
      'elite', eb.user_id is not null)
    order by coalesce(b.xp_window, 0) desc, coalesce(b.compliance_pct, -1) desc, coalesce(b.streak_days, 0) desc,
      coalesce(b.xp_total, 0) desc, b.name, b.user_id), '[]'::jsonb)
    into v_arena
    from public.friends_board(7) b
    left join public.friends_ranks() fr on fr.user_id = b.user_id
    left join public.elite_badges() eb on eb.user_id = b.user_id
    cross join lateral (select case when b.is_me then v_rango else coalesce(fr.rango, 'E') end as rango) x
    where b.visible;

  -- ── Ludus: sin orden por puntos ──
  v_grupo := public.my_elite_group() -> 'group';
  if v_grupo is not null and jsonb_typeof(v_grupo) = 'object' then
    select jsonb_build_object('nombre', v_grupo ->> 'name', 'miembros', coalesce(jsonb_agg(jsonb_build_object(
        'id', b.user_id, 'soy_yo', b.is_me, 'nombre', coalesce(nullif(btrim(b.name), ''), 'Gladiador'),
        'xp_ventana', coalesce(b.xp_window, 0), 'cumplimiento_pct', b.compliance_pct)
      order by b.name, b.user_id), '[]'::jsonb))
      into v_ludus
      from public.elite_group_board(7) b where b.visible;
  end if;

  -- ── Semana y mapa: una sola cuenta de misiones para los dos ──
  with mias as materialized (
    select q.id, q.days_of_week, q.active, q.deactivated_at, q.created_at
    from public.quests q
    where q.user_id = u and not q.is_penalty and not q.is_bonus and q.acquired_at is null
      and (v_salud or not public.health_row('quests', to_jsonb(q)))
  ),
  dias as (select (v_inicio + n)::date as dia from generate_series(0, 83) n),
  programa as (
    select d2.dia, m.id,
      exists(select 1 from public.completions c where c.user_id = u and c.quest_id = m.id and c.date = d2.dia) as hecha
    from dias d2 join mias m on d2.dia <= v_hoy
      and extract(isodow from d2.dia)::integer = any (m.days_of_week)
      and d2.dia >= (m.created_at at time zone v_tz)::date
      and (m.active or (m.deactivated_at is not null and (m.deactivated_at at time zone v_tz)::date >= d2.dia))
  ),
  por_dia as (
    select d2.dia,
      count(pr.id)::integer as programadas,
      count(pr.id) filter (where pr.hecha)::integer as hechas,
      count(pr.id) filter (where not pr.hecha and d2.dia < v_hoy and (p.freeze_until is null or d2.dia > p.freeze_until))::integer as falladas
    from dias d2 left join programa pr on pr.dia = d2.dia
    group by d2.dia
  ),
  semanas as (
    select (por_dia.dia - v_inicio) / 7 as semana,
      jsonb_agg(case when programadas > 0 and dia <= v_hoy then round(hechas::numeric / programadas, 2) else 0 end order by dia) as valores
    from por_dia group by 1
  )
  select
    (select jsonb_agg(jsonb_build_object('fecha', x.dia, 'inicial', (array['L','M','X','J','V','S','D'])[extract(isodow from x.dia)::integer],
        'hechas', x.hechas, 'falladas', x.falladas) order by x.dia) from por_dia x where x.dia >= v_lunes),
    (select jsonb_agg(s.valores order by s.semana) from semanas s),
    (select coalesce(sum(x.hechas), 0)::integer from por_dia x where x.dia >= v_lunes),
    (select coalesce(sum(x.falladas), 0)::integer from por_dia x where x.dia >= v_lunes),
    (select x.programadas from por_dia x where x.dia = v_hoy),
    (select x.hechas from por_dia x where x.dia = v_hoy)
    into v_dias, v_mapa, v_hechas, v_falladas, v_prog_hoy, v_hechas_hoy;

  select coalesce(sum(least(c.xp_awarded, 500)), 0)::integer into v_xp
    from public.completions c join public.quests q on q.id = c.quest_id and not q.is_penalty
    where c.user_id = u and c.date between v_lunes and v_hoy
      and (v_salud or not public.health_row('quests', to_jsonb(q)));

  v_racha := coalesce(p.streak_days, 0) + case
    when (p.freeze_until is null or v_hoy > p.freeze_until) and coalesce(v_prog_hoy, 0) > 0
      and v_prog_hoy - coalesce(v_hechas_hoy, 0) <= floor(v_prog_hoy * 0.3::double precision)
    then 1 else 0 end;

  -- ── Peso: pendientePorDia de analytics.ts y bodymath.ts ──
  if v_salud then
    declare
      v_mx double precision;
      v_my double precision;
      v_num double precision;
      v_den double precision;
      v_n integer;
      v_base date;
      v_ultimo integer;
    begin
      select coalesce(jsonb_agg(jsonb_build_object('dia', 27 - (v_hoy - m.date), 'kg', m.weight_kg) order by m.date), '[]'::jsonb)
        into v_pesos from public.body_metrics m
        where m.user_id = u and m.date between v_hoy - 27 and v_hoy;

      select min(m.date) into v_base from public.body_metrics m
        where m.user_id = u and m.date between v_hoy - 56 and v_hoy;

      if v_base is not null and (select count(*) from public.body_metrics m where m.user_id = u and m.date between v_hoy - 56 and v_hoy) >= 3 then
        with fuente as (
          select (m.date - v_base)::double precision as x, m.weight_kg::double precision as y, m.date
          from public.body_metrics m where m.user_id = u and m.date between v_hoy - 56 and v_hoy
        ),
        usados as (
          select x, y from fuente
          where date >= v_hoy - 28 or (select count(*) from fuente f where f.date >= v_hoy - 28) < 3
        ),
        medias as (select avg(x) as mx, avg(y) as my, count(*)::integer as n from usados)
        select me.mx, me.my, me.n,
          (select sum((us.x - me.mx) * (us.y - me.my)) from usados us),
          (select sum((us.x - me.mx) ^ 2) from usados us)
        into v_mx, v_my, v_n, v_num, v_den
        from medias me;

        if v_n >= 3 and v_den <> 0 then
          v_pendiente := v_num / v_den;
          v_semanal := round((v_pendiente * 7)::numeric, 2);
          v_ultimo := coalesce((v_pesos -> -1 ->> 'dia')::integer, 27);
          -- La recta del estudio en los dos extremos que dibuja la TV (día 0 y último día con dato).
          v_inicio_recta := round((v_my + v_pendiente * ((v_hoy - 27 - v_base)::double precision - v_mx))::numeric, 2);
          v_fin_recta := round((v_my + v_pendiente * ((v_hoy - 27 + v_ultimo - v_base)::double precision - v_mx))::numeric, 2);
          v_lectura := case
            when v_semanal < -1 then 'Bajas muy deprisa. Más de un kilo a la semana cuesta músculo.'
            when v_semanal <= -0.5 then 'Bajas a un ritmo sostenible.'
            when v_semanal < -0.1 then 'Bajas despacio.'
            when v_semanal <= 0.1 then 'Tu peso se mantiene estable.'
            else 'Tu peso sube.'
          end;
        end if;
      end if;
    end;
  end if;

  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);
  perform set_config('request.jwt.claim.role', coalesce(v_role, ''), true);

  return jsonb_build_object(
    'estado', 'ok',
    'generado_en', now(),
    'hoy', v_hoy,
    'sesion_caduca_en', v_caduca,
    'salud_activa', v_salud,
    'perfil', jsonb_build_object(
      'nombre', coalesce(nullif(btrim(p.name), ''), 'Gladiador'),
      'titulo', coalesce(p.equipped_title, case v_rango when 'S' then 'Leyenda' when 'A' then 'Héroe de la arena'
        when 'B' then 'Campeón' when 'C' then 'Veterano' when 'D' then 'Gladiador' else 'Tiro' end),
      'tipo', p.profile_kind,
      'rango', v_rango,
      'xp_total', coalesce(p.xp_total, 0),
      'elite', v_elite),
    'rutina', v_rutina,
    'arena', v_arena,
    'ludus', v_ludus,
    'semana', jsonb_build_object(
      'racha', v_racha,
      'piedras', coalesce(p.protection_stones, 0),
      'piedras_max', 3,
      'xp_ganado', v_xp,
      'hechas', v_hechas,
      'falladas', v_falladas,
      'dias', v_dias,
      'mapa', v_mapa,
      'pesos', v_pesos,
      'tendencia_kg_semana', v_semanal,
      'tendencia_inicio', v_inicio_recta,
      'tendencia_fin', v_fin_recta,
      'lectura', case when v_salud then v_lectura end));
end $$;

revoke all on function public.tv_datos(text, date) from public, anon, authenticated;
grant execute on function public.tv_datos(text, date) to anon;

comment on function public.tv_datos(text, date) is 'nivl:tv-datos-0126 · lectura de la TV por token opaco';

notify pgrst, 'reload schema';
commit;

-- Versión con privacidad (NIVL - Seguridad, 04/10/2026) de docs/game-v2/propuestas/competicion_ajustes.sql (Juego y QA, 0e1b4fe).
-- Sustituye a docs/security-audit/propuestas/duelos_privacidad.sql: las dos redefinían my_duels y la que se aplicara después pisaba a la otra.
-- Cambios sobre la de Juego y QA: del rival (rival, su_indice, sus_dias, su_suficiente) solo con duelo aceptado o terminado, _pareja_ok y social_visible;
-- search_path con pg_temp; notify pgrst (cambia la forma de la tabla). Probada en producción con BEGIN…ROLLBACK.

-- PROPUESTA (NIVL - Juego y QA) · Ajustes de la competición tras la auditoría
-- de coherencia de la fase 3. La 0048 ya está aplicada en producción: esto va
-- en una migración NUEVA (número del coordinador). Aditiva para 1.0.7, que no
-- usa estas RPC; la 1.0.8 sigue funcionando porque solo se AÑADEN columnas.
--
-- 1. my_league_standing devolvía «5.º de 5» a quien no tiene datos esta
--    semana; el contrato (competicionData.ts) dice puesto 0 = sin datos.
-- 2. my_duels resolvía con now()::date > week_start + 7 (UTC): el lunes
--    siguiente el duelo no estaba ni activo ni resuelto. Ahora se resuelve en
--    cuanto la semana ha terminado EN TODOS LOS HUSOS (Etc/GMT+12 ≥ lunes
--    siguiente) y devuelve `semana_cerrada` (hora local de quien consulta) para
--    pintar «Semana cerrada · resolviendo» mientras tanto.
-- 3. my_duels devuelve si cada lado llega al mínimo de 150 XP programados
--    (`mi_suficiente`, `su_suficiente`): sin eso la interfaz decía «va delante»
--    con un índice que era solo el prior (70).

begin;

create or replace function public.my_league_standing()
returns table (league_id uuid, nombre text, puesto integer, miembros integer, indice integer, velocidad numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare u uuid := auth.uid(); l record;
begin
  if u is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  for l in select pl.id, left(regexp_replace(pl.name, '[\r\n\t]', ' ', 'g'), 40) as nombre
           from public.private_leagues pl join public.league_members lm on lm.league_id = pl.id and lm.user_id = u
           order by pl.created_at limit 10 loop
    return query
    with b as materialized (select * from public.league_board(l.id)),
         y as (select * from b where b.es_yo)
    select l.id, l.nombre::text,
      case when bool_or(y.sin_datos) then 0
           else (1 + count(*) filter (where not b.sin_datos and (b.indice, b.velocidad, b.dias_activos) > (y.indice, y.velocidad, y.dias_activos)))::integer
      end,
      count(*)::integer, max(y.indice), max(y.velocidad)
    from b cross join y;
  end loop;
end $$;

-- Cambia la forma de la tabla devuelta: hay que borrarla y crearla de nuevo.
drop function if exists public.my_duels();
create function public.my_duels()
returns table (id uuid, soy_retador boolean, rival text, week_start date, status text,
               mi_indice integer, su_indice integer, mis_dias integer, sus_dias integer, resultado text,
               mi_suficiente boolean, su_suficiente boolean, semana_cerrada boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := auth.uid(); d record; a record; b record; ia integer; ib integer; r text; v_hoy date;
        v_otro uuid; v_ok boolean; v_ver boolean;
begin
  if u is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  perform public._duelos_anular_bloqueados(u);
  select (now() at time zone public.safe_tz(p.timezone))::date into v_hoy from public.profiles p where p.id = u;
  for d in select * from public.duels x where u in (x.challenger, x.opponent)
           and x.week_start >= (now()::date - 35) order by x.week_start desc limit 20 loop
    v_otro := case when d.challenger = u then d.opponent else d.challenger end;
    v_ok := d.status in ('accepted', 'done') and public._pareja_ok(d.challenger, d.opponent);
    -- Privacidad (auditoría 1.0.8, P1): del rival solo se enseña algo si el
    -- duelo está aceptado o terminado, la pareja está bien y él es visible.
    v_ver := v_ok and coalesce((select p.social_visible from public.profiles p where p.id = v_otro), false);
    select * into a from public._marcador(u, d.week_start, d.week_start + 6);
    select * into b from public._marcador(v_otro, d.week_start, d.week_start + 6);
    ia := public._indice(a.cumplidas_xp, a.programadas_xp); ib := public._indice(b.cumplidas_xp, b.programadas_xp);
    r := null;
    -- La semana ha terminado en todos los husos: el lunes siguiente ya ha
    -- empezado incluso en UTC−12.
    if v_ok and (now() at time zone 'Etc/GMT+12')::date >= d.week_start + 7 then
      r := case when a.programadas_xp < 150 or b.programadas_xp < 150 then 'sin_datos'
                when ia > ib then 'gano' when ia < ib then 'pierdo'
                when a.dias_activos > b.dias_activos then 'gano' when a.dias_activos < b.dias_activos then 'pierdo'
                else 'empate' end;
      if d.status = 'accepted' then
        -- Se guarda desde el punto de vista del retador.
        update public.duels set status = 'done', result = jsonb_build_object('retador',
          case when d.challenger = u then r else
            case r when 'gano' then 'pierdo' when 'pierdo' then 'gano' else r end end)
          where public.duels.id = d.id and public.duels.status = 'accepted';
      end if;
    end if;
    id := d.id; soy_retador := d.challenger = u;
    rival := case when public._pareja_ok(d.challenger, d.opponent)
                       and coalesce((select p.social_visible from public.profiles p where p.id = v_otro), false)
                  then public.social_public_name(v_otro) end;
    week_start := d.week_start; status := d.status; mi_indice := ia;
    mis_dias := a.dias_activos; resultado := r;
    mi_suficiente := a.programadas_xp >= 150;
    su_indice := case when v_ver then ib end;
    sus_dias := case when v_ver then b.dias_activos end;
    su_suficiente := case when v_ver then b.programadas_xp >= 150 end;
    semana_cerrada := coalesce(v_hoy, now()::date) >= d.week_start + 7;
    return next;
  end loop;
end $$;
revoke all on function public.my_duels() from public, anon;
grant execute on function public.my_duels() to authenticated;
comment on function public.my_duels() is 'nivl:competicion-0055 · resolución en todos los husos, suficiencia y semana_cerrada; del rival solo con duelo aceptado o terminado, pareja bien y rival visible';

-- La forma de my_duels ha cambiado: PostgREST tiene que recargar su caché.
notify pgrst, 'reload schema';

commit;

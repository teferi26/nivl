-- NIVL · PROPUESTA (Chat 3, auditoría 1.0.8, P1) — número y huella los asigna el coordinador.
-- Huella sugerida: coalesce(obj_description(to_regprocedure('public.my_duels()'),'pg_proc') like '%nivl:duelos-privacidad%', false)
--
-- Fallo (0048_competicion.sql:481-503): my_duels() devolvía su_indice y
-- sus_dias del rival en CUALQUIER estado (pending, declined, cancelled) y
-- aunque estuviera oculto (social_visible = false) o hubiera bloqueado: el
-- nombre se tapaba con _pareja_ok, las cifras no. Un «reto» que el otro nunca
-- acepta servía para mirar su índice semanal en vivo durante 5 semanas.
-- Reproducido en producción con BEGIN…ROLLBACK (docs/security-audit/auditoria-1.0.8.md).
--
-- Arreglo: las cifras y el nombre del rival solo salen si el duelo está
-- aceptado o terminado, la pareja está bien (_pareja_ok) y el rival es
-- visible. Si no, null. Mismo contrato de columnas: la 1.0.8 ya pinta null
-- como «sin datos». El cálculo del resultado no cambia (ya exigía lo mismo
-- salvo la visibilidad, que no afecta al resultado guardado).
-- ADITIVA: create or replace con la misma firma; re-ejecutable.

create or replace function public.my_duels()
returns table (id uuid, soy_retador boolean, rival text, week_start date, status text,
               mi_indice integer, su_indice integer, mis_dias integer, sus_dias integer, resultado text)
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); d record; a record; b record; ia integer; ib integer; r text;
        v_otro uuid; v_ok boolean; v_visible boolean;
begin
  if u is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  perform public._duelos_anular_bloqueados(u);
  for d in select * from public.duels x where u in (x.challenger, x.opponent)
           and x.week_start >= (now()::date - 35) order by x.week_start desc limit 20 loop
    v_otro := case when d.challenger = u then d.opponent else d.challenger end;
    v_ok := d.status in ('accepted', 'done') and public._pareja_ok(d.challenger, d.opponent);
    select coalesce(p.social_visible, false) into v_visible from public.profiles p where p.id = v_otro;
    select * into a from public._marcador(u, d.week_start, d.week_start + 6);
    select * into b from public._marcador(v_otro, d.week_start, d.week_start + 6);
    ia := public._indice(a.cumplidas_xp, a.programadas_xp); ib := public._indice(b.cumplidas_xp, b.programadas_xp);
    r := null;
    if v_ok and now()::date > d.week_start + 7 then
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
    rival := case when public._pareja_ok(d.challenger, d.opponent) and coalesce(v_visible, false)
                  then public.social_public_name(v_otro) end;
    week_start := d.week_start; status := d.status; mi_indice := ia;
    mis_dias := a.dias_activos; resultado := r;
    su_indice := case when v_ok and coalesce(v_visible, false) then ib end;
    sus_dias := case when v_ok and coalesce(v_visible, false) then b.dias_activos end;
    return next;
  end loop;
end $$;

comment on function public.my_duels() is
  'nivl:duelos-privacidad — duelos propios; las cifras y el nombre del rival solo si el duelo está aceptado o terminado, la pareja está bien y el rival es visible.';
revoke all on function public.my_duels() from public, anon;
grant execute on function public.my_duels() to authenticated;

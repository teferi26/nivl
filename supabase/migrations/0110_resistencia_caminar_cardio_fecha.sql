-- NIVL · 0110 · IRON Resistencia: el deporte «caminar» y el tope de cardio por día del acto.
-- Huella: coalesce(obj_description(to_regprocedure('public.award_xp(integer,text,text,jsonb)'), 'pg_proc') like '%nivl:award-xp-cardio-0110%', false)
--
-- Un paseo entraba como «otro»: cobraba 40 XP en vez de 15 y saldaba misiones de
-- correr. Con su propio deporte paga como caminar y no propaga.
--
-- award_xp: `cardio_session` usa la fecha del payload como `journal_entry`, solo
-- si es hoy o ayer. Sin esto, el entreno de ayer gastaba el tope de hoy. El
-- límite sigue en 60 por fecha: 120 como máximo, una vez, al cruzar la medianoche.
begin;

alter table public.entrenos_medidos drop constraint entrenos_medidos_deporte_check;
alter table public.entrenos_medidos add constraint entrenos_medidos_deporte_check
  check (deporte in ('carrera', 'bici', 'piscina', 'aguas_abiertas', 'caminar', 'fuerza', 'otro'));

create or replace function public.award_xp(
  p_amount integer, p_stat text default null, p_event text default null, p_payload jsonb default '{}'::jsonb
) returns public.profiles language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_before integer;
  v_profile public.profiles;
  v_amount integer;
  v_cap integer;
  v_day date;
  v_used integer;
  v_key text;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if p_amount is null then raise exception 'Cantidad inválida'; end if;
  if abs(p_amount) > 2000 then
    raise exception 'Delta de XP fuera de rango: %', p_amount;
  end if;
  if p_stat is not null and p_stat not in ('FUE', 'VIT', 'INT', 'AGI', 'PER') then
    raise exception 'Stat inválida: %', p_stat;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 630030));
  select xp_total, (now() at time zone public.safe_tz(timezone))::date
    into v_before, v_day from public.profiles where id = v_uid;
  if not found then raise exception 'Perfil no encontrado'; end if;

  if p_amount < 0 then
    v_amount := case when p_event = 'rule_broken' then greatest(p_amount, -25) else 0 end;
  else
    v_cap := public.xp_daily_cap(p_event);
    if v_cap is null then
      v_amount := 0;
    else
      v_amount := p_amount;
      -- Diario y cardio: el cliente paga lo de hoy o lo de ayer; el libro usa
      -- el día del acto si es uno de esos dos.
      if p_event in ('journal_entry', 'cardio_session') and (p_payload->>'date') ~ '^\d{4}-\d{2}-\d{2}$'
         and (p_payload->>'date')::date between v_day - 1 and v_day then
        v_day := (p_payload->>'date')::date;
      end if;
      -- "Una sola vez" se ata a la FILA real (id), no al título: el cliente
      -- manda el título hoy, así que se resuelve a la fila más reciente de
      -- esta cuenta con ese título. Una meta que se repite al año siguiente
      -- es otra fila y vuelve a pagar; renombrar no crea otra fila.
      if p_event = 'habit_acquired' then
        select q.id::text into v_key from public.quests q where q.user_id = v_uid
          and (q.id::text = p_payload->>'quest_id' or q.title = p_payload->>'quest')
          order by (q.id::text = p_payload->>'quest_id') desc, q.created_at desc limit 1;
      elsif p_event = 'goal_achieved' then
        select g.id::text into v_key from public.goals g where g.user_id = v_uid
          and (g.id::text = p_payload->>'goal_id' or g.title = p_payload->>'goal')
          order by (g.id::text = p_payload->>'goal_id') desc, g.created_at desc limit 1;
      elsif p_event = 'dungeon_cleared' then
        -- El botín sale del rango GUARDADO de la campaña y exige al menos 3
        -- tareas hechas: el payload no decide cuánto vale.
        select d.id::text,
               case d.rank when 'E' then 50 when 'D' then 100 when 'C' then 150
                           when 'B' then 250 when 'A' then 400 when 'S' then 600 else 0 end
               * (case when (select count(*) from public.dungeon_tasks t
                             where t.dungeon_id = d.id and t.user_id = v_uid and t.done) >= 3 then 1 else 0 end)
          into v_key, v_cap
          from public.dungeons d where d.user_id = v_uid
          and (d.id::text = p_payload->>'dungeon_id' or d.title = p_payload->>'dungeon')
          order by (d.id::text = p_payload->>'dungeon_id') desc, d.created_at desc limit 1;
        v_amount := least(v_amount, coalesce(v_cap, 0));
        v_cap := public.xp_daily_cap(p_event);
      end if;
      if p_event in ('habit_acquired', 'goal_achieved', 'dungeon_cleared') and v_key is null then
        v_amount := 0;
      end if;

      -- Primero el tope diario; la marca de "una sola vez" solo se gasta si
      -- de verdad se paga algo (si no, el cuarto hábito del día la perdería).
      if v_amount > 0 then
        select coalesce(xp, 0) into v_used from public.xp_daily_ledger
          where user_id = v_uid and day = v_day and event = p_event for update;
        v_amount := least(v_amount, greatest(0, v_cap - coalesce(v_used, 0)));
      end if;
      if v_amount > 0 and v_key is not null then
        insert into public.xp_once (user_id, event, key) values (v_uid, p_event, v_key)
          on conflict do nothing;
        if not found then v_amount := 0; end if;
      end if;
      if v_amount > 0 then
        insert into public.xp_daily_ledger (user_id, day, event, xp) values (v_uid, v_day, p_event, v_amount)
          on conflict (user_id, day, event) do update set xp = public.xp_daily_ledger.xp + excluded.xp;
      end if;
    end if;
  end if;

  -- Las stats nunca bajan: un negativo solo toca xp_total.
  update public.profiles set
    xp_total = greatest(0, xp_total + v_amount),
    xp_fue = xp_fue + case when p_stat = 'FUE' and v_amount > 0 then v_amount else 0 end,
    xp_vit = xp_vit + case when p_stat = 'VIT' and v_amount > 0 then v_amount else 0 end,
    xp_int = xp_int + case when p_stat = 'INT' and v_amount > 0 then v_amount else 0 end,
    xp_agi = xp_agi + case when p_stat = 'AGI' and v_amount > 0 then v_amount else 0 end,
    xp_per = xp_per + case when p_stat = 'PER' and v_amount > 0 then v_amount else 0 end
  where id = v_uid
  returning * into v_profile;

  if v_amount < 0 and p_event = 'rule_broken' then
    perform public._recovery_add(v_uid, v_before - v_profile.xp_total);
  end if;

  if p_event is not null then
    insert into public.events (user_id, type, payload)
      values (v_uid, p_event,
        coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('xp', v_amount, 'stat', p_stat));
  end if;
  return v_profile;
end $$;
revoke all on function public.award_xp(integer, text, text, jsonb) from public, anon;
grant execute on function public.award_xp(integer, text, text, jsonb) to authenticated;

comment on function public.award_xp(integer, text, text, jsonb) is
  'Paga XP con topes diarios. cardio_session y journal_entry cargan al día del acto. nivl:award-xp-cardio-0110';

commit;

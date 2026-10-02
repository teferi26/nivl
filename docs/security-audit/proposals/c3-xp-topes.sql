-- PROPUESTA Chat 3 + Chat 5 (sin número): E7, fase 2 de la integridad de la
-- economía. award_xp acepta hoy ±2000 por llamada sin tope ni lista de
-- eventos: cualquier cliente se da XP ilimitado. Valores de game.ts
-- (Chat 5, winter/chat5-qa @ f5eca72).
--
-- Comportamiento (misma firma que 0035, compatible con 1.0.6/1.0.7):
--   · Lo que supera el tope se RECORTA en silencio (la app no se rompe).
--   · Evento desconocido o sin evento: paga 0 (se registra igual).
--   · Negativo solo en rule_broken, y como mucho −25. Las stats nunca bajan.
--   · Una sola vez en la vida: habit_acquired (por misión), goal_achieved (por
--     meta) y dungeon_cleared (por campaña), con la clave que ya mandan los
--     clientes en el payload (título).
--   · Libros en tablas sin acceso de cliente: events no sirve, el usuario
--     puede borrar sus propios eventos.
-- Residual aceptado: cambiar profiles.timezone desplaza "hoy" como mucho un
-- día. Renombrar una misión permite volver a cobrar habit_acquired, pero
-- dentro del tope diario.
-- Mantiene el crédito de recuperación de 0035 en rule_broken.
-- Huella: to_regclass('public.xp_daily_ledger') is not null

begin;

create table if not exists public.xp_daily_ledger (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  event text not null,
  xp integer not null default 0 check (xp >= 0),
  primary key (user_id, day, event)
);
alter table public.xp_daily_ledger enable row level security;
revoke all on public.xp_daily_ledger from anon, authenticated;

create table if not exists public.xp_once (
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null,
  key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, event, key)
);
alter table public.xp_once enable row level security;
revoke all on public.xp_once from anon, authenticated;

-- Tope diario por fuente (XP positivo). null = fuente no admitida.
create or replace function public.xp_daily_cap(p_event text) returns integer
language sql immutable set search_path = public as $$
  select case p_event
    when 'gym_session' then 150
    when 'cardio_session' then 60
    when 'journal_entry' then 15
    when 'weigh_in' then 5
    when 'nutrition_day' then 10
    when 'habit_acquired' then 300
    when 'goal_achieved' then 200
    when 'dungeon_task' then 750
    when 'dungeon_cleared' then 600
    else null end;
$$;

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
      v_key := case p_event
        when 'habit_acquired' then coalesce(p_payload->>'quest_id', p_payload->>'quest')
        when 'goal_achieved' then coalesce(p_payload->>'goal_id', p_payload->>'goal')
        when 'dungeon_cleared' then coalesce(p_payload->>'dungeon_id', p_payload->>'dungeon')
        else null end;
      if p_event in ('habit_acquired', 'goal_achieved', 'dungeon_cleared') then
        if v_key is null or btrim(v_key) = '' then
          v_amount := 0;
        else
          insert into public.xp_once (user_id, event, key) values (v_uid, p_event, left(v_key, 300))
            on conflict do nothing;
          if not found then v_amount := 0; end if;
        end if;
      end if;
      if v_amount > 0 then
        select coalesce(xp, 0) into v_used from public.xp_daily_ledger
          where user_id = v_uid and day = v_day and event = p_event for update;
        v_amount := least(v_amount, greatest(0, v_cap - coalesce(v_used, 0)));
        if v_amount > 0 then
          insert into public.xp_daily_ledger (user_id, day, event, xp) values (v_uid, v_day, p_event, v_amount)
            on conflict (user_id, day, event) do update set xp = public.xp_daily_ledger.xp + excluded.xp;
        end if;
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

commit;

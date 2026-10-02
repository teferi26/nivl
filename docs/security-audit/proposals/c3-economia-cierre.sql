-- PROPUESTA Chat 3 · Seguridad (sin número: lo asigna el coordinador).
-- Integridad de la economía y del cierre del día. Compatible con los clientes
-- existentes (1.0.6/1.0.7): ninguna firma cambia y ningún flujo legítimo falla.
--
-- Hallazgos que cierra (ver docs/security-audit/c3-cierre-y-economia.md):
--   E1 Borrar y recrear el propio perfil con xp_total/streak/bonus inventados.
--   E2 Borrar una completion y volver a cobrar la misma misión el mismo día.
--   E3 apply_day_close_safe sin comparación: dos cierres con estado obsoleto
--      descuentan dos veces (1000 → 850 → 700 reproducido).
--   E4 apply_day_close_safe acepta racha 100000, last_day en 2036 (ninguna
--      penalización futura) o retroceder last_day.
--   E5 Misiones de penalización forjables: el cliente inserta is_penalty con
--      penalty_xp arbitrario y complete_quest paga hasta 50000.
--   E6 Recuperaciones duplicadas (misma penalización dos veces).
--
-- Orden de despliegue: esta migración ANTES de cualquier OTA que la use. No
-- requiere OTA: los clientes actuales siguen funcionando sin cambios.
-- Huella sugerida: to_regclass('public.recovery_credits') is not null

begin;

-- ── E1: el perfil solo nace con su id; borrarlo es cosa del servidor ──────
revoke insert, delete, truncate, trigger, references on public.profiles from anon, authenticated;
grant insert (id) on public.profiles to authenticated;   -- ensureProfile: upsert {id} ignoreDuplicates

-- ── E2: las completions solo las escribe complete_quest (definer) ────────
revoke insert, update, delete, truncate, trigger, references on public.completions from anon, authenticated;

-- ── Libro de recuperación: lo que se puede devolver es lo realmente perdido ─
create table if not exists public.recovery_credits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp integer not null default 0 check (xp >= 0 and xp <= 1000000),
  updated_at timestamptz not null default now()
);
alter table public.recovery_credits enable row level security;
revoke all on public.recovery_credits from anon, authenticated;
-- Sin políticas: solo funciones security definer lo tocan.

create or replace function public._recovery_add(p_user uuid, p_xp integer) returns void
language sql security definer set search_path = public as $$
  insert into public.recovery_credits(user_id, xp) values (p_user, greatest(0, p_xp))
  on conflict (user_id) do update
    set xp = least(1000000, public.recovery_credits.xp + greatest(0, p_xp)), updated_at = now();
$$;
revoke all on function public._recovery_add(uuid, integer) from public, anon, authenticated;

-- "Hoy" más adelantado del planeta (UTC+14): ningún cliente legítimo puede
-- tener un ayer posterior a esto.
create or replace function public._max_local_today() returns date
language sql stable set search_path = public as $$
  select (now() at time zone 'Etc/GMT-14')::date;
$$;

-- ── E3/E4: cierre idempotente y acotado (misma firma que 0017/0030) ──────
create or replace function public.apply_day_close_safe(
  p_last_day date default null, p_streak integer default null, p_stones integer default null,
  p_penalty_xp integer default 0, p_clear_freeze boolean default false, p_perfect_streak integer default null
) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_old public.profiles;
  v_profile public.profiles;
  v_days integer;
begin
  if v_uid is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  if p_penalty_xp is null or p_penalty_xp < 0 then
    raise exception 'Penalización fuera de rango: %', p_penalty_xp;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 630030));
  select * into v_old from public.profiles where id = v_uid for update;
  if not found then raise exception 'Perfil no encontrado'; end if;

  if p_last_day is not null and p_last_day > public._max_local_today() - 1 then
    raise exception 'Día de cierre en el futuro' using errcode = '22023';
  end if;

  -- Repetición (doble llamada con estado obsoleto, reintento tras éxito):
  -- ese tramo ya está cerrado, se devuelve el perfil tal cual sin descontar.
  -- Retroceder last_day nunca es legítimo (abriría una "ausencia" inventada
  -- con la que justificar después una racha enorme): también es no-op.
  if v_old.last_day_processed is not null and p_last_day is not null
     and p_last_day <= v_old.last_day_processed then
    return v_old;
  end if;
  if v_old.last_day_processed is not null and p_last_day is null
     and (p_penalty_xp > 0 or p_streak is not null or p_stones is not null or p_perfect_streak is not null) then
    return v_old;
  end if;

  if v_old.last_day_processed is null then
    -- Primer cierre: solo inicializa el día; no hay ausencia que juzgar.
    v_days := 0;
  else
    v_days := greatest(0, coalesce(p_last_day, v_old.last_day_processed) - v_old.last_day_processed);
  end if;

  -- Cotas de crecimiento: un cierre de N días no puede sumar más de N días de
  -- racha ni más piedras de las que se ganan cada 7 días perfectos.
  if p_streak is not null and (p_streak < 0 or p_streak > v_old.streak_days + v_days) then
    raise exception 'Racha fuera de rango: %', p_streak using errcode = '22023';
  end if;
  if p_perfect_streak is not null and (p_perfect_streak < 0 or p_perfect_streak > v_old.perfect_streak_days + v_days) then
    raise exception 'Racha perfecta fuera de rango: %', p_perfect_streak using errcode = '22023';
  end if;
  if p_stones is not null and (p_stones < 0 or p_stones > 3 or p_stones > v_old.protection_stones + (v_days + 6) / 7) then
    raise exception 'Piedras fuera de rango: %', p_stones using errcode = '22023';
  end if;
  -- Misiones (150/día) + reglas (150/día).
  if p_penalty_xp > 300 * v_days then
    raise exception 'Penalización fuera de rango: %', p_penalty_xp using errcode = '22023';
  end if;

  update public.profiles set
    last_day_processed = coalesce(p_last_day, last_day_processed),
    streak_days = coalesce(p_streak, streak_days),
    perfect_streak_days = coalesce(p_perfect_streak, perfect_streak_days),
    protection_stones = coalesce(p_stones, protection_stones),
    xp_total = greatest(0, xp_total - p_penalty_xp),
    freeze_until = case when p_clear_freeze then null else freeze_until end,
    freeze_reason = case when p_clear_freeze then null else freeze_reason end
  where id = v_uid
  returning * into v_profile;

  -- Lo recuperable es lo que realmente se perdió (el suelo de 0 recorta).
  perform public._recovery_add(v_uid, v_old.xp_total - v_profile.xp_total);
  return v_profile;
end $$;
revoke all on function public.apply_day_close_safe(date,integer,integer,integer,boolean,integer) from public, anon;
grant execute on function public.apply_day_close_safe(date,integer,integer,integer,boolean,integer) to authenticated;

-- award_xp: romper una regla (−25) también acredita lo perdido de verdad.
create or replace function public.award_xp(p_amount integer, p_stat text default null, p_event text default null, p_payload jsonb default '{}'::jsonb)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_before integer;
  v_profile public.profiles;
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
  select xp_total into v_before from public.profiles where id = v_uid;
  update public.profiles set
    xp_total = greatest(0, xp_total + p_amount),
    xp_fue = greatest(0, xp_fue + case when p_stat = 'FUE' then p_amount else 0 end),
    xp_vit = greatest(0, xp_vit + case when p_stat = 'VIT' then p_amount else 0 end),
    xp_int = greatest(0, xp_int + case when p_stat = 'INT' then p_amount else 0 end),
    xp_agi = greatest(0, xp_agi + case when p_stat = 'AGI' then p_amount else 0 end),
    xp_per = greatest(0, xp_per + case when p_stat = 'PER' then p_amount else 0 end)
  where id = v_uid
  returning * into v_profile;
  if not found then raise exception 'Perfil no encontrado'; end if;

  if p_amount < 0 and p_event = 'rule_broken' then
    perform public._recovery_add(v_uid, v_before - v_profile.xp_total);
  end if;

  if p_event is not null then
    insert into public.events (user_id, type, payload)
      values (v_uid, p_event,
        coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('xp', p_amount, 'stat', p_stat));
  end if;
  return v_profile;
end $$;
revoke all on function public.award_xp(integer, text, text, jsonb) from public, anon;
grant execute on function public.award_xp(integer, text, text, jsonb) to authenticated;

-- ── E5/E6: una misión de penalización solo nace de XP realmente perdido ───
create or replace function public.quests_penalty_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_credit integer;
begin
  -- Servidor (service_role, migraciones, scripts) sin restricciones.
  if coalesce(auth.role(), '') <> 'authenticated' then return new; end if;

  if tg_op = 'UPDATE' then
    if new.is_penalty is distinct from old.is_penalty
       or new.penalty_xp is distinct from old.penalty_xp
       or new.penalty_date is distinct from old.penalty_date then
      raise exception 'Una penalización no se edita' using errcode = '42501';
    end if;
    return new;
  end if;

  if not coalesce(new.is_penalty, false) then
    new.penalty_xp := null;
    new.penalty_date := null;
    return new;
  end if;

  if new.penalty_date is null or new.penalty_date > public._max_local_today()
     or new.penalty_date < public._max_local_today() - 2 then
    raise exception 'Fecha de penalización inválida' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 630030));
  -- La misma recuperación dos veces (dos cierres en carrera): se descarta en
  -- silencio, el cliente antiguo no lee el resultado del insert.
  if exists (select 1 from public.quests q where q.user_id = new.user_id and q.is_penalty
             and q.penalty_date = new.penalty_date and q.title = new.title) then
    return null;
  end if;

  select xp into v_credit from public.recovery_credits where user_id = new.user_id for update;
  new.penalty_xp := least(greatest(coalesce(new.penalty_xp, 0), 0), coalesce(v_credit, 0));
  if new.penalty_xp <= 0 then return null; end if;
  update public.recovery_credits set xp = xp - new.penalty_xp, updated_at = now()
    where user_id = new.user_id;
  return new;
end $$;
revoke all on function public.quests_penalty_guard() from public, anon, authenticated;

drop trigger if exists quests_penalty_guard on public.quests;
create trigger quests_penalty_guard before insert or update on public.quests
  for each row execute function public.quests_penalty_guard();

-- ── complete_quest: el pago se acota a lo que la misión puede valer ───────
-- Penalización: exactamente su penalty_xp. Resto: épica (250) × evidencia
-- (1,25) × racha máxima (1,5) = 469. Se recorta en vez de fallar, para no
-- romper a ningún cliente con un redondeo distinto.
create or replace function public.complete_quest(
  p_quest_id uuid, p_date date, p_xp integer, p_bonus integer default 0, p_apply_stat boolean default true, p_evidence_url text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_quest public.quests;
  v_profile public.profiles;
  v_rows integer;
  v_health boolean;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if p_xp is null or p_xp < 0 or p_xp > 50000 then
    raise exception 'XP fuera de rango: %', p_xp;
  end if;
  if p_bonus is null or p_bonus < 0 or p_bonus > 100 then
    raise exception 'Puntos Bonus fuera de rango: %', p_bonus;
  end if;
  if p_date is null or p_date > public._max_local_today() or p_date < public._max_local_today() - 2 then
    raise exception 'Fecha fuera de rango' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text,630030));
  select * into v_quest from public.quests where id = p_quest_id and user_id = v_uid;
  if not found then raise exception 'Misión no encontrada'; end if;
  p_xp := case when v_quest.is_penalty then least(p_xp, coalesce(v_quest.penalty_xp, 0))
               else least(p_xp, 469) end;
  v_health:=public.health_row('quests',to_jsonb(v_quest)) or nullif(p_evidence_url,'') is not null;
  if v_health then perform public.assert_health_write(v_uid); end if;

  insert into public.completions (user_id, quest_id, date, xp_awarded, evidence_url)
    values (v_uid, p_quest_id, p_date, case when v_quest.is_bonus then 0 else p_xp end, p_evidence_url)
    on conflict (user_id, quest_id, date) do nothing;
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    select * into v_profile from public.profiles where id = v_uid;
    return jsonb_build_object('awarded', false, 'profile', to_jsonb(v_profile));
  end if;

  if v_quest.is_bonus then
    update public.profiles set bonus_points = bonus_points + p_bonus
      where id = v_uid returning * into v_profile;
    insert into public.events (user_id, type, health_data, payload)
      values (v_uid, 'bonus_earned', v_health, jsonb_build_object('quest', v_quest.title, 'pb', p_bonus));
  else
    update public.profiles set
      xp_total = greatest(0, xp_total + p_xp),
      xp_fue = xp_fue + case when p_apply_stat and v_quest.stat = 'FUE' then p_xp else 0 end,
      xp_vit = xp_vit + case when p_apply_stat and v_quest.stat = 'VIT' then p_xp else 0 end,
      xp_int = xp_int + case when p_apply_stat and v_quest.stat = 'INT' then p_xp else 0 end,
      xp_agi = xp_agi + case when p_apply_stat and v_quest.stat = 'AGI' then p_xp else 0 end,
      xp_per = xp_per + case when p_apply_stat and v_quest.stat = 'PER' then p_xp else 0 end
    where id = v_uid returning * into v_profile;
    insert into public.events (user_id, type, health_data, payload)
      values (v_uid, 'quest_completed', v_health, jsonb_build_object(
        'quest', v_quest.title, 'xp', p_xp, 'evidence', p_evidence_url is not null));
  end if;

  return jsonb_build_object('awarded', true, 'profile', to_jsonb(v_profile));
end $$;
revoke all on function public.complete_quest(uuid,date,integer,integer,boolean,text) from public, anon;
grant execute on function public.complete_quest(uuid,date,integer,integer,boolean,text) to authenticated;

commit;

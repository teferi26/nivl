-- NIVL · 0009 — Economía atómica (la deuda que 0003 dejó escrita y nunca se hizo)
-- Pegar en SQL Editor después de 0008.
--
-- Hasta ahora el XP se escribía desde el cliente con el total absoluto:
--   update profiles set xp_total = <valor calculado en el móvil>
-- Eso son dos problemas. Uno, carrera read-modify-write: dos acciones casi
-- simultáneas leen el mismo total y la segunda pisa a la primera. Dos,
-- xp_total era escribible a mano, así que el nivel no era un hecho, era una
-- sugerencia.
--
-- Ahora el único camino al dinero del juego son estas RPC, que aplican
-- DELTAS dentro de una transacción, y el UPDATE directo sobre las columnas
-- de economía queda revocado. Importa el doble desde hoy: a partir del
-- lote 1 hay una IA escribiendo en estas tablas.
--
-- Qué NO se mueve al servidor: el cálculo de cuánto XP vale una misión sigue
-- en game.ts (questXp). Es lógica pura, está testeada y duplicarla en SQL
-- crearía dos fuentes de verdad que se desincronizan. El servidor no decide
-- el importe: lo acota, lo aplica de forma atómica y lo hace idempotente.

-- ── Otorgar XP suelto (mazmorras, gym, diario, romper una regla) ─────
-- p_amount puede ser negativo (penalizaciones). El suelo es 0: ni el total
-- ni las stats bajan de ahí.
create or replace function public.award_xp(
  p_amount integer,
  p_stat text default null,
  p_event text default null,
  p_payload jsonb default '{}'::jsonb
) returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if p_amount is null then raise exception 'Cantidad inválida'; end if;
  -- Tope por llamada: un bug o una IA desbocada no pueden inflar el nivel.
  if abs(p_amount) > 2000 then
    raise exception 'Delta de XP fuera de rango: %', p_amount;
  end if;
  if p_stat is not null and p_stat not in ('FUE', 'VIT', 'INT', 'AGI', 'PER') then
    raise exception 'Stat inválida: %', p_stat;
  end if;

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

  if p_event is not null then
    insert into public.events (user_id, type, payload)
      values (v_uid, p_event,
        coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('xp', p_amount, 'stat', p_stat));
  end if;

  return v_profile;
end;
$$;

-- ── Completar una misión: completion + recompensa en la MISMA transacción ──
-- La unique(user_id, quest_id, date) más el on conflict do nothing convierten
-- el doble toque en un no-op: si la completion ya existía no se otorga nada y
-- se devuelve awarded=false. El doble-XP deja de depender de un cerrojo en la
-- UI y pasa a ser imposible por diseño.
create or replace function public.complete_quest(
  p_quest_id uuid,
  p_date date,
  p_xp integer,
  p_bonus integer default 0,
  p_apply_stat boolean default true,
  p_evidence_url text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_quest public.quests;
  v_profile public.profiles;
  v_rows integer;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  -- El techo es alto a propósito: una misión de penalización devuelve de una
  -- vez todo el XP perdido durante una ausencia larga (hasta 150 por día
  -- cerrado), así que un mes fuera son 4.500. Acotar esto a un par de miles
  -- rechazaría recuperaciones legítimas.
  if p_xp is null or p_xp < 0 or p_xp > 50000 then
    raise exception 'XP fuera de rango: %', p_xp;
  end if;
  if p_bonus is null or p_bonus < 0 or p_bonus > 100 then
    raise exception 'Puntos Bonus fuera de rango: %', p_bonus;
  end if;

  select * into v_quest from public.quests where id = p_quest_id and user_id = v_uid;
  if not found then raise exception 'Misión no encontrada'; end if;

  insert into public.completions (user_id, quest_id, date, xp_awarded, evidence_url)
    values (v_uid, p_quest_id, p_date, case when v_quest.is_bonus then 0 else p_xp end, p_evidence_url)
    on conflict (user_id, quest_id, date) do nothing;
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    select * into v_profile from public.profiles where id = v_uid;
    return jsonb_build_object('awarded', false, 'profile', to_jsonb(v_profile));
  end if;

  if v_quest.is_bonus then
    -- Regla 6 del cuaderno: las misiones extra pagan Puntos Bonus, no XP.
    update public.profiles set bonus_points = bonus_points + p_bonus
      where id = v_uid returning * into v_profile;
    insert into public.events (user_id, type, payload)
      values (v_uid, 'bonus_earned', jsonb_build_object('quest', v_quest.title, 'pb', p_bonus));
  else
    update public.profiles set
      xp_total = greatest(0, xp_total + p_xp),
      xp_fue = xp_fue + case when p_apply_stat and v_quest.stat = 'FUE' then p_xp else 0 end,
      xp_vit = xp_vit + case when p_apply_stat and v_quest.stat = 'VIT' then p_xp else 0 end,
      xp_int = xp_int + case when p_apply_stat and v_quest.stat = 'INT' then p_xp else 0 end,
      xp_agi = xp_agi + case when p_apply_stat and v_quest.stat = 'AGI' then p_xp else 0 end,
      xp_per = xp_per + case when p_apply_stat and v_quest.stat = 'PER' then p_xp else 0 end
    where id = v_uid returning * into v_profile;
    insert into public.events (user_id, type, payload)
      values (v_uid, 'quest_completed', jsonb_build_object(
        'quest', v_quest.title, 'xp', p_xp, 'evidence', p_evidence_url is not null));
  end if;

  return jsonb_build_object('awarded', true, 'profile', to_jsonb(v_profile));
end;
$$;

-- ── Cierre del día ──────────────────────────────────────────────────
-- Un parámetro nulo significa "no lo toques", así que la misma RPC sirve
-- para el primer arranque (solo fija last_day_processed) y para un cierre
-- completo con penalización, racha y piedras.
create or replace function public.apply_day_close(
  p_last_day date default null,
  p_streak integer default null,
  p_stones integer default null,
  p_penalty_xp integer default 0,
  p_clear_freeze boolean default false
) returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if p_streak is not null and (p_streak < 0 or p_streak > 100000) then
    raise exception 'Racha fuera de rango: %', p_streak;
  end if;
  if p_stones is not null and (p_stones < 0 or p_stones > 10) then
    raise exception 'Piedras fuera de rango: %', p_stones;
  end if;
  if p_penalty_xp is null or p_penalty_xp < 0 or p_penalty_xp > 50000 then
    raise exception 'Penalización fuera de rango: %', p_penalty_xp;
  end if;

  update public.profiles set
    last_day_processed = coalesce(p_last_day, last_day_processed),
    streak_days = coalesce(p_streak, streak_days),
    protection_stones = coalesce(p_stones, protection_stones),
    xp_total = greatest(0, xp_total - p_penalty_xp),
    freeze_until = case when p_clear_freeze then null else freeze_until end,
    freeze_reason = case when p_clear_freeze then null else freeze_reason end
  where id = v_uid
  returning * into v_profile;

  if not found then raise exception 'Perfil no encontrado'; end if;
  return v_profile;
end;
$$;

-- ── Cierre del grifo ────────────────────────────────────────────────
-- A partir de aquí las columnas de economía solo se mueven por RPC. El resto
-- del perfil (nombre, avatar, título, congelación, horarios) sigue siendo
-- editable directamente por su dueño.
revoke update on public.profiles from authenticated, anon;
grant update (
  name,
  avatar_url,
  equipped_title,
  freeze_until,
  freeze_reason,
  onboarding_done,
  wake_time,
  sleep_time,
  timezone,
  coach_mode
) on public.profiles to authenticated;

revoke all on function public.award_xp(integer, text, text, jsonb) from public, anon;
revoke all on function public.complete_quest(uuid, date, integer, integer, boolean, text) from public, anon;
revoke all on function public.apply_day_close(date, integer, integer, integer, boolean) from public, anon;
grant execute on function public.award_xp(integer, text, text, jsonb) to authenticated;
grant execute on function public.complete_quest(uuid, date, integer, integer, boolean, text) to authenticated;
grant execute on function public.apply_day_close(date, integer, integer, integer, boolean) to authenticated;

-- 0035 · Integridad del cierre del día, la economía y los eventos sin salud.
-- PROPUESTA conjunta Chat 3 (seguridad) + Chat 5 (economía); número asignado
-- por el coordinador el 02/10/2026. Compatible con clientes 1.0.6/1.0.7:
-- ninguna firma existente cambia; close_day_v2 es nueva y opcional.
-- Huella: to_regclass('public.recovery_credits') is not null
-- Detalle y pruebas: docs/security-audit/c3-cierre-y-economia.md
-- Tests: 0035-integridad-cierre-economia.test.sql (33 casos en rollback).
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

-- ── close_day_v2: cierre + recuperación en UNA transacción (clientes nuevos) ─
-- p_expected_last_day es el last_day_processed que vio el cliente: si otro
-- cierre se adelantó, devuelve applied=false y no toca nada. Las
-- recuperaciones ([{title, health_data, xp}]) pasan por quests_penalty_guard,
-- que las limita a lo realmente descontado (xp antes − xp después).
create or replace function public.close_day_v2(
  p_expected_last_day date, p_last_day date,
  p_streak integer default null, p_stones integer default null, p_penalty_xp integer default 0,
  p_clear_freeze boolean default false, p_perfect_streak integer default null,
  p_recoveries jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_seen date;
  v_profile public.profiles;
  v_rec jsonb;
  v_created integer := 0;
begin
  if v_uid is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  if p_last_day is null then raise exception 'Falta el día de cierre' using errcode = '22023'; end if;
  if jsonb_typeof(coalesce(p_recoveries, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_recoveries, '[]'::jsonb)) > 2 then
    raise exception 'Recuperaciones inválidas' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 630030));
  select last_day_processed into v_seen from public.profiles where id = v_uid for update;
  if v_seen is distinct from p_expected_last_day then
    select * into v_profile from public.profiles where id = v_uid;
    return jsonb_build_object('applied', false, 'recoveries', 0, 'profile', to_jsonb(v_profile));
  end if;

  v_profile := public.apply_day_close_safe(p_last_day, p_streak, p_stones, p_penalty_xp, p_clear_freeze, p_perfect_streak);

  for v_rec in select * from jsonb_array_elements(coalesce(p_recoveries, '[]'::jsonb)) loop
    insert into public.quests(user_id, title, stat, difficulty, days_of_week, requires_evidence,
                              is_penalty, penalty_date, penalty_xp, health_data)
    values (v_uid, left(coalesce(v_rec->>'title', 'Misión de penalización'), 200), 'AGI', 'media', '{}', false,
            true, p_last_day + 1, greatest(0, coalesce((v_rec->>'xp')::integer, 0)),
            coalesce((v_rec->>'health_data')::boolean, false));
    if found then v_created := v_created + 1; end if;
  end loop;

  return jsonb_build_object('applied', true, 'recoveries', v_created, 'profile', to_jsonb(v_profile));
end $$;
revoke all on function public.close_day_v2(date,date,integer,integer,integer,boolean,integer,jsonb) from public, anon;
grant execute on function public.close_day_v2(date,date,integer,integer,integer,boolean,integer,jsonb) to authenticated;

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
  -- La penalización ignora p_xp: paga su penalty_xp (hasta 9.000 tras 30 días
  -- con reglas) y solo el día para el que se creó.
  if v_quest.is_penalty and p_date is distinct from v_quest.penalty_date then
    raise exception 'La penalización solo vale su día' using errcode = '22023';
  end if;
  p_xp := case when v_quest.is_penalty then coalesce(v_quest.penalty_xp, 0)
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


-- ── Eventos generales sin consentimiento de salud (bug de 0030) ──────────
CREATE OR REPLACE FUNCTION public.require_health_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare u uuid:=new.user_id; is_health boolean; parent_table text; parent_key text; parent_owned boolean;
begin
  -- Deleting the account remains available after withdrawal. Cascades may
  -- clear nullable references while auth.users is already gone; no new data
  -- can survive that transaction (all owner FKs cascade from auth.users).
  if pg_trigger_depth()>1 and not exists(select 1 from auth.users where id=u) then return new; end if;
  if tg_op='UPDATE' then
    if new.user_id is distinct from old.user_id then raise exception 'No se puede cambiar el titular' using errcode='42501'; end if;
    -- Narrow redaction-only escape for the service erasure RPC after an
    -- explicitly requested pending job. Every economic field must be identical.
    if tg_table_name in ('money_plan','budgets','transactions','category_rules') then
      if auth.role()='service_role' and old.health_note and not new.health_note
        and exists(select 1 from public.health_erasure_jobs where user_id=u and status='pending') then
        if tg_table_name in ('money_plan','budgets') then
          if new.rationale is null and (to_jsonb(new)-array['rationale','health_note'])=(to_jsonb(old)-array['rationale','health_note']) then return new; end if;
        elsif tg_table_name='transactions' then
          if new.description='Descripción retirada' and (to_jsonb(new)-array['description','health_note'])=(to_jsonb(old)-array['description','health_note']) then return new; end if;
        elsif tg_table_name='category_rules' then
          if not new.active and new.pattern='__nivl_removed_'||new.id::text
            and (to_jsonb(new)-array['pattern','active','health_note'])=(to_jsonb(old)-array['pattern','active','health_note']) then return new; end if;
        end if;
      end if;
    end if;
    if tg_table_name='completions' then
      if auth.role()='service_role' and new.evidence_url is null
        and (to_jsonb(new)-'evidence_url')=(to_jsonb(old)-'evidence_url')
        and exists(select 1 from public.health_erasure_jobs where user_id=u and status='pending') then return new; end if;
    end if;
  end if;
  -- RLS on a child alone does not enforce ownership of its referenced parent.
  select x.t,x.k into parent_table,parent_key from (values
    ('completions','quests','quest_id'),('quest_photos','quests','quest_id'),
    ('rule_checks','rules','rule_id'),('rule_breaks','rules','rule_id'),
    ('dungeon_tasks','dungeons','dungeon_id'),('gym_exercises','gym_days','gym_day_id'),
    ('gym_sessions','gym_days','gym_day_id'),('gym_lifts','gym_sessions','session_id'),
    ('day_blocks','day_plans','plan_id'),('coach_messages','coach_threads','thread_id')
  ) x(child,t,k) where x.child=tg_table_name;
  if parent_table is not null and to_jsonb(new)->>parent_key is not null then
    execute format('select exists(select 1 from public.%I where id=$1 and user_id=$2)',parent_table)
      into parent_owned using (to_jsonb(new)->>parent_key)::uuid,u;
    if not parent_owned then raise exception 'Referencia ajena' using errcode='42501'; end if;
  end if;
  if tg_table_name='events' then
    -- Old client APIs pass titles rather than IDs. Preserve known provenance
    -- when they copy a health-tagged mission, rule, campaign or goal.
    if exists(select 1 from public.quests q where q.user_id=u and q.title=new.payload->>'quest' and public.health_row('quests',to_jsonb(q)))
      or exists(select 1 from public.rules r where r.user_id=u and r.text=new.payload->>'rule' and public.health_row('rules',to_jsonb(r)))
      or exists(select 1 from public.dungeons d where d.user_id=u and d.title=new.payload->>'dungeon' and public.health_row('dungeons',to_jsonb(d)))
      or exists(select 1 from public.goals g where g.user_id=u and g.title=new.payload->>'goal' and public.health_row('goals',to_jsonb(g))) then new.health_data:=true; end if;
  end if;
  is_health:=public.health_row(tg_table_name,to_jsonb(new));
  if tg_op='UPDATE' then is_health:=is_health or public.health_row(tg_table_name,to_jsonb(old)); end if;
  if is_health then
    perform public.assert_health_write(u);
    -- A health-derived record cannot be laundered by clearing its marker.
    if to_jsonb(new) ? 'health_data' then new:=jsonb_populate_record(new,jsonb_build_object('health_data',true)); end if;
    if to_jsonb(new) ? 'health_note' then new:=jsonb_populate_record(new,jsonb_build_object('health_note',true)); end if;
  end if;
  if tg_table_name='events' then
    if not is_health then
      if new.type not in ('quest_completed','bonus_earned','habit_acquired','dungeon_task','dungeon_cleared','goal_achieved','rule_broken','penalty','stone_used','stone_earned','streak_lost','level_up','freeze_on','freeze_off','commitment_signed','onboarding_goal','trial_started','creator_referral','pro_interest') then
        perform public.assert_health_write(u);
        new.health_data:=true;
      else new.payload:=public.general_event_payload(new.payload);
      end if;
    end if;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.general_event_payload(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb)
  from jsonb_each(case when jsonb_typeof(p_payload)='object' then p_payload else '{}'::jsonb end)
  where (key in ('xp','pb','level','count','years','dias') and jsonb_typeof(value)='number')
    or (key in ('evidence','boss') and jsonb_typeof(value)='boolean')
    or (key='stat' and (value='null'::jsonb or value #>> '{}' in ('FUE','VIT','INT','AGI','PER')))
    or (key='rank' and value #>> '{}' in ('E','D','C','B','A','S'))
    or (key in ('date','until','open_at','ends') and value #>> '{}' ~ '^\d{4}-\d{2}-\d{2}([T ][0-9:.+Z-]+)?$')
    or (key in ('quest_id','rule_id','dungeon_id','task_id','goal_id') and value #>> '{}' ~ '^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$')
    or (key in ('source','tier','plan') and (value='null'::jsonb or (jsonb_typeof(value)='string' and length(value #>> '{}')<=40)))
    or (key='recuperacion' and value #>> '{}' in ('fallida','ok'))
    or (key in ('quest','goal','rule','consequence','dungeon','task','target','deadline','kind','reason')
      and (value='null'::jsonb or (jsonb_typeof(value)='string' and length(value #>> '{}')<=500)))
$function$
;
commit;

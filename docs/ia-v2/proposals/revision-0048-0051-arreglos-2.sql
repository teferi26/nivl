-- H1: antes de borrar o editar una misión, congelar los días pendientes de cierre
-- (last_day_processed+1 .. ayer local) con la misión TAL COMO ESTABA.
create or replace function public._quests_congelar_pendientes() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_last date; v_hoy date; d date; uid uuid := old.user_id;
begin
  if tg_op = 'UPDATE' and new.active is not distinct from old.active
     and new.days_of_week is not distinct from old.days_of_week and new.difficulty is not distinct from old.difficulty
     and new.is_penalty is not distinct from old.is_penalty and new.is_bonus is not distinct from old.is_bonus
     and new.acquired_at is not distinct from old.acquired_at and new.created_at is not distinct from old.created_at then
    return new;
  end if;
  select p.last_day_processed, (now() at time zone public.safe_tz(p.timezone))::date into v_last, v_hoy
    from public.profiles p where p.id = uid;
  if v_last is not null then
    d := greatest(v_last + 1, v_hoy - 60);
    while d < v_hoy loop
      insert into public.daily_scorecards(user_id, day, programadas_xp, cumplidas_xp)
        select uid, d, s.programadas_xp, s.cumplidas_xp from public._dia_en_vivo(uid, d) s
        on conflict (user_id, day) do update
          set programadas_xp = greatest(daily_scorecards.programadas_xp, excluded.programadas_xp),
              cumplidas_xp = greatest(daily_scorecards.cumplidas_xp, excluded.cumplidas_xp);
      d := d + 1;
    end loop;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke all on function public._quests_congelar_pendientes() from public, anon, authenticated;
drop trigger if exists quests_congelar_pendientes on public.quests;
create trigger quests_congelar_pendientes before update or delete on public.quests
  for each row execute function public._quests_congelar_pendientes();

-- H2: el cierre ya no ignora una foto previa: se queda con el máximo (las
-- recuperaciones al cerrar siguen sumando; borrar o editar no resta).
create or replace function public._scorecard_al_cerrar() returns trigger
language plpgsql security definer set search_path = public as $$
declare d date;
begin
  if new.last_day_processed is not null
     and (old.last_day_processed is null or new.last_day_processed > old.last_day_processed) then
    d := greatest(coalesce(old.last_day_processed + 1, new.last_day_processed), new.last_day_processed - 59);
    while d <= new.last_day_processed loop
      insert into public.daily_scorecards(user_id, day, programadas_xp, cumplidas_xp)
        select new.id, d, s.programadas_xp, s.cumplidas_xp from public._dia_en_vivo(new.id, d) s
        on conflict (user_id, day) do update
          set programadas_xp = greatest(daily_scorecards.programadas_xp, excluded.programadas_xp),
              cumplidas_xp = greatest(daily_scorecards.cumplidas_xp, excluded.cumplidas_xp);
      d := d + 1;
    end loop;
  end if;
  return new;
end $$;

-- L: aceptar exige seguir siendo amigo del dueño
create or replace function public.league_accept(p_league uuid) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); v_owner uuid;
begin
  if u is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  delete from public.league_invites where league_id = p_league and invitee = u and created_at > now() - interval '7 days';
  if not found then raise exception 'Invitación no disponible' using errcode = '42501'; end if;
  select owner into v_owner from public.private_leagues where id = p_league for update;
  if not public._son_amigos(v_owner, u)
     or exists (select 1 from public.league_members m where m.league_id = p_league and not public._pareja_ok(m.user_id, u)) then
    raise exception 'No se puede entrar' using errcode = '42501';
  end if;
  if (select count(*) from public.league_members where league_id = p_league) >= 20 then
    raise exception 'La liga está llena (20)' using errcode = '22023';
  end if;
  insert into public.league_members(league_id, user_id) values (p_league, u) on conflict do nothing;
end $$;

-- G: deactivated_at tampoco se fija al INSERTAR
create or replace function public._quest_deactivated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.deactivated_at := case when new.active then null else now() end;
  elsif new.active is distinct from old.active then
    new.deactivated_at := case when new.active then null else now() end;
  elsif new.deactivated_at is distinct from old.deactivated_at then
    new.deactivated_at := old.deactivated_at;
  end if;
  return new;
end $$;
drop trigger if exists quests_deactivated_at on public.quests;
create trigger quests_deactivated_at before insert or update on public.quests
  for each row execute function public._quest_deactivated_at();

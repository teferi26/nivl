-- NIVL · 0017 — La racha deja de ser todo o nada.
--
-- Con ocho misiones diarias, exigir el 100% para mantener la racha la hacía
-- inalcanzable: en dos semanas de uso real el cazador tuvo tres días perfectos
-- y ni uno seguido, así que la racha nunca pasó de 1 y la stat AGI se quedó
-- clavada en 0. Un día en el que va al gimnasio, escribe el diario, se pesa,
-- lee y registra las comidas no puede leerse como un cero.
--
-- Ahora la racha aguanta hasta un 30% de fallos. El XP sigue costando por cada
-- misión fallada: la tolerancia salva la racha, no el bolsillo.
--
-- La piedra de protección pasa a exigir días PERFECTOS, no días cumplidos. Si
-- la racha se ablanda y la piedra viene con ella, las válvulas se regalarían en
-- vez de ganarse, y una piedra absorbe un día entero de fallos.

alter table public.profiles
  add column if not exists perfect_streak_days integer not null default 0;

-- La columna nueva NO entra en el grant de UPDATE: como el resto de la
-- economía, solo se mueve por RPC.

drop function if exists public.apply_day_close(date, integer, integer, integer, boolean);

create or replace function public.apply_day_close(
  p_last_day date default null,
  p_streak integer default null,
  p_stones integer default null,
  p_penalty_xp integer default 0,
  p_clear_freeze boolean default false,
  p_perfect_streak integer default null
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
  if p_perfect_streak is not null and (p_perfect_streak < 0 or p_perfect_streak > 100000) then
    raise exception 'Racha perfecta fuera de rango: %', p_perfect_streak;
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
    perfect_streak_days = coalesce(p_perfect_streak, perfect_streak_days),
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

revoke all on function public.apply_day_close(date, integer, integer, integer, boolean, integer) from public, anon;
grant execute on function public.apply_day_close(date, integer, integer, integer, boolean, integer) to authenticated;

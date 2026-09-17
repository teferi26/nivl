-- NIVL · 0018 — Para qué usa NIVL cada persona, y el nombre desde Franky.
--
-- NIVL se abre a la gente de Franky: emprendedores, deportistas, estudiantes
-- y quien simplemente quiera ser un 1 % mejor cada día. El perfil guarda
-- para qué la usa cada uno y la app ordena módulos, hábitos propuestos y el
-- énfasis del coach a partir de ahí. No se oculta nada: solo cambia lo que
-- va delante.
--
-- Además, el trigger de alta lee el nombre que viene de Franky
-- (raw_user_meta_data.full_name) para que nadie entre como "Cazador".

alter table public.profiles
  add column if not exists profile_kind text not null default 'general';

alter table public.profiles drop constraint if exists profiles_profile_kind_check;
alter table public.profiles
  add constraint profiles_profile_kind_check
  check (profile_kind in ('emprendedor', 'deportista', 'estudiante', 'general'));

-- Es un campo "de perfil", editable por su dueño como el nombre o el avatar.
grant update (profile_kind) on public.profiles to authenticated;

alter table public.profiles alter column name set default 'Gladiador';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(nullif(left(trim(new.raw_user_meta_data->>'full_name'), 24), ''), 'Gladiador')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

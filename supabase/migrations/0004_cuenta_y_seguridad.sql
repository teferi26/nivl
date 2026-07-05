-- NIVL · 0004 — borrado de cuenta (RGPD) y refuerzo de auth
-- Pegar completo en: Supabase Dashboard → SQL Editor → Run (después de 0003)

-- ── Borrado total de la propia cuenta ───────────────────────────────
-- SECURITY DEFINER: se ejecuta con privilegios elevados pero SOLO borra los
-- datos del usuario que la invoca (auth.uid()). Storage no cae en cascada con
-- auth.users, así que lo borramos explícitamente aquí.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'No autenticado';
  end if;

  -- Evidencias y avatares del usuario
  delete from storage.objects
    where bucket_id in ('evidence', 'avatars')
      and (storage.foldername(name))[1] = uid::text;

  -- Borrar el usuario de auth: en cascada elimina profiles y, por sus FK
  -- (on delete cascade), quests, completions, events, dungeons, gym, dieta,
  -- diario, logros… toda la vida del cazador.
  delete from auth.users where id = uid;
end;
$$;

-- Nadie salvo un usuario autenticado puede ejecutarla, y solo se borra a sí mismo.
revoke all on function public.delete_own_account() from public;
revoke all on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;

-- PROPUESTA (Chat 5) · Rango registrado de mis amigos, para pintar su corona.
-- friends_board (0021/0032) no se toca: esta RPC devuelve solo user_id y
-- rango, y el cliente lo cruza con friends_board por user_id (que ya recibe).
-- Mismas reglas de visibilidad que friends_board: amistad aceptada,
-- social_visible y sin bloqueo ni suspensión (_pareja_ok de 0048).
-- Aditiva; NO toca export_my_data. Número: lo asigna el coordinador.

begin;

create or replace function public.friends_ranks()
returns table (user_id uuid, rango text)
language sql stable security definer set search_path = public as $$
  with amigos as (
    select case when f.requester = auth.uid() then f.addressee else f.requester end as uid
    from public.friendships f
    where f.status = 'accepted' and auth.uid() in (f.requester, f.addressee)
  )
  select a.uid,
    coalesce((select (array['E','D','C','B','A','S'])[max(array_position(array['E','D','C','B','A','S'], substr(x.code, 7)))]
              from public.achievements x where x.user_id = a.uid and x.code ~ '^rango_[DCBAS]$'), 'E')
  from amigos a join public.profiles p on p.id = a.uid
  where auth.uid() is not null and p.social_visible and public._pareja_ok(auth.uid(), a.uid)
  limit 200;
$$;
revoke all on function public.friends_ranks() from public, anon;
grant execute on function public.friends_ranks() to authenticated;

commit;

-- 0053 · Alias propio para las tarjetas de compartir (Chat 3 · Seguridad; número asignado por el coordinador).
-- Huella: to_regprocedure('public.my_share_alias()') is not null
-- Test: 0053_alias_compartir.test.sql (aplicar sin begin/commit y el test, en una transacción que se revierte).
--
-- Las tarjetas firman con el ALIAS público, nunca con el nombre real. Esta RPC
-- devuelve solo el de quien llama, con el mismo origen que friends_board
-- (social_public_name: alias aprobado o «Gladiador xxxxxx»), y si está aprobado.
-- Sin parámetros: no se puede pedir el de nadie más.

begin;

create or replace function public.my_share_alias()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'alias', public.social_public_name(auth.uid()),
    'aprobado', exists (
      select 1 from public.social_profile_reviews r join public.profiles p on p.id = r.user_id
      where r.user_id = auth.uid() and r.status = 'approved' and r.approved_name = p.name
    )
  ) end;
$$;
revoke all on function public.my_share_alias() from public, anon;
grant execute on function public.my_share_alias() to authenticated;

commit;

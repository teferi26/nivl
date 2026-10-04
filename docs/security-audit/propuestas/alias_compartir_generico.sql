-- NIVL · PROPUESTA (NIVL - Seguridad, 04/10/2026; auditoría 1.0.8 P2-13) — número y huella del coordinador.
-- Huella sugerida: coalesce(obj_description(to_regprocedure('public.my_share_alias()'),'pg_proc') like '%nivl:alias-generico%', false)
--
-- my_share_alias (0053) devolvía social_public_name: sin alias aprobado, «Gladiador» + los 6 primeros
-- caracteres del uuid. En una tarjeta que se comparte en redes eso son 24 bits estables del uuid: deja
-- enlazar entre sí todas las tarjetas de la misma persona. En la tabla de amigos sí hace falta distinguir
-- (social_public_name no se toca); en una tarjeta pública, no.
-- Ahora: alias aprobado tal cual; si no, «Gladiador de NIVL». Misma firma y mismas claves (alias, aprobado):
-- la hoja de compartir no cambia. Aditiva y re-ejecutable.

create or replace function public.my_share_alias()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with a as (
    select exists (
      select 1 from public.social_profile_reviews r join public.profiles p on p.id = r.user_id
      where r.user_id = auth.uid() and r.status = 'approved' and r.approved_name = p.name
    ) as aprobado
  )
  select case when auth.uid() is null then null else jsonb_build_object(
    'alias', case when a.aprobado then public.social_public_name(auth.uid()) else 'Gladiador de NIVL' end,
    'aprobado', a.aprobado
  ) end
  from a;
$$;
comment on function public.my_share_alias() is
  'nivl:alias-generico — alias para las tarjetas de compartir: el aprobado o «Gladiador de NIVL», nunca un trozo del uuid.';
revoke all on function public.my_share_alias() from public, anon;
grant execute on function public.my_share_alias() to authenticated;

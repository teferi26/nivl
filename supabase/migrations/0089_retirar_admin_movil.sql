-- 0089 · Retira el primer intento de panel móvil, que llegó a aplicarse en producción.
-- Huella: to_regprocedure('public.admin_cola()') is null
--
-- Esas funciones (y un permiso de lectura de fotos) se aplicaron el 8-nov-2026
-- pero se abandonaron al unir el trabajo con el panel de la 0088, que ya cubre
-- lo mismo: `social_avatar_readable` deja a los admin ver las fotos. Nada las
-- usa. La política restrictiva vuelve a su forma de la 0032.
begin;

drop policy if exists admin_avatares_en_revision on storage.objects;

drop policy if exists social_avatar_safety on storage.objects;
create policy social_avatar_safety on storage.objects as restrictive for select to authenticated
using (bucket_id <> 'avatars' or (storage.foldername(name))[1] = auth.uid()::text or public.social_avatar_readable(name));

drop function if exists public.admin_cola();
drop function if exists public.admin_revisar_perfil(uuid, text, text, text, timestamptz, text, text);
drop function if exists public.admin_cerrar_caso(text, uuid, text, text);
drop function if exists public.admin_puede_ver_avatar(text);

commit;

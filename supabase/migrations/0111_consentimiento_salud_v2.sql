-- El permiso de salud v1 no nombraba pulso, sueño, pasos, energía activa, Apple
-- Salud, Apple Watch ni las rutas GPS que sube la medición (0110). El art. 9 RGPD
-- exige aceptar lo que de verdad se trata: nueva versión y se vuelve a pedir.
-- Va a la vez que la OTA con HEALTH_CONSENT_VERSION nuevo (src/lib/healthmath.ts):
-- un cliente con la versión vieja recibe `version_obsoleta` al aceptar.

create or replace function public.health_consent_version() returns text language sql immutable
set search_path=public as $$ select '2026-11-08-salud-v2'::text $$;

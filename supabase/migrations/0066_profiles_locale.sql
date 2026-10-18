-- NIVL · 0066 · Idioma de la cuenta (Modos, fase 1; contrato MODOS-F1-CONTRATO.md, 18/10/2026).
-- Huella para scripts/apply-migrations.mjs:
--   exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='locale')
-- Prueba: scripts/test-modos-f1.mjs (PGlite, todas las migraciones reales) y scripts/probar-f1-servidor.sql (BEGIN…ROLLBACK).
--
-- profiles.locale: etiqueta BCP-47 corta del idioma de la app (es, en, fr, pt, de, it, pt-BR…). La escribe el
-- cliente nuevo cuando el usuario elige idioma; la lee el servidor (avisos, correos) y viaja al coach en la
-- cabecera x-nivl-locale. NULL = «como hasta hoy» (español): la 1.0.9 no la conoce ni la escribe.
--
-- Compatibilidad con la 1.0.9: ADITIVA. Columna nullable sin default, así que ninguna fila existente cambia y
-- to_jsonb(profiles) solo gana una clave (la exportación, que vuelca la fila completa, la cubre sola).
-- El UPDATE de profiles está revocado por columnas desde la 0009: se concede SOLO esta columna, igual que
-- profile_kind (0018) y social_visible (0021). El CHECK es laxo a propósito (acepta «es_ES» y mayúsculas):
-- un formato raro del móvil no puede tumbar el guardado del perfil; lo que no parece un idioma sí se rechaza.
--
-- Marcha atrás (si hiciera falta; no borra nada de la 1.0.9):
--   revoke update (locale) on public.profiles from authenticated;
--   alter table public.profiles drop constraint if exists profiles_locale_check;
--   alter table public.profiles drop column if exists locale;
-- Re-ejecutable.
begin;

alter table public.profiles add column if not exists locale text;

alter table public.profiles drop constraint if exists profiles_locale_check;
alter table public.profiles add constraint profiles_locale_check check (
  locale is null
  or (char_length(locale) between 2 and 35 and locale ~ '^[A-Za-z]{2,3}([-_][A-Za-z0-9]{1,8})*$')
);

comment on column public.profiles.locale is
  'nivl:profiles-locale-0066 · Idioma de la app (BCP-47 corto). NULL = español, comportamiento de la 1.0.9.';

-- Editable por su dueño, como el nombre o el perfil de uso (la RLS de profiles ya limita a su fila).
grant update (locale) on public.profiles to authenticated;

notify pgrst, 'reload schema';
commit;

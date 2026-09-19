-- NIVL · 0022 — El perfil «profesional» (trabajador).
--
-- Los cuatro perfiles de la 0018 dejaban fuera a la mayoría: quien tiene un
-- trabajo por cuenta ajena, quiere crecer en él y mantener el cuerpo y los
-- hábitos en orden. No es emprendedor (no vende ni lleva caja), ni deportista,
-- ni estudiante, y «en general» no le dice nada al coach sobre su jornada.
--
-- Lo que cambia para él vive en el código (src/lib/kinds.ts y su espejo en
-- supabase/functions/_shared/kinds.ts). Aquí solo se abre la puerta: el CHECK
-- de la 0018 rechazaría el valor nuevo.
--
-- Se sustituye la restricción entera en vez de editar la 0018: una migración
-- aplicada no se toca. Es idempotente (drop if exists + add) y ninguna fila
-- existente puede incumplirla, porque la lista solo crece.

alter table public.profiles drop constraint if exists profiles_profile_kind_check;
alter table public.profiles
  add constraint profiles_profile_kind_check
  check (profile_kind in ('emprendedor', 'trabajador', 'deportista', 'estudiante', 'general'));

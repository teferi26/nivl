-- NIVL · 0003 — endurecimiento de seguridad e integridad (hallazgos de la auditoría)
-- Pegar completo en: Supabase Dashboard → SQL Editor → Run (después de 0001 y 0002)
-- ADITIVA y NO rompe el cliente actual: solo añade validación, no cambia el flujo.

-- ── CHECK de rango: defensa en profundidad contra valores absurdos/negativos ──
alter table public.profiles
  add constraint profiles_xp_nonneg
    check (xp_total >= 0 and xp_fue >= 0 and xp_vit >= 0 and xp_int >= 0 and xp_agi >= 0 and xp_per >= 0),
  add constraint profiles_streak_nonneg check (streak_days >= 0),
  add constraint profiles_stones_range check (protection_stones between 0 and 3);

-- El XP otorgado nunca puede ser negativo ni desorbitado.
-- OJO con el techo: una misión normal tope ronda 469 (250 épica × 1,25 de
-- evidencia × 1,5 de racha), pero una MISIÓN DE PENALIZACIÓN devuelve de golpe
-- todo lo perdido durante una ausencia larga, a razón de hasta 150 XP por día
-- cerrado. Un abandono de un mes son 4.500. El límite de 1.000 que había aquí
-- rechazaba recuperaciones perfectamente válidas (hay una de 2.259 en julio).
alter table public.completions
  add constraint completions_xp_range check (xp_awarded between 0 and 50000);

-- days_of_week solo admite 1..7 (vacío permitido para penalizaciones)
alter table public.quests
  add constraint quests_days_domain check (days_of_week <@ array[1, 2, 3, 4, 5, 6, 7]);

alter table public.gym_lifts
  add constraint gym_lifts_nonneg check (weight >= 0 and reps >= 0);

-- ── RLS: la fila hija debe pertenecer a un padre del mismo usuario ──────────
-- Antes la política solo exigía user_id = auth.uid(), así que se podía crear una
-- tarea con tu user_id apuntando a la mazmorra de otra persona.
drop policy if exists "own dungeon_tasks" on public.dungeon_tasks;
create policy "own dungeon_tasks" on public.dungeon_tasks for all to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.dungeons d where d.id = dungeon_id and d.user_id = auth.uid())
  );

drop policy if exists "own gym_exercises" on public.gym_exercises;
create policy "own gym_exercises" on public.gym_exercises for all to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.gym_days g where g.id = gym_day_id and g.user_id = auth.uid())
  );

drop policy if exists "own gym_lifts" on public.gym_lifts;
create policy "own gym_lifts" on public.gym_lifts for all to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.gym_sessions s where s.id = session_id and s.user_id = auth.uid())
  );

-- ── Storage: límite de tamaño y MIME para evitar subidas abusivas ───────────
update storage.buckets
  set file_size_limit = 5242880, -- 5 MB
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
  where id in ('evidence', 'avatars');

-- ── PENDIENTE (migración 0004, batch dedicado): economía atómica y a prueba de
-- trampas. Mover el XP/racha/piedras a funciones RPC SECURITY DEFINER que apliquen
-- DELTAS en SQL (update profiles set xp_total = xp_total + v_xp ...) y REVOKE de
-- update directo sobre esas columnas a `authenticated`. Requiere refactorizar
-- engine.ts/data.ts para llamar a las RPC en lugar de escribir el total absoluto.
-- Cierra el race read-modify-write y la manipulación directa de xp_total. No se
-- incluye aquí porque exige el refactor del cliente en el mismo paso.

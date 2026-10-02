// NIVL · Arena: datos de mentira para la galería (solo desarrollo).
//
// Un perfil y misiones completos y coherentes para pintar las vistas sin
// Supabase. Solo `import type` de lib: este módulo no arrastra efectos.

import type { Profile, Quest } from '@/lib/types';

/** «Hoy» fijo de la galería: los estados no cambian según el día en que se miren. */
export const HOY_DEMO = '2026-10-02';

/** Perfil de un gladiador a medio camino (nivel ~23, rango A). */
export function perfilDemo(p: Partial<Profile> = {}): Profile {
  return {
    id: 'demo-usuario',
    name: 'Teferi',
    avatar_url: null,
    xp_total: 31840,
    xp_fue: 8200,
    xp_vit: 6100,
    xp_int: 7400,
    xp_agi: 4300,
    xp_per: 5840,
    streak_days: 12,
    perfect_streak_days: 4,
    last_day_processed: '2026-10-01',
    protection_stones: 2,
    freeze_until: null,
    freeze_reason: null,
    equipped_title: null,
    bonus_points: 0,
    onboarding_done: true,
    wake_time: '07:00:00',
    sleep_time: '23:30:00',
    timezone: 'Europe/Madrid',
    coach_mode: 'A',
    profile_kind: 'emprendedor',
    created_at: '2025-11-20T09:00:00Z',
    ...p,
  };
}

let siguienteId = 0;

/** Misión de mentira. Solo `title` es obligatorio; el resto tiene valores normales. */
export function misionDemo(p: Partial<Quest> & { title: string }): Quest {
  siguienteId += 1;
  return {
    id: `demo-mision-${siguienteId}`,
    user_id: 'demo-usuario',
    stat: 'INT',
    difficulty: 'media',
    days_of_week: [1, 2, 3, 4, 5, 6, 7], // ISO: 1 lunes … 7 domingo
    requires_evidence: false,
    active: true,
    is_penalty: false,
    penalty_date: null,
    penalty_xp: null,
    is_bonus: false,
    acquired_at: null,
    acquired_streak: null,
    link: null,
    created_at: '2026-09-01T09:00:00Z',
    ...p,
  };
}

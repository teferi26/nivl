// NIVL · Los datos con los que el coach programa tu cuerpo.
//
// Cardio, nutrición y lo que el coach prescribe para cada sesión. Es la mitad
// del bucle: él prescribe, tú ejecutas y registras, y con eso ajusta lo
// siguiente. Sin estos registros el coach programa a ciegas.

import { supabase } from './supabase';

export type CardioKind = 'correr' | 'nadar' | 'bici' | 'caminar' | 'remo' | 'otro';
export type CardioZone = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5' | 'intervalos' | 'libre';

export interface CardioSession {
  id: string;
  date: string;
  kind: CardioKind;
  distance_km: number | null;
  duration_min: number;
  avg_hr: number | null;
  rpe: number | null;
  zone: CardioZone;
  notes: string | null;
  xp_awarded: number;
}

export interface NutritionTarget {
  id: string;
  from_date: string;
  kcal: number;
  protein_g: number;
  carbs_g: number | null;
  fat_g: number | null;
  rationale: string | null;
}

export interface NutritionLog {
  id: string;
  date: string;
  hit_kcal: boolean;
  hit_protein: boolean;
  kcal_est: number | null;
  protein_est: number | null;
  notes: string | null;
}

export interface Prescription {
  id: string;
  date: string;
  exercise_name: string;
  sets: number;
  reps: string;
  weight: number | null;
  rpe_target: number | null;
  notes: string | null;
  position: number;
}

export const CARDIO_KINDS: CardioKind[] = ['correr', 'nadar', 'bici', 'caminar', 'remo', 'otro'];
export const CARDIO_ZONES: CardioZone[] = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'intervalos', 'libre'];

/** Ritmo en min/km. Devuelve null si no hay distancia (p. ej. natación por tiempo). */
export { paceOf } from './bodymath';

// ── Cardio ──────────────────────────────────────────────────────────

export async function fetchCardio(desde: string): Promise<CardioSession[]> {
  const { data, error } = await supabase
    .from('cardio_sessions')
    .select('*')
    .gte('date', desde)
    .order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CardioSession[];
}

export async function saveCardio(
  userId: string,
  s: {
    date: string;
    kind: CardioKind;
    distance_km: number | null;
    duration_min: number;
    avg_hr: number | null;
    rpe: number | null;
    zone: CardioZone;
    notes: string | null;
    xp: number;
  },
): Promise<CardioSession> {
  // Una sesión de cada tipo por día: repetir el registro corrige el anterior
  // en vez de duplicarlo.
  const { data, error } = await supabase
    .from('cardio_sessions')
    .upsert(
      {
        user_id: userId,
        date: s.date,
        kind: s.kind,
        distance_km: s.distance_km,
        duration_min: s.duration_min,
        avg_hr: s.avg_hr,
        rpe: s.rpe,
        zone: s.zone,
        notes: s.notes,
        xp_awarded: s.xp,
      },
      { onConflict: 'user_id,date,kind' },
    )
    .select()
    .single();
  if (error) throw error;
  return data as CardioSession;
}

export async function deleteCardio(id: string): Promise<void> {
  const { error } = await supabase.from('cardio_sessions').delete().eq('id', id);
  if (error) throw error;
}

/** ¿Ya había sesión de ese tipo ese día? Sirve para no otorgar XP dos veces. */
export async function cardioExists(date: string, kind: CardioKind): Promise<boolean> {
  const { count } = await supabase
    .from('cardio_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('date', date)
    .eq('kind', kind);
  return (count ?? 0) > 0;
}

/**
 * Lo que hace falta saber antes de pagar por una sesión: cuánto XP de cardio
 * lleva cobrado el día (para el tope) y cuánto pagó ya esta misma sesión si es
 * una corrección (para no cobrarla dos veces ni borrarle lo cobrado).
 *
 * Se consulta a la base de datos y no al estado de la pantalla: el tope tiene
 * que aguantar aunque la sesión se registrara en otro momento del día.
 */
export async function cardioDayState(
  date: string,
  kind: CardioKind,
): Promise<{ pagadoHoy: number; pagadoEsteTipo: number | null }> {
  const { data, error } = await supabase
    .from('cardio_sessions')
    .select('kind, xp_awarded')
    .eq('date', date);
  if (error) throw error;
  const filas = (data ?? []) as { kind: CardioKind; xp_awarded: number }[];
  const propia = filas.find((f) => f.kind === kind);
  return {
    pagadoHoy: filas.reduce((a, f) => a + Number(f.xp_awarded ?? 0), 0),
    pagadoEsteTipo: propia ? Number(propia.xp_awarded ?? 0) : null,
  };
}

// ── Nutrición ───────────────────────────────────────────────────────

export async function fetchNutritionTarget(): Promise<NutritionTarget | null> {
  const { data, error } = await supabase
    .from('nutrition_targets')
    .select('*')
    .eq('active', true)
    .order('from_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as NutritionTarget) ?? null;
}

export async function fetchNutritionLog(date: string): Promise<NutritionLog | null> {
  const { data, error } = await supabase
    .from('nutrition_logs')
    .select('*')
    .eq('date', date)
    .maybeSingle();
  if (error) throw error;
  return (data as NutritionLog) ?? null;
}

export async function fetchNutritionLogs(desde: string): Promise<NutritionLog[]> {
  const { data, error } = await supabase
    .from('nutrition_logs')
    .select('*')
    .gte('date', desde)
    .order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as NutritionLog[];
}

export async function saveNutritionLog(
  userId: string,
  log: {
    date: string;
    hit_kcal: boolean;
    hit_protein: boolean;
    kcal_est: number | null;
    protein_est: number | null;
    notes: string | null;
  },
): Promise<NutritionLog> {
  const { data, error } = await supabase
    .from('nutrition_logs')
    .upsert({ user_id: userId, ...log }, { onConflict: 'user_id,date' })
    .select()
    .single();
  if (error) throw error;
  return data as NutritionLog;
}

// ── Lo que el coach prescribe ───────────────────────────────────────

export async function fetchPrescription(date: string): Promise<Prescription[]> {
  const { data, error } = await supabase
    .from('training_prescriptions')
    .select('*')
    .eq('date', date)
    .order('position');
  if (error) throw error;
  return (data ?? []) as Prescription[];
}

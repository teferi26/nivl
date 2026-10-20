// NIVL · IRON · Los datos del historial de un ejercicio (efectos; lo puro en
// historial.ts). Solo lee lo que ya guarda Gimnasio: series (`gym_lifts`
// dentro de `gym_sessions`), la rutina (`gym_exercises`) y lo prescrito por
// el coach (`training_prescriptions`). Nada de tablas nuevas ni de escritura.
//
// El nombre es texto libre, así que no se filtra en el servidor: se traen las
// últimas sesiones y se casan aquí con el mismo casar.ts de «Ver técnica».

import { supabase } from '@/lib/supabase';
import type { DatosHistorial, FilaSerie } from './historial';

/** Sesiones de gimnasio que se miran (de todos los ejercicios). */
const SESIONES = 200;
const PRESCRIPCIONES = 200;

interface FilaSesion {
  date: string;
  gym_lifts: { exercise_name: string; weight: number | string; reps: number; set_index: number | null }[] | null;
}

export async function fetchDatosHistorial(): Promise<DatosHistorial> {
  const [sesiones, rutina, prescripciones] = await Promise.all([
    supabase
      .from('gym_sessions')
      .select('date, gym_lifts ( exercise_name, weight, reps, set_index )')
      .order('date', { ascending: false })
      .limit(SESIONES),
    supabase.from('gym_exercises').select('name, reps'),
    supabase
      .from('training_prescriptions')
      .select('exercise_name, reps, date')
      .order('date', { ascending: false })
      .limit(PRESCRIPCIONES),
  ]);
  if (sesiones.error) throw sesiones.error;
  if (rutina.error) throw rutina.error;
  if (prescripciones.error) throw prescripciones.error;

  const filas: FilaSerie[] = [];
  for (const s of (sesiones.data ?? []) as unknown as FilaSesion[]) {
    for (const l of s.gym_lifts ?? []) {
      filas.push({
        fecha: s.date,
        nombre: l.exercise_name,
        kg: Number(l.weight) || 0,
        reps: Number(l.reps) || 0,
        orden: l.set_index ?? 0,
      });
    }
  }
  return {
    filas,
    rutina: ((rutina.data ?? []) as { name: string; reps: number }[]).map((r) => ({ nombre: r.name, reps: r.reps })),
    prescripciones: ((prescripciones.data ?? []) as { exercise_name: string; reps: string }[]).map((p) => ({
      nombre: p.exercise_name,
      reps: String(p.reps ?? ''),
    })),
  };
}

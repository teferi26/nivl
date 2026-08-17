// NIVL · Los datos de los hábitos. La matemática está en `habits.ts`, sin
// Supabase, para que tenga tests.

import { supabase } from './supabase';
import type { Quest } from './types';

/**
 * Los hábitos son las misiones recurrentes: las que se repiten en unos días de
 * la semana. Se dejan fuera las de penalización (son deuda, no hábito) y las
 * extra del contrato (pagan Puntos Bonus y son voluntarias por definición).
 *
 * No hay tabla aparte a propósito: un hábito y una misión recurrente son la
 * misma cosa mirada en dos momentos, y separarlas obligaría a duplicar
 * completadas, XP, racha y todas las herramientas del coach.
 */
export async function fetchHabitos(): Promise<Quest[]> {
  const { data, error } = await supabase
    .from('quests')
    .select('*')
    .eq('active', true)
    .eq('is_penalty', false)
    .eq('is_bonus', false)
    .order('created_at');
  if (error) throw error;
  return ((data ?? []) as Quest[]).filter((q) => (q.days_of_week ?? []).length > 0);
}

/**
 * Fechas completadas de cada hábito, agrupadas por misión.
 *
 * Se traen 200 días de golpe en una sola consulta en vez de una por hábito: con
 * ocho hábitos serían ocho viajes cada vez que se abre la pantalla.
 */
export async function fetchFechasPorHabito(dias = 200): Promise<Map<string, Set<string>>> {
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);
  const { data, error } = await supabase
    .from('completions')
    .select('quest_id, date')
    .gte('date', desde.toISOString().slice(0, 10));
  if (error) throw error;

  const mapa = new Map<string, Set<string>>();
  for (const c of (data ?? []) as { quest_id: string; date: string }[]) {
    const set = mapa.get(c.quest_id) ?? new Set<string>();
    set.add(c.date);
    mapa.set(c.quest_id, set);
  }
  return mapa;
}

/** Consolidar: deja de programarse, con su racha congelada. */
export async function consolidarHabito(questId: string, racha: number): Promise<void> {
  const { error } = await supabase
    .from('quests')
    .update({ acquired_at: new Date().toISOString(), acquired_streak: racha })
    .eq('id', questId);
  if (error) throw error;
}

/** Volver a exigirlo: la racha se recalcula sola desde las completadas. */
export async function reactivarHabito(questId: string): Promise<void> {
  const { error } = await supabase
    .from('quests')
    .update({ acquired_at: null, acquired_streak: null })
    .eq('id', questId);
  if (error) throw error;
}

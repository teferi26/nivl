// NIVL · El plan del día: acceso a datos.
//
// La lógica pura (horas, bloque actual, progreso) vive en plan.ts, igual que
// closing.ts frente a engine.ts. Aquí solo lo que habla con Supabase.

import { supabase } from './supabase';
import type { DayBlock, DayPlan, PlanConBloques } from './plan';

export * from './plan';

export async function fetchPlan(fecha: string): Promise<PlanConBloques | null> {
  const { data: plan, error } = await supabase
    .from('day_plans')
    .select('id, date, status, verdict, brief, generated_at')
    .eq('date', fecha)
    .maybeSingle();
  if (error) throw error;
  if (!plan) return null;

  const { data: bloques, error: errB } = await supabase
    .from('day_blocks')
    .select('*')
    .eq('plan_id', (plan as DayPlan).id)
    .order('position', { ascending: true });
  if (errB) throw errB;

  return { plan: plan as DayPlan, bloques: (bloques ?? []) as DayBlock[] };
}

export async function setBlockDone(id: string, done: boolean): Promise<void> {
  const { error } = await supabase.from('day_blocks').update({ done }).eq('id', id);
  if (error) throw error;
}

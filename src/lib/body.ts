import { supabase } from './supabase';
import type { GymDay, GymExercise, GymLift, GymSession, MealSlot, MealSlotName, ShoppingItem } from './types';

// ── Gimnasio ───────────────────────────────────────────────────────
export async function fetchGymDays(): Promise<GymDay[]> {
  const { data, error } = await supabase
    .from('gym_days')
    .select('*')
    .order('day_of_week', { ascending: true });
  if (error) throw error;
  return (data ?? []) as GymDay[];
}

export async function createGymDay(userId: string, dayOfWeek: number, name: string): Promise<GymDay> {
  const { data, error } = await supabase
    .from('gym_days')
    .insert({ user_id: userId, day_of_week: dayOfWeek, name })
    .select()
    .single();
  if (error) throw error;
  return data as GymDay;
}

export async function deleteGymDay(id: string): Promise<void> {
  const { error } = await supabase.from('gym_days').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchGymExercises(): Promise<GymExercise[]> {
  const { data, error } = await supabase
    .from('gym_exercises')
    .select('*')
    .order('position', { ascending: true });
  if (error) throw error;
  return (data ?? []) as GymExercise[];
}

export async function createGymExercise(
  userId: string,
  gymDayId: string,
  input: { name: string; sets: number; reps: number; weight?: number | null; position: number },
): Promise<GymExercise> {
  const { data, error } = await supabase
    .from('gym_exercises')
    .insert({ user_id: userId, gym_day_id: gymDayId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data as GymExercise;
}

export async function deleteGymExercise(id: string): Promise<void> {
  const { error } = await supabase.from('gym_exercises').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchSessionForDate(date: string): Promise<GymSession | null> {
  const { data } = await supabase.from('gym_sessions').select('*').eq('date', date).maybeSingle();
  return (data as GymSession) ?? null;
}

export async function createSession(
  userId: string,
  input: { date: string; gym_day_id: string | null; xp_awarded: number; notes?: string | null },
): Promise<GymSession> {
  const { data, error } = await supabase
    .from('gym_sessions')
    .insert({ user_id: userId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data as GymSession;
}

export async function insertLifts(
  userId: string,
  sessionId: string,
  lifts: { exercise_name: string; weight: number; reps: number }[],
): Promise<void> {
  if (lifts.length === 0) return;
  const { error } = await supabase
    .from('gym_lifts')
    .insert(lifts.map((l) => ({ user_id: userId, session_id: sessionId, ...l })));
  if (error) throw error;
}

// Máximo histórico por ejercicio (para detectar PRs)
export async function fetchMaxLifts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('gym_lifts').select('exercise_name, weight');
  if (error) throw error;
  const max: Record<string, number> = {};
  for (const row of (data ?? []) as { exercise_name: string; weight: number }[]) {
    const w = Number(row.weight) || 0;
    if (!(row.exercise_name in max) || w > (max[row.exercise_name] ?? 0)) {
      max[row.exercise_name] = w;
    }
  }
  return max;
}

export async function countSessions(): Promise<number> {
  const { count } = await supabase.from('gym_sessions').select('*', { count: 'exact', head: true });
  return count ?? 0;
}

// ── Dieta ──────────────────────────────────────────────────────────
export const MEAL_SLOTS: MealSlotName[] = ['desayuno', 'comida', 'merienda', 'cena', 'snack'];

export async function fetchMealSlots(): Promise<MealSlot[]> {
  const { data, error } = await supabase
    .from('meal_slots')
    .select('*')
    .order('day_of_week', { ascending: true });
  if (error) throw error;
  return (data ?? []) as MealSlot[];
}

export async function upsertMealSlot(
  userId: string,
  input: { id?: string; day_of_week: number; slot: MealSlotName; description: string; ingredients?: string | null },
): Promise<void> {
  if (input.id) {
    const { error } = await supabase
      .from('meal_slots')
      .update({ description: input.description, ingredients: input.ingredients ?? null })
      .eq('id', input.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('meal_slots').insert({
      user_id: userId,
      day_of_week: input.day_of_week,
      slot: input.slot,
      description: input.description,
      ingredients: input.ingredients ?? null,
    });
    if (error) throw error;
  }
}

export async function deleteMealSlot(id: string): Promise<void> {
  const { error } = await supabase.from('meal_slots').delete().eq('id', id);
  if (error) throw error;
}

// ── Lista de la compra ─────────────────────────────────────────────
export async function fetchShoppingItems(): Promise<ShoppingItem[]> {
  const { data, error } = await supabase
    .from('shopping_items')
    .select('*')
    .order('done', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ShoppingItem[];
}

export async function addShoppingItems(
  userId: string,
  items: { name: string; qty?: string | null }[],
): Promise<void> {
  if (items.length === 0) return;
  const { error } = await supabase
    .from('shopping_items')
    .insert(items.map((i) => ({ user_id: userId, name: i.name, qty: i.qty ?? null })));
  if (error) throw error;
}

export async function setShoppingDone(id: string, done: boolean): Promise<void> {
  const { error } = await supabase.from('shopping_items').update({ done }).eq('id', id);
  if (error) throw error;
}

export async function clearDoneShopping(): Promise<void> {
  const { error } = await supabase.from('shopping_items').delete().eq('done', true);
  if (error) throw error;
}

// Genera la lista desde los ingredientes del plan semanal (dedup por nombre)
export function ingredientsFromPlan(slots: MealSlot[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const slot of slots) {
    if (!slot.ingredients) continue;
    for (const raw of slot.ingredients.split(/[,;\n]/)) {
      const name = raw.trim();
      const key = name.toLowerCase();
      if (name && !seen.has(key)) {
        seen.add(key);
        out.push(name);
      }
    }
  }
  return out;
}

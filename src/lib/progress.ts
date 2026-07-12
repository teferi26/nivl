import { supabase } from './supabase';
import type { BodyMetric, Goal, GoalMetric } from './types';

// ── Peso corporal ───────────────────────────────────────────────────
export async function fetchWeights(days = 180): Promise<BodyMetric[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('body_metrics')
    .select('*')
    .gte('date', since)
    .order('date', { ascending: true });
  if (error) throw error;
  return (data ?? []) as BodyMetric[];
}

// Upsert por (user,date): pesarse dos veces el mismo día actualiza, no duplica.
export async function upsertWeight(
  userId: string,
  date: string,
  weightKg: number,
): Promise<{ metric: BodyMetric; isNew: boolean }> {
  const { data: existing } = await supabase
    .from('body_metrics')
    .select('id')
    .eq('date', date)
    .maybeSingle();
  const { data, error } = await supabase
    .from('body_metrics')
    .upsert({ user_id: userId, date, weight_kg: weightKg }, { onConflict: 'user_id,date' })
    .select()
    .single();
  if (error) throw error;
  return { metric: data as BodyMetric, isNew: !existing };
}

// ── Récords por ejercicio (desde las series ya registradas en gym) ──
export async function fetchPersonalRecords(): Promise<{ exercise: string; weight: number }[]> {
  const { data, error } = await supabase.from('gym_lifts').select('exercise_name, weight');
  if (error) throw error;
  const max = new Map<string, number>();
  for (const row of (data ?? []) as { exercise_name: string; weight: number }[]) {
    const w = Number(row.weight) || 0;
    if (w > (max.get(row.exercise_name) ?? 0)) max.set(row.exercise_name, w);
  }
  return [...max.entries()]
    .map(([exercise, weight]) => ({ exercise, weight }))
    .filter((r) => r.weight > 0)
    .sort((a, b) => b.weight - a.weight);
}

// Serie histórica de un ejercicio (mejor peso por sesión) para la gráfica.
export async function fetchExerciseSeries(
  exercise: string,
): Promise<{ date: string; weight: number }[]> {
  const { data, error } = await supabase
    .from('gym_lifts')
    .select('weight, session_id, gym_sessions ( date )')
    .eq('exercise_name', exercise);
  if (error) throw error;
  const bySession = new Map<string, number>();
  for (const row of (data ?? []) as unknown as {
    weight: number;
    gym_sessions: { date: string } | null;
  }[]) {
    const date = row.gym_sessions?.date;
    if (!date) continue;
    const w = Number(row.weight) || 0;
    if (w > (bySession.get(date) ?? 0)) bySession.set(date, w);
  }
  return [...bySession.entries()]
    .map(([date, weight]) => ({ date, weight }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

// ── Metas medibles ──────────────────────────────────────────────────
export async function fetchGoals(): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .order('status', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Goal[];
}

export async function createGoal(
  userId: string,
  input: {
    title: string;
    metric_type: GoalMetric;
    exercise_name?: string | null;
    start_value: number;
    target_value: number;
    unit: string;
    deadline?: string | null;
  },
): Promise<Goal> {
  const { data, error } = await supabase
    .from('goals')
    .insert({ user_id: userId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data as Goal;
}

export async function updateGoal(id: string, patch: Partial<Goal>): Promise<void> {
  const { error } = await supabase.from('goals').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from('goals').delete().eq('id', id);
  if (error) throw error;
}

// Valor actual de una meta según su tipo, a partir de los datos reales.
export function currentGoalValue(
  goal: Goal,
  latestWeight: number | null,
  prs: { exercise: string; weight: number }[],
): number | null {
  if (goal.metric_type === 'peso_corporal') return latestWeight;
  if (goal.metric_type === 'ejercicio') {
    const pr = prs.find((p) => p.exercise === goal.exercise_name);
    return pr ? pr.weight : goal.start_value;
  }
  return goal.current_value;
}

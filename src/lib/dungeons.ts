import { supabase } from './supabase';
import type { CalendarEvent, Difficulty, Dungeon, DungeonRank, DungeonTask, Stat } from './types';

export async function fetchDungeons(): Promise<Dungeon[]> {
  const { data, error } = await supabase
    .from('dungeons')
    .select('*')
    .order('status', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Dungeon[];
}

export async function fetchDungeon(id: string): Promise<Dungeon> {
  const { data, error } = await supabase.from('dungeons').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Dungeon;
}

export async function createDungeon(
  userId: string,
  input: { title: string; rank: DungeonRank; stat: Stat; description?: string; deadline?: string | null },
): Promise<Dungeon> {
  const { data, error } = await supabase
    .from('dungeons')
    .insert({ user_id: userId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data as Dungeon;
}

export async function updateDungeon(id: string, patch: Partial<Dungeon>): Promise<void> {
  const { error } = await supabase.from('dungeons').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteDungeon(id: string): Promise<void> {
  const { error } = await supabase.from('dungeons').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchTasks(dungeonId: string): Promise<DungeonTask[]> {
  const { data, error } = await supabase
    .from('dungeon_tasks')
    .select('*')
    .eq('dungeon_id', dungeonId)
    .order('position', { ascending: true })
    .order('id', { ascending: true }); // desempate estable si dos comparten position
  if (error) throw error;
  return (data ?? []) as DungeonTask[];
}

export async function fetchPendingTasksWithDue(): Promise<DungeonTask[]> {
  const { data, error } = await supabase
    .from('dungeon_tasks')
    .select('*')
    .eq('done', false)
    .not('due_date', 'is', null)
    .order('due_date', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DungeonTask[];
}

export async function createTask(
  userId: string,
  dungeonId: string,
  input: { title: string; difficulty: Difficulty; is_boss: boolean; due_date?: string | null; position: number },
): Promise<DungeonTask> {
  const { data, error } = await supabase
    .from('dungeon_tasks')
    .insert({ user_id: userId, dungeon_id: dungeonId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data as DungeonTask;
}

export async function setTaskDone(id: string, done: boolean): Promise<void> {
  const { error } = await supabase
    .from('dungeon_tasks')
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('dungeon_tasks').delete().eq('id', id);
  if (error) throw error;
}

export async function countClearedDungeons(): Promise<number> {
  const { count } = await supabase
    .from('dungeons')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'cleared');
  return count ?? 0;
}

// ── Agenda ─────────────────────────────────────────────────────────
export async function fetchCalendarEvents(from: string, to: string): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CalendarEvent[];
}

export async function createCalendarEvent(
  userId: string,
  input: { title: string; date: string; time?: string | null; notes?: string | null },
): Promise<CalendarEvent> {
  const { data, error } = await supabase
    .from('calendar_events')
    .insert({ user_id: userId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data as CalendarEvent;
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  const { error } = await supabase.from('calendar_events').delete().eq('id', id);
  if (error) throw error;
}

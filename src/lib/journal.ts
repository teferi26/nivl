import { supabase } from './supabase';
import type { JournalEntry } from './types';

export async function fetchEntryForDate(date: string): Promise<JournalEntry | null> {
  const { data } = await supabase.from('journal_entries').select('*').eq('date', date).maybeSingle();
  return (data as JournalEntry) ?? null;
}

export async function fetchRecentEntries(limit = 14): Promise<JournalEntry[]> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .order('date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as JournalEntry[];
}

export async function upsertEntry(
  userId: string,
  input: { date: string; mood: number | null; energy: number | null; text: string | null },
): Promise<{ entry: JournalEntry; isNew: boolean }> {
  const existing = await fetchEntryForDate(input.date);
  if (existing) {
    const { data, error } = await supabase
      .from('journal_entries')
      .update({ mood: input.mood, energy: input.energy, text: input.text })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return { entry: data as JournalEntry, isNew: false };
  }
  const { data, error } = await supabase
    .from('journal_entries')
    .insert({ user_id: userId, ...input })
    .select()
    .single();
  if (error) throw error;
  return { entry: data as JournalEntry, isNew: true };
}

export async function countEntries(): Promise<number> {
  const { count } = await supabase
    .from('journal_entries')
    .select('*', { count: 'exact', head: true });
  return count ?? 0;
}

export interface SystemEvent {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export async function fetchEventsForDate(dayStartIso: string, dayEndIso: string): Promise<SystemEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id, type, payload, created_at')
    .gte('created_at', dayStartIso)
    .lt('created_at', dayEndIso)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as SystemEvent[];
}

const PROMPTS = [
  '¿Qué ha sido lo más difícil de hoy y cómo lo has enfrentado?',
  '¿Qué harías distinto si hoy volviera a empezar?',
  '¿Qué te ha dado energía hoy? ¿Qué te la ha quitado?',
  '¿De qué estás orgulloso hoy, por pequeño que sea?',
  '¿Qué versión de ti ha ganado hoy: el cazador o la sombra?',
  '¿Qué has aprendido hoy que tu yo de hace un año no sabía?',
  '¿A quién o qué debes agradecer el día de hoy?',
];

export function promptForDate(dateKey: string): string {
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) | 0;
  }
  return PROMPTS[Math.abs(hash) % PROMPTS.length] ?? PROMPTS[0]!;
}

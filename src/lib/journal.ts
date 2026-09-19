import { limpiarEmociones, limpiarVictorias } from './journalmath';
import { supabase } from './supabase';
import type { JournalEntry } from './types';

/**
 * Una fila tal como la usa la app. Las columnas de la 0023 son `not null
 * default '{}'`, pero una caché vieja o un select parcial pueden traerlas sin
 * definir: aquí se garantiza que los arrays son arrays y las horas un número,
 * para que ninguna pantalla tenga que defenderse.
 */
function normalizar(row: unknown): JournalEntry {
  const r = row as Partial<JournalEntry> & Record<string, unknown>;
  const horas = r.sleep_hours == null ? null : Number(r.sleep_hours);
  return {
    ...(r as JournalEntry),
    emotions: Array.isArray(r.emotions) ? (r.emotions as string[]) : [],
    wins: Array.isArray(r.wins) ? (r.wins as string[]) : [],
    lesson: r.lesson ?? null,
    gratitude: r.gratitude ?? null,
    sleep_hours: horas !== null && Number.isFinite(horas) ? horas : null,
  };
}

export async function fetchEntryForDate(date: string): Promise<JournalEntry | null> {
  const { data } = await supabase.from('journal_entries').select('*').eq('date', date).maybeSingle();
  return data ? normalizar(data) : null;
}

export async function fetchRecentEntries(limit = 14): Promise<JournalEntry[]> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .order('date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(normalizar);
}

/** Las entradas de unas fechas concretas: los "hace un mes / un año" del Archivo,
 *  que quedan fuera de cualquier lista de recientes. Una sola consulta. */
export async function fetchEntriesForDates(dates: string[]): Promise<JournalEntry[]> {
  if (dates.length === 0) return [];
  const { data, error } = await supabase.from('journal_entries').select('*').in('date', dates);
  if (error) throw error;
  return (data ?? []).map(normalizar);
}

export interface EntryInput {
  date: string;
  mood: number | null;
  energy: number | null;
  emotions: string[];
  sleep_hours: number | null;
  wins: string[];
  text: string | null;
  lesson: string | null;
  gratitude: string | null;
  /** Lo primero de mañana. */
  plan: string | null;
}

export async function upsertEntry(
  userId: string,
  input: EntryInput,
): Promise<{ entry: JournalEntry; isNew: boolean }> {
  // Los CHECK de la 0023 (8 emociones, 10 victorias) rechazan la fila entera:
  // se limpia aquí también para que ningún llamador pueda tropezar con ellos.
  const { date, ...resto } = input;
  const campos = {
    ...resto,
    emotions: limpiarEmociones(input.emotions),
    wins: limpiarVictorias(input.wins),
  };
  const existing = await fetchEntryForDate(date);
  if (existing) {
    const { data, error } = await supabase
      .from('journal_entries')
      .update(campos)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return { entry: normalizar(data), isNew: false };
  }
  const { data, error } = await supabase
    .from('journal_entries')
    .insert({ user_id: userId, date, ...campos })
    .select()
    .single();
  if (error) throw error;
  return { entry: normalizar(data), isNew: true };
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
  '¿Qué versión de ti ha ganado hoy: el gladiador o la sombra?',
  '¿Qué has aprendido hoy que tu yo de hace un año no sabía?',
  '¿A quién o qué debes agradecer el día de hoy?',
];

export function promptForDate(key: string): string {
  // El parámetro se llamaba 'dateKey' y ensombrecía la función dateKey importable.
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return PROMPTS[Math.abs(hash) % PROMPTS.length] ?? PROMPTS[0]!;
}

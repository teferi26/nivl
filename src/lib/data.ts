import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';
import type { Completion, Difficulty, Profile, Quest, Stat } from './types';

export async function ensureProfile(userId: string): Promise<Profile> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (data) return data as Profile;
  // upsert en vez de insert: el trigger handle_new_user ya pudo crear la fila,
  // y un insert pelado lanzaba duplicate key (23505) en esa carrera.
  const { data: created, error } = await supabase
    .from('profiles')
    .upsert({ id: userId }, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return created as Profile;
}

export async function updateProfile(userId: string, patch: Partial<Profile>): Promise<void> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}

export async function fetchQuests(): Promise<Quest[]> {
  const { data, error } = await supabase
    .from('quests')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Quest[];
}

export interface QuestInput {
  title: string;
  stat: Stat;
  difficulty: Difficulty;
  days_of_week: number[];
  requires_evidence: boolean;
}

export async function createQuest(userId: string, input: QuestInput): Promise<Quest> {
  const { data, error } = await supabase
    .from('quests')
    .insert({ user_id: userId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data as Quest;
}

export async function setQuestActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('quests').update({ active }).eq('id', id);
  if (error) throw error;
}

export async function deleteQuest(id: string): Promise<void> {
  const { error } = await supabase.from('quests').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchCompletionsSince(fromDate: string): Promise<Completion[]> {
  const { data, error } = await supabase
    .from('completions')
    .select('*')
    .gte('date', fromDate);
  if (error) throw error;
  return (data ?? []) as Completion[];
}

export async function fetchCompletionsForDate(date: string): Promise<Completion[]> {
  const { data, error } = await supabase.from('completions').select('*').eq('date', date);
  if (error) throw error;
  return (data ?? []) as Completion[];
}

export async function completionStats(): Promise<{ total: number; withEvidence: number }> {
  const { count: total } = await supabase
    .from('completions')
    .select('*', { count: 'exact', head: true });
  const { count: withEvidence } = await supabase
    .from('completions')
    .select('*', { count: 'exact', head: true })
    .not('evidence_url', 'is', null);
  return { total: total ?? 0, withEvidence: withEvidence ?? 0 };
}

export async function insertEvent(
  userId: string,
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await supabase.from('events').insert({ user_id: userId, type, payload });
}

export async function uploadEvidence(
  userId: string,
  questId: string,
  date: string,
  base64: string,
): Promise<string> {
  const path = `${userId}/${date}_${questId}_${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from('evidence')
    .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return path;
}

export async function uploadAvatar(userId: string, base64: string): Promise<string> {
  const path = `${userId}/avatar_${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return path;
}

export async function signedUrl(bucket: 'evidence' | 'avatars', path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
  return data?.signedUrl ?? null;
}

const DEFAULT_QUESTS: QuestInput[] = [
  { title: 'Gimnasio', stat: 'FUE', difficulty: 'media', days_of_week: [1, 2, 3, 4, 5], requires_evidence: false },
  { title: 'Estudiar 2 h', stat: 'INT', difficulty: 'media', days_of_week: [1, 2, 3, 4, 5], requires_evidence: false },
  { title: 'Registrar comidas del día', stat: 'VIT', difficulty: 'facil', days_of_week: [1, 2, 3, 4, 5, 6, 7], requires_evidence: false },
  { title: 'Leer 20 minutos', stat: 'INT', difficulty: 'facil', days_of_week: [1, 2, 3, 4, 5, 6, 7], requires_evidence: false },
  { title: 'Diario del cazador', stat: 'PER', difficulty: 'facil', days_of_week: [1, 2, 3, 4, 5, 6, 7], requires_evidence: false },
];

export async function seedDefaultQuests(userId: string): Promise<boolean> {
  const { count } = await supabase.from('quests').select('*', { count: 'exact', head: true });
  if ((count ?? 0) > 0) return false;
  const { error } = await supabase
    .from('quests')
    .insert(DEFAULT_QUESTS.map((q) => ({ user_id: userId, ...q })));
  if (error) throw error;
  return true;
}

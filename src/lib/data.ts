import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';
import type { Completion, Difficulty, Profile, Quest, Stat } from './types';

export async function ensureProfile(userId: string): Promise<Profile> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (data) return data as Profile;
  // ON CONFLICT DO NOTHING (ignoreDuplicates): el trigger handle_new_user ya
  // pudo crear la fila en esta misma carrera. Un insert pelado lanzaba
  // duplicate key (23505); un upsert normal intentaría UPDATE de la columna
  // id, y desde la 0009 el UPDATE de tabla está revocado. Sin tocar ninguna
  // columna, basta con permiso de INSERT.
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw error;
  const { data: created, error: readErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (readErr) throw readErr;
  return created as Profile;
}

// Solo campos "de perfil": nombre, avatar, título, congelación y horarios.
// Las columnas de economía (xp_*, streak_days, protection_stones,
// bonus_points, last_day_processed) tienen el UPDATE revocado desde la
// migración 0009 y solo se mueven por las RPC de más abajo.
export async function updateProfile(userId: string, patch: Partial<Profile>): Promise<void> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}

// ── Economía atómica (0009) ─────────────────────────────────────────
// Cada una aplica DELTAS en una transacción y devuelve el perfil ya fresco:
// se acabó el read-modify-write que hacía que dos acciones seguidas se
// pisaran el XP.

export async function awardXpRpc(
  amount: number,
  stat: Stat | null,
  eventType: string | null,
  payload: Record<string, unknown> = {},
): Promise<Profile> {
  const { data, error } = await supabase.rpc('award_xp', {
    p_amount: amount,
    p_stat: stat,
    p_event: eventType,
    p_payload: payload,
  });
  if (error) throw error;
  return data as Profile;
}

// Devuelve awarded=false si la misión ya estaba completada hoy: el doble
// toque no otorga dos veces porque la completion y el XP viajan juntos.
export async function completeQuestRpc(args: {
  questId: string;
  date: string;
  xp: number;
  bonus?: number;
  applyStat?: boolean;
  evidenceUrl?: string | null;
}): Promise<{ awarded: boolean; profile: Profile }> {
  const { data, error } = await supabase.rpc('complete_quest', {
    p_quest_id: args.questId,
    p_date: args.date,
    p_xp: args.xp,
    p_bonus: args.bonus ?? 0,
    p_apply_stat: args.applyStat ?? true,
    p_evidence_url: args.evidenceUrl ?? null,
  });
  if (error) throw error;
  const row = data as { awarded: boolean; profile: Profile };
  return { awarded: row.awarded, profile: row.profile };
}

// Un parámetro nulo significa "no lo toques": sirve tanto para el primer
// arranque (solo fija last_day_processed) como para un cierre completo.
export async function applyDayCloseRpc(args: {
  lastDay?: string | null;
  streak?: number | null;
  stones?: number | null;
  penaltyXp?: number;
  clearFreeze?: boolean;
}): Promise<Profile> {
  const { data, error } = await supabase.rpc('apply_day_close', {
    p_last_day: args.lastDay ?? null,
    p_streak: args.streak ?? null,
    p_stones: args.stones ?? null,
    p_penalty_xp: args.penaltyXp ?? 0,
    p_clear_freeze: args.clearFreeze ?? false,
  });
  if (error) throw error;
  return data as Profile;
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
  is_bonus?: boolean;
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

export async function updateQuest(id: string, patch: Partial<QuestInput>): Promise<void> {
  const { error } = await supabase.from('quests').update(patch).eq('id', id);
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
  // Propaga el error en vez de degradar a 0: un fallo de red devolvía {0,0}
  // indistinguible de "sin actividad" y enmudecía la evaluación de logros.
  const { count: total, error: e1 } = await supabase
    .from('completions')
    .select('*', { count: 'exact', head: true });
  if (e1) throw e1;
  const { count: withEvidence, error: e2 } = await supabase
    .from('completions')
    .select('*', { count: 'exact', head: true })
    .not('evidence_url', 'is', null);
  if (e2) throw e2;
  return { total: total ?? 0, withEvidence: withEvidence ?? 0 };
}

export async function insertEvent(
  userId: string,
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  // Los eventos son la fuente de verdad de la crónica y del conteo de PRs;
  // tragarse un fallo aquí dejaba logros sin desbloquear sin aviso.
  const { error } = await supabase.from('events').insert({ user_id: userId, type, payload });
  if (error) throw error;
}

// Sin Date.now() en la ruta. Con marca de tiempo, cada reintento o cada foto
// repetida creaba un objeto nuevo que no borraba nadie: el bucket crecía sin
// tope hasta comerse el giga gratuito. La ruta es determinista (una evidencia
// por misión y día), así que repetir sobrescribe.
export async function uploadEvidence(
  userId: string,
  questId: string,
  date: string,
  base64: string,
): Promise<string> {
  const path = `${userId}/${date}_${questId}.jpg`;
  const { error } = await supabase.storage
    .from('evidence')
    .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return path;
}

// Un cazador, un retrato: la ruta fija hace que cambiar de foto sustituya la
// anterior en vez de acumularlas.
export async function uploadAvatar(userId: string, base64: string): Promise<string> {
  const path = `${userId}/avatar.jpg`;
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

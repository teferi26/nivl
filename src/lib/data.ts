import { requireHealthConsent } from './health';
import { decode } from 'base64-arraybuffer';
import { kindMeta, type StarterQuest } from './kinds';
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
  perfectStreak?: number | null;
  stones?: number | null;
  penaltyXp?: number;
  clearFreeze?: boolean;
}): Promise<Profile> {
  const { data, error } = await supabase.rpc('apply_day_close_safe', {
    p_last_day: args.lastDay ?? null,
    p_streak: args.streak ?? null,
    p_perfect_streak: args.perfectStreak ?? null,
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
  health_data?: boolean;
  active?: boolean;
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
  const { data, error } = await supabase.rpc('my_completions', { p_from: fromDate });
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('No se pudieron comprobar las misiones completadas.');
  return data as Completion[];
}

export async function fetchCompletionsForDate(date: string): Promise<Completion[]> {
  const { data, error } = await supabase.rpc('my_completions', { p_from: date, p_until: date });
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('No se pudieron comprobar las misiones completadas.');
  return data as Completion[];
}

export async function completionStats(): Promise<{ total: number; withEvidence: number }> {
  // Propaga el error en vez de degradar a 0: un fallo de red devolvía {0,0}
  // indistinguible de "sin actividad" y enmudecía la evaluación de logros.
  const { data, error } = await supabase.rpc('my_completion_stats');
  if (error) throw error;
  if (typeof data?.total !== 'number' || typeof data?.with_evidence !== 'number') throw new Error('No se pudieron comprobar tus logros.');
  return { total: data.total, withEvidence: data.with_evidence };
}

export async function insertEvent(
  userId: string,
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  // Los eventos son la fuente de verdad de la crónica y del conteo de PRs;
  // tragarse un fallo aquí dejaba logros sin desbloquear sin aviso.
  const { error } = await supabase.from('events').insert({ user_id: userId, type, payload,
    ...(payload.health_data === true ? { health_data: true } : {}),
  });
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
  await requireHealthConsent();
  const path = `${userId}/${date}_${questId}.jpg`;
  const { error } = await supabase.storage
    .from('evidence')
    .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return path;
}

// Each upload gets a new object: a previously approved/signed avatar must
// never start serving different, unreviewed bytes.
export async function uploadAvatar(userId: string, base64: string): Promise<string> {
  const path = `${userId}/avatar-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

/** Retire a replaced/failed upload using Storage's API, never SQL metadata deletion. */
export async function removeAvatar(userId: string, path: string): Promise<void> {
  if (!path.startsWith(`${userId}/`) || path.split('/').some(part => part === '..' || part === '.')) {
    throw new Error('Invalid avatar ownership');
  }
  const { error } = await supabase.storage.from('avatars').remove([path]);
  if (error) throw error;
  olvidarFirma('avatars', path);
}

export async function signedUrl(bucket: 'evidence' | 'avatars', path: string): Promise<string | null> {
  if (bucket === 'evidence') await requireHealthConsent();
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
  return data?.signedUrl ?? null;
}

/**
 * La misma firma, pero recordada mientras dure la sesión.
 *
 * Sin esto, cada vez que la pantalla recuperaba el foco se pedía una firma
 * NUEVA para el mismo fichero. La URL cambiaba, así que para el componente de
 * imagen era otra imagen: la descargaba otra vez y volvía a hacer su fundido.
 * Efecto visible: entras en Perfil y tu cara aparece con retraso cada vez,
 * aunque no hayas tocado la foto.
 *
 * Las firmas caducan en un minuto; se revalidan para respetar bloqueos y
 * cambios de moderación. La caché deja margen antes de la caducidad real.
 */
const firmas = new Map<string, { url: string; expiresAt: number }>();
export function clearEvidenceSignatures(): void {
  for (const key of firmas.keys()) if (key.startsWith('evidence/')) firmas.delete(key);
}

export async function signedUrlCached(
  bucket: 'evidence' | 'avatars',
  path: string,
): Promise<string | null> {
  if (bucket === 'evidence') return signedUrl(bucket, path);
  const clave = `${bucket}/${path}`;
  const guardada = firmas.get(clave);
  if (guardada && guardada.expiresAt > Date.now()) return guardada.url;
  firmas.delete(clave);
  const url = await signedUrl(bucket, path);
  if (url) firmas.set(clave, { url, expiresAt: Date.now() + 50_000 });
  return url;
}

/** Al cambiar de foto hay que olvidar la firma vieja o se vería la anterior. */
export function olvidarFirma(bucket: 'evidence' | 'avatars', path: string): void {
  firmas.delete(`${bucket}/${path}`);
}

/**
 * Los primeros hábitos de una cuenta salen del perfil de uso (kinds.ts): un
 * deportista no empieza con "Prospección: 10 contactos". El onboarding deja
 * elegir cuáles crear, incluido ninguno.
 *
 * OJO: ninguna pantalla debe llamar a esto al cargar. Hoy lo hacía en cada
 * foco y pisaba la decisión del usuario: quien elegía "Empezar sin misiones"
 * o borraba las suyas se encontraba las de fábrica otra vez. Una cuenta sin
 * misiones ve el estado vacío, que ya le lleva a Hábitos. Queda como
 * utilidad explícita (un futuro "proponme misiones"), nunca automática.
 */
export async function seedDefaultQuests(userId: string, kind: unknown = 'general'): Promise<boolean> {
  const { count } = await supabase.from('quests').select('*', { count: 'exact', head: true });
  if ((count ?? 0) > 0) return false;
  await createStarterQuests(userId, kindMeta(kind).starterQuests);
  return true;
}

/**
 * Crea de golpe los hábitos elegidos en el onboarding y devuelve lo creado
 * (id y título), para que el onboarding pueda reconciliar si el usuario vuelve
 * atrás y cambia la selección. Con lista vacía no toca nada.
 */
export async function createStarterQuests(
  userId: string,
  quests: readonly StarterQuest[],
): Promise<{ id: string; title: string }[]> {
  if (quests.length === 0) return [];
  const { data, error } = await supabase
    .from('quests')
    // Todas las filas con las mismas claves: supabase-js manda NULL en las que
    // faltan y health_data es NOT NULL (fallo del onboarding, 04/10/2026).
    .insert(quests.map((q) => ({ user_id: userId, ...q, health_data: q.health_data === true })))
    .select('id, title');
  if (error) throw error;
  return (data ?? []) as { id: string; title: string }[];
}

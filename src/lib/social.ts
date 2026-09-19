// La capa social (efectos): amigos, solicitudes y el marcador. La lógica pura
// —ordenar, etiquetar, la línea de rivalidad— vive en socialmath.ts.
//
// Todo pasa por las RPC de la 0021. No hay ni un select sobre el perfil o las
// misiones de otra persona: la RLS no lo permite y así debe seguir. De un amigo
// solo existe lo que friends_board decide devolver.

import type { ProfileKind } from './kinds';
import type { Competidor } from './socialmath';
import { supabase } from './supabase';
import { ErrorVisible } from './validation';

/** Una fila del marcador: yo o un amigo aceptado. */
export interface BoardEntry extends Competidor {
  /** null en mi propia fila. Hace falta para poder quitar al amigo. */
  friendshipId: string | null;
  /** false = se ha ocultado de los rankings: llega sin cifras ni retrato. */
  visible: boolean;
  avatarPath: string | null;
  equippedTitle: string | null;
  profileKind: ProfileKind | null;
  daysActive: number;
  scheduled: number;
  windowDays: number;
}

interface BoardRow {
  user_id: string;
  friendship_id: string | null;
  is_me: boolean;
  visible: boolean;
  name: string | null;
  avatar_url: string | null;
  xp_total: number | null;
  streak_days: number | null;
  equipped_title: string | null;
  profile_kind: ProfileKind | null;
  xp_window: number | null;
  days_active: number | null;
  scheduled: number | null;
  completed: number | null;
  compliance_pct: number | null;
  window_days: number;
}

export async function fetchBoard(days: number): Promise<BoardEntry[]> {
  const { data, error } = await supabase.rpc('friends_board', { p_days: days });
  if (error) throw error;
  return ((data ?? []) as BoardRow[]).map((r) => ({
    userId: r.user_id,
    friendshipId: r.friendship_id,
    isMe: r.is_me,
    visible: r.visible,
    name: r.name?.trim() || 'Gladiador',
    avatarPath: r.avatar_url,
    xpTotal: r.xp_total ?? 0,
    streakDays: r.streak_days ?? 0,
    equippedTitle: r.equipped_title,
    profileKind: r.profile_kind,
    xpWindow: r.xp_window ?? 0,
    daysActive: r.days_active ?? 0,
    scheduled: r.scheduled ?? 0,
    completed: r.completed ?? 0,
    compliancePct: r.compliance_pct,
    windowDays: r.window_days,
  }));
}

export interface FriendRequest {
  friendshipId: string;
  direction: 'incoming' | 'outgoing';
  name: string;
  level: number;
  createdAt: string;
}

export async function fetchRequests(): Promise<FriendRequest[]> {
  const { data, error } = await supabase.rpc('friend_requests');
  if (error) throw error;
  type Row = { friendship_id: string; direction: 'incoming' | 'outgoing'; name: string | null; level: number; created_at: string };
  return ((data ?? []) as Row[]).map((r) => ({
    friendshipId: r.friendship_id,
    direction: r.direction,
    name: r.name?.trim() || 'Gladiador',
    level: r.level,
    createdAt: r.created_at,
  }));
}

export interface RequestResult {
  /** 'accepted' cuando la otra persona ya me lo había pedido: pedir es aceptar. */
  status: 'pending' | 'accepted';
  name: string;
  message: string;
}

/**
 * Pide amistad por código. Los errores de negocio (código desconocido, ya
 * amigos, topes, freno de intentos) NO llegan como excepción de Postgres sino
 * como {ok:false, message}: la RPC no lanza para que el intento quede contado.
 * Aquí se convierten en ErrorVisible con el mensaje en español, listo para enseñar.
 */
export async function requestFriend(code: string): Promise<RequestResult> {
  const { data, error } = await supabase.rpc('friend_request', { p_code: code });
  if (error) throw error;
  const r = data as { ok: boolean; status?: 'pending' | 'accepted'; name?: string; message?: string } | null;
  if (!r || !r.ok) throw new ErrorVisible(r?.message ?? 'El sistema no ha podido enviar la solicitud.');
  return { status: r.status ?? 'pending', name: r.name?.trim() || 'Gladiador', message: r.message ?? '' };
}

export async function respondRequest(friendshipId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('friend_respond', { p_friendship: friendshipId, p_accept: accept });
  if (error) throw error;
}

/** Quita a un amigo o retira una solicitud propia: para el servidor es lo mismo. */
export async function removeFriend(friendshipId: string): Promise<void> {
  const { error } = await supabase.rpc('friend_remove', { p_friendship: friendshipId });
  if (error) throw error;
}

export interface SocialSelf {
  friendCode: string;
  socialVisible: boolean;
}

/** Mi código y si salgo en los rankings. Es mi propia fila: aquí sí vale un select. */
export async function fetchSocialSelf(userId: string): Promise<SocialSelf> {
  const { data, error } = await supabase
    .from('profiles')
    .select('friend_code, social_visible')
    .eq('id', userId)
    .single();
  if (error) throw error;
  const row = data as { friend_code: string; social_visible: boolean };
  return { friendCode: row.friend_code, socialVisible: row.social_visible };
}

// social_visible es de las pocas columnas de profiles con UPDATE concedido
// (0021). friend_code no: el código lo pone el servidor y no se cambia.
export async function setSocialVisible(userId: string, visible: boolean): Promise<void> {
  const { error } = await supabase.from('profiles').update({ social_visible: visible }).eq('id', userId);
  if (error) throw error;
}

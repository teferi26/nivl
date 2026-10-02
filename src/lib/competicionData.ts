// NIVL · Competición entre amigos: efectos (RPC de la 0048). La lógica pura
// y las fórmulas están en competition.ts; aquí solo se llama al servidor, que
// es quien calcula (las fórmulas tienen su espejo SQL).
//
// Errores: los límites de negocio (22023: liga llena, 3 ligas al día, duelo
// ya existente, rechazo reciente…) traen un texto escrito para el usuario y
// pasan como ErrorVisible. Lo demás (42501, red) se queda como error normal
// para que la pantalla use mensajeSistema(e): nunca se filtra un detalle.

import { supabase } from './supabase';
import { ErrorVisible } from './validation';

type RpcError = { code?: string; message?: string } | null;

function lanzar(error: RpcError): never {
  if (error?.code === '22023' && error.message) throw new ErrorVisible(error.message);
  throw error ?? new Error('Sin respuesta');
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) lanzar(error);
  return data as T;
}

/** ¿Está la 0048 en el servidor? Para ocultar la competición si aún no. */
export function esFaltaDeServidor(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code;
  return code === 'PGRST202' || code === '42883' || code === '42P01';
}

// ── Ligas ──────────────────────────────────────────────────────────────

export interface FilaTablero {
  es_yo: boolean;
  alias: string;
  retrato: string | null;
  indice: number;
  velocidad: number;
  dias_activos: number;
  sin_datos: boolean;
}

export interface MiPosicion {
  league_id: string;
  nombre: string;
  /** 0 = sin datos suficientes esta semana (no se enseña como «último»). */
  puesto: number;
  miembros: number;
  indice: number | null;
  velocidad: number | null;
}

export interface InvitacionLiga {
  league_id: string;
  nombre: string;
  de: string;
  caduca: string;
}

export const crearLiga = (nombre: string) => rpc<string>('league_create', { p_name: nombre });
export const invitarALiga = (liga: string, amigo: string) =>
  rpc<void>('league_invite', { p_league: liga, p_friend: amigo });
export const aceptarLiga = (liga: string) => rpc<void>('league_accept', { p_league: liga });
export const rechazarLiga = (liga: string) => rpc<void>('league_decline', { p_league: liga });
export const salirDeLiga = (liga: string) => rpc<void>('league_leave', { p_league: liga });
export const tableroDeLiga = async (liga: string) =>
  ((await rpc<FilaTablero[] | null>('league_board', { p_league: liga })) ?? []).map((f) => ({
    ...f, velocidad: Number(f.velocidad),
  }));
export const misLigas = async () =>
  ((await rpc<MiPosicion[] | null>('my_league_standing')) ?? []).map((f) => ({
    ...f, velocidad: f.velocidad === null ? null : Number(f.velocidad),
  }));
export const misInvitacionesDeLiga = async () => (await rpc<InvitacionLiga[] | null>('my_league_invites')) ?? [];

// ── Duelos ─────────────────────────────────────────────────────────────

export interface Duelo {
  id: string;
  soy_retador: boolean;
  /** null si hay bloqueo o suspensión entre los dos (el duelo queda anulado). */
  rival: string | null;
  week_start: string;
  status: 'pending' | 'accepted' | 'declined' | 'done' | 'cancelled';
  mi_indice: number;
  su_indice: number;
  mis_dias: number;
  sus_dias: number;
  /** Solo al pasar la semana: 'gano' | 'pierdo' | 'empate' | 'sin_datos'. */
  resultado: 'gano' | 'pierdo' | 'empate' | 'sin_datos' | null;
}

export const retarADuelo = (amigo: string) => rpc<string>('duel_challenge', { p_opponent: amigo });
export const responderDuelo = (duelo: string, aceptar: boolean) =>
  rpc<void>('duel_respond', { p_duel: duelo, p_accept: aceptar });
export const misDuelos = async () => (await rpc<Duelo[] | null>('my_duels')) ?? [];

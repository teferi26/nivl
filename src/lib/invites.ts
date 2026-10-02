// Invitaciones (0045): quien invita comparte su código de amigo; el invitado lo
// reclama en sus primeros 7 días. La recompensa es SOLO cosmética (insignias
// por invitados activos): ni XP ni días de Pro (Apple 3.1.1, FASE2-PLAN D3).
//
// Todo pasa por las RPC de la 0045; las tablas están cerradas al cliente. De los
// invitados solo llegan cifras: nunca ids ni nombres.
//
// `mensajeInvite` y `siguienteUmbral` son puros (sin red); el resto son efectos.

import { supabase } from './supabase';

/** Por qué el servidor rechaza una reclamación (claim_invite). */
export type InviteReason =
  | 'sin_sesion'
  | 'limite'
  | 'formato'
  | 'desconocido'
  | 'propio'
  | 'fuera_de_plazo'
  | 'ya_invitado'
  | 'reciproca'
  | 'tope'
  | 'borrado_pendiente'
  | 'otro';

const REASONS: readonly InviteReason[] = [
  'sin_sesion',
  'limite',
  'formato',
  'desconocido',
  'propio',
  'fuera_de_plazo',
  'ya_invitado',
  'reciproca',
  'tope',
  'borrado_pendiente',
];

/** Insignias por invitados activos (nombres de Chat 5, progression.ts). */
export type InsigniaInvitacion = 'reclutador' | 'lanista' | 'senor_del_ludus';

export const UMBRALES_INVITACION: readonly { umbral: number; kind: InsigniaInvitacion }[] = [
  { umbral: 1, kind: 'reclutador' },
  { umbral: 3, kind: 'lanista' },
  { umbral: 10, kind: 'senor_del_ludus' },
];

const KINDS = new Set<string>(UMBRALES_INVITACION.map((u) => u.kind));

export type ClaimInviteResult = { ok: true } | { ok: false; reason: InviteReason };

export interface SettleResult {
  activos: number;
  pendientes: number;
  /** Insignias que se acaban de ganar en esta liquidación (para celebrarlas una vez). */
  nuevasInsignias: InsigniaInvitacion[];
}

export interface MyInvites {
  activos: number;
  pendientes: number;
  caducadas: number;
  /** Activaciones que superaron el tope antifraude: no cuentan para insignias. */
  tope: number;
  insignias: InsigniaInvitacion[];
  /** Invitados activos para la siguiente insignia; null si ya están todas. */
  siguienteUmbral: number | null;
  /** Esta cuenta ya entró por invitación (no se puede reclamar otra). */
  invitado: boolean;
}

// ── Puros ────────────────────────────────────────────────────────────

/** El código de amigo: 8 caracteres del alfabeto de 0021; admite espacios, guiones y minúsculas. */
export function normalizarCodigo(code: string): string | null {
  const c = (code ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(c) ? c : null;
}

/** La siguiente meta de invitados activos, o null si ya se tienen todas las insignias. */
export function siguienteUmbral(activas: number): number | null {
  const n = Number.isFinite(activas) ? Math.max(0, Math.floor(activas)) : 0;
  return UMBRALES_INVITACION.find((u) => u.umbral > n)?.umbral ?? null;
}

/** Voz del sistema: frases cortas, sin exclamaciones. */
export function mensajeInvite(reason: InviteReason | string | null | undefined): string {
  switch (reason) {
    case 'sin_sesion':
      return 'Entra en tu cuenta para usar el código.';
    case 'limite':
      return 'Demasiados intentos. El sistema vuelve a escucharte dentro de una hora.';
    case 'formato':
      return 'Ese código no es válido. Son 8 caracteres.';
    case 'desconocido':
      return 'Ningún gladiador responde a ese código.';
    case 'propio':
      return 'Ese código es el tuyo. Quien te trae tiene que ser otro.';
    case 'fuera_de_plazo':
      return 'El código de invitación solo vale en los primeros 7 días de cuenta.';
    case 'ya_invitado':
      return 'Tu cuenta ya entró con una invitación.';
    case 'reciproca':
      return 'Ese gladiador entró con tu código. La invitación no vuelve.';
    case 'tope':
      return 'Ese código no admite más reclutas hoy. Prueba mañana.';
    case 'borrado_pendiente':
      return 'Tu cuenta se está borrando. No admite invitaciones.';
    default:
      return 'El sistema no ha podido registrar la invitación.';
  }
}

// ── Parseo defensivo ─────────────────────────────────────────────────

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function insignias(v: unknown): InsigniaInvitacion[] {
  if (!Array.isArray(v)) return [];
  const vistas = new Set<string>();
  for (const k of v) if (typeof k === 'string' && KINDS.has(k)) vistas.add(k);
  return UMBRALES_INVITACION.map((u) => u.kind).filter((k) => vistas.has(k));
}

function reason(v: unknown): InviteReason {
  return typeof v === 'string' && (REASONS as readonly string[]).includes(v) ? (v as InviteReason) : 'otro';
}

// ── Efectos ──────────────────────────────────────────────────────────

/** El invitado reclama el código de quien le invita. Lanza solo si falla la red. */
export async function claimInvite(code: string): Promise<ClaimInviteResult> {
  const c = normalizarCodigo(code);
  if (!c) return { ok: false, reason: 'formato' };
  const { data, error } = await supabase.rpc('claim_invite', { p_code: c });
  if (error) throw error;
  const r = (data && typeof data === 'object' ? data : null) as { ok?: unknown; reason?: unknown } | null;
  if (r?.ok === true) return { ok: true };
  return { ok: false, reason: reason(r?.reason) };
}

/** Quien invita liquida sus invitaciones (idempotente). */
export async function settleMyInvites(): Promise<SettleResult> {
  const { data, error } = await supabase.rpc('settle_my_invites');
  if (error) throw error;
  const r = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  if (r.ok !== true) return { activos: 0, pendientes: 0, nuevasInsignias: [] };
  return {
    activos: num(r.activos ?? r.activas),
    pendientes: num(r.pendientes),
    nuevasInsignias: insignias(r.nuevas_insignias),
  };
}

/** Mis contadores e insignias. Sin sesión, todo a cero. */
export async function fetchMyInvites(): Promise<MyInvites> {
  const { data, error } = await supabase.rpc('my_invites');
  if (error) throw error;
  const r = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const activos = num(r.activos);
  return {
    activos,
    pendientes: num(r.pendientes),
    caducadas: num(r.caducadas),
    tope: num(r.tope),
    insignias: insignias(r.insignias),
    // Misma tabla que el servidor (1/3/10); se deriva de `activos` para que nunca se contradigan.
    siguienteUmbral: siguienteUmbral(activos),
    invitado: r.invitado === true,
  };
}

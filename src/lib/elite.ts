// NIVL · Élite: la insignia y el ludus, en lógica PURA (sin red ni Supabase).
//
// Un ludus es la escuela de gladiadores: un grupo de 5 a 8 Élite con el mismo
// objetivo que se miden entre ellos. En la base de datos se llama
// `elite_groups` (0026); en la interfaz, SIEMPRE "ludus".
//
// Regla dura (docs/PLAN_NIVELES_Y_CREADORES.md §5): la insignia y el ludus son
// estatus y estética. Cero XP, nada de rachas ni piedras, y el orden de ningún
// ranking cambia por llevar insignia. Por eso aquí no hay ni un número del
// juego: solo quién puede, qué se enseña y cómo se dice.

import { kindMeta, PROFILE_KINDS, type ProfileKind } from './kinds';
import type { Tier } from './proplans';

/** Plazas de un ludus: la migración 0026 fija el CHECK `capacity between 5 and 8`. */
export const LUDUS_MIN = 5;
export const LUDUS_MAX = 8;
/** Largo máximo de la nota al pedir plaza (`elite_group_requests.note`). */
export const NOTA_LUDUS_MAX = 280;

/** Los objetivos de un ludus son los perfiles de uso (mismo CHECK en la 0026). */
export const OBJETIVOS_LUDUS: readonly ProfileKind[] = PROFILE_KINDS;

/** Quién puede pedir plaza y ver su ludus. El servidor lo revalida con user_tier. */
export function puedeLudus(tier: Tier | null | undefined): boolean {
  return tier === 'elite' || tier === 'owner';
}

/** Lo que devuelve `my_elite_group()` ya tipado. */
export interface MiLudus {
  /** Élite (o dueño) según el servidor. */
  eligible: boolean;
  group: { name: string; goal: ProfileKind; capacity: number; members: number } | null;
  requested: boolean;
  requestedGoal: ProfileKind | null;
}

export const SIN_LUDUS: MiLudus = { eligible: false, group: null, requested: false, requestedGoal: null };

export type EstadoLudus = 'fuera' | 'miembro' | 'pedido' | 'libre';

/**
 * En qué punto está la cuenta:
 *  · fuera   — no es Élite: la sección no se pinta (sin paywall dentro de Amigos);
 *  · miembro — tiene ludus: se pinta su marcador;
 *  · pedido  — pidió plaza y espera;
 *  · libre   — Élite sin ludus ni petición: se ofrece pedir plaza.
 */
export function estadoLudus(tier: Tier | null | undefined, mio: MiLudus | null | undefined): EstadoLudus {
  if (!puedeLudus(tier) || !mio?.eligible) return 'fuera';
  if (mio.group) return 'miembro';
  if (mio.requested) return 'pedido';
  return 'libre';
}

/** Convierte lo que llega del servidor en un `MiLudus`, sin fiarse de las formas. */
export function parseMiLudus(raw: unknown): MiLudus {
  if (!raw || typeof raw !== 'object') return SIN_LUDUS;
  const r = raw as Record<string, unknown>;
  const g = r.group && typeof r.group === 'object' ? (r.group as Record<string, unknown>) : null;
  const objetivo = (v: unknown): ProfileKind | null =>
    typeof v === 'string' && (PROFILE_KINDS as readonly string[]).includes(v) ? (v as ProfileKind) : null;
  const capacity = Math.min(LUDUS_MAX, Math.max(LUDUS_MIN, Math.round(Number(g?.capacity ?? LUDUS_MAX)) || LUDUS_MAX));
  return {
    eligible: r.eligible === true,
    group: g
      ? {
          name: typeof g.name === 'string' && g.name.trim() ? g.name.trim().slice(0, 40) : 'Tu ludus',
          goal: objetivo(g.goal) ?? 'general',
          capacity,
          members: Math.max(0, Math.round(Number(g.members ?? 0)) || 0),
        }
      : null,
    requested: r.requested === true,
    requestedGoal: objetivo(r.requested_goal),
  };
}

/** La nota tal y como se envía: sin espacios sobrantes y dentro del tope. */
export function normalizarNota(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim().slice(0, NOTA_LUDUS_MAX);
}

/** "Deportista · 6 de 8 gladiadores". */
export function lineaLudus(group: NonNullable<MiLudus['group']>): string {
  const objetivo = kindMeta(group.goal).label;
  const n = group.members;
  return `${objetivo} · ${n} de ${group.capacity} ${n === 1 ? 'gladiador' : 'gladiadores'}`;
}

/** Los "no" de `elite_request_group`, en la voz del sistema. */
export type MotivoLudus = 'no_elite' | 'objetivo_invalido' | 'ya_en_ludus';

export function mensajeLudus(reason: string | null | undefined): string {
  switch (reason) {
    case 'no_elite':
      return 'El ludus es para gladiadores Élite.';
    case 'objetivo_invalido':
      return 'Elige un objetivo para tu ludus.';
    case 'ya_en_ludus':
      return 'Ya tienes ludus. Uno por gladiador.';
    default:
      return 'El sistema no ha podido registrar tu petición.';
  }
}

/** Texto de accesibilidad de la insignia. */
export const INSIGNIA_ELITE_LABEL = 'Gladiador Élite';

/** ¿Lleva insignia? */
export function llevaInsignia(insignias: ReadonlySet<string>, userId: string): boolean {
  return insignias.has(userId);
}

/**
 * Pone la insignia a un ranking YA ordenado. Es un adorno que se aplica
 * después de `clasificar`: mismo orden, mismas posiciones, mismos valores.
 * Nunca se ordena por ella (test "la insignia no mueve el ranking").
 */
export function conInsignias<T extends { competidor: { userId: string } }>(
  ranking: readonly T[],
  insignias: ReadonlySet<string>,
): (T & { insignia: boolean })[] {
  return ranking.map((x) => ({ ...x, insignia: insignias.has(x.competidor.userId) }));
}

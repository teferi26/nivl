// NIVL · Modos (fase 1): los tipos y las reglas puras, con test.
//
// Contrato común (coordinacion-winter-arc/MODOS-F1-CONTRATO.md):
//   · `ModoId = 'general' | 'iron' | 'focus' | 'work' | 'founder'`;
//   · una misión es UNA fila de `quests` con etiquetas en `quests.modes`
//     (solo iron, focus, work y founder: General no se etiqueta, lo ve todo);
//   · se marca una vez y cuenta en General y en cada uno de sus modos (la XP
//     por modo la suma el servidor en `mode_xp`).
//
// Sin imports de Supabase ni de React Native: lo usan los tests.

import type { ProfileKind } from '@/lib/kinds';

export type ModoId = 'general' | 'iron' | 'focus' | 'work' | 'founder';
/** Los modos que se pueden activar y poner como etiqueta (General siempre está). */
export type ModoEtiqueta = Exclude<ModoId, 'general'>;

/** En el orden en que se enseñan. */
export const MODOS: readonly ModoId[] = ['general', 'iron', 'focus', 'work', 'founder'];
export const MODOS_ETIQUETA: readonly ModoEtiqueta[] = ['iron', 'focus', 'work', 'founder'];

/**
 * El nombre de cada modo en la app. Son marca (spec §1: nombres cortos en
 * inglés que valen en todos los idiomas), así que no pasan por el catálogo.
 */
export const NOMBRE_MODO: Record<ModoId, string> = {
  general: 'NIVL', // i18n-ok: marca
  iron: 'IRON', // i18n-ok: marca
  focus: 'FOCUS', // i18n-ok: marca
  work: 'WORK', // i18n-ok: marca
  founder: 'FOUNDER', // i18n-ok: marca
};

export function esModo(v: unknown): v is ModoId {
  return typeof v === 'string' && (MODOS as readonly string[]).includes(v);
}

export function esModoEtiqueta(v: unknown): v is ModoEtiqueta {
  return typeof v === 'string' && (MODOS_ETIQUETA as readonly string[]).includes(v);
}

/**
 * Las etiquetas de modo de una misión, limpias: solo valores válidos, sin
 * repetir y en el orden de MODOS_ETIQUETA. Sin la columna (servidor viejo) o
 * con basura, ninguna.
 */
export function modosDeMision(q: { modes?: readonly unknown[] | null }): ModoEtiqueta[] {
  const crudo = Array.isArray(q.modes) ? q.modes : [];
  return MODOS_ETIQUETA.filter((m) => crudo.includes(m));
}

/**
 * ¿Se ve la misión en este modo? General lo ve todo. Las penalizaciones se
 * ven en todos los modos: son del día entero (el cierre es global) y lo
 * primero que hay que ver.
 */
export function misionEnModo(q: { modes?: readonly unknown[] | null; is_penalty?: boolean }, modo: ModoId): boolean {
  if (modo === 'general') return true;
  if (q.is_penalty) return true;
  return modosDeMision(q).includes(modo);
}

/** La lista de Hoy filtrada por el modo activo. General la deja igual (misma referencia). */
export function filtrarPorModo<T extends { modes?: readonly unknown[] | null; is_penalty?: boolean }>(
  quests: T[],
  modo: ModoId,
): T[] {
  if (modo === 'general') return quests;
  return quests.filter((q) => misionEnModo(q, modo));
}

/** Pone o quita una etiqueta; devuelve la lista en el orden canónico. */
export function alternarModo(actuales: readonly ModoEtiqueta[], modo: ModoEtiqueta): ModoEtiqueta[] {
  const set = new Set(actuales);
  if (set.has(modo)) set.delete(modo);
  else set.add(modo);
  return MODOS_ETIQUETA.filter((m) => set.has(m));
}

/** Los modos que el selector ofrece: General y los activados, en orden. */
export function modosDisponibles(activados: readonly ModoEtiqueta[]): ModoId[] {
  return MODOS.filter((m) => m === 'general' || activados.includes(m as ModoEtiqueta));
}

/**
 * El modo activo que vale: si el guardado ya no está activado (lo desactivó en
 * otro teléfono, o el valor es basura), General.
 */
export function modoValido(guardado: unknown, activados: readonly ModoEtiqueta[]): ModoId {
  return esModoEtiqueta(guardado) && activados.includes(guardado) ? guardado : 'general';
}

/** Onboarding: hace falta al menos un modo además de General. */
export const MINIMO_MODOS = 1;

export function eleccionValida(elegidos: readonly ModoEtiqueta[]): boolean {
  return elegidos.filter(esModoEtiqueta).length >= MINIMO_MODOS;
}

/** Lo que se propone marcado en el onboarding según el perfil de uso (un toque para cambiarlo). */
export function modosSugeridos(kind: ProfileKind | null | undefined): ModoEtiqueta[] {
  switch (kind) {
    case 'deportista':
      return ['iron'];
    case 'estudiante':
      return ['focus'];
    case 'trabajador':
      return ['work'];
    case 'emprendedor':
      return ['founder'];
    default:
      return [];
  }
}

/** Las filas de `user_modes` que deja una elección: las cuatro, con `enabled` según lo elegido. */
export function filasUserModes(
  userId: string,
  elegidos: readonly ModoEtiqueta[],
): { user_id: string; mode: ModoEtiqueta; enabled: boolean }[] {
  return MODOS_ETIQUETA.map((mode) => ({ user_id: userId, mode, enabled: elegidos.includes(mode) }));
}

/** De las filas leídas de `user_modes` a la lista de activados (orden canónico, sin basura). */
export function activadosDeFilas(filas: readonly { mode?: unknown; enabled?: unknown }[] | null | undefined): ModoEtiqueta[] {
  const on = new Set((filas ?? []).filter((f) => f.enabled !== false).map((f) => f.mode));
  return MODOS_ETIQUETA.filter((m) => on.has(m));
}

/** De las filas de `mode_xp` a XP por modo (0 si no hay fila). */
export function xpPorModo(filas: readonly { mode?: unknown; xp?: unknown }[] | null | undefined): Record<ModoEtiqueta, number> {
  const out: Record<ModoEtiqueta, number> = { iron: 0, focus: 0, work: 0, founder: 0 };
  for (const f of filas ?? []) {
    const xp = typeof f.xp === 'number' ? f.xp : typeof f.xp === 'string' ? Number(f.xp) : NaN;
    if (esModoEtiqueta(f.mode) && Number.isFinite(xp) && xp > 0) out[f.mode] = xp;
  }
  return out;
}

/**
 * La cabecera que lleva el modo al coach (contrato: `x-nivl-modo`). Solo con
 * el interruptor encendido y un modo que no sea General: sin cabecera, el
 * prompt del servidor es idéntico byte a byte al de hoy.
 */
export function cabeceraModo(modo: ModoId | null | undefined, activo: boolean): Record<string, string> {
  if (!activo || !modo || modo === 'general' || !esModoEtiqueta(modo)) return {};
  return { 'x-nivl-modo': modo };
}

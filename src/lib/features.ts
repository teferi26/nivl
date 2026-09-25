// NIVL · Acceso anticipado: qué función ve cada nivel antes que el resto.
//
// Solo el MECANISMO (docs/PLAN_NIVELES_Y_CREADORES.md §5.7). Qué entra aquí es
// una decisión de producto: hoy la lista está vacía. Para abrir una función
// primero al Élite se añade su clave con `minTier: 'elite'`; cuando sale para
// todos, se baja a 'free' o se borra la entrada y la pantalla deja de preguntar.
//
// Nunca se usa para algo que dé XP, rachas o puestos: el acceso anticipado es
// a herramientas, no a ventaja en el juego.
//
// Módulo PURO: sin imports de Supabase.

import type { Tier } from './proplans';

/** Orden de los niveles: owner lo ve todo. */
const RANGO: Record<Tier, number> = { free: 0, pro: 1, elite: 2, owner: 3 };

export interface FeatureFlag {
  /** El nivel mínimo que la ve. */
  minTier: Tier;
  /** Una línea para quien la mantiene: qué es y desde cuándo. */
  note: string;
}

/** Funciones en acceso anticipado. Vacío a propósito. */
export const FEATURES: Readonly<Record<string, FeatureFlag>> = {};

export type FeatureKey = keyof typeof FEATURES & string;

/**
 * ¿Ve esta cuenta la función? Una clave que no está en la lista es una función
 * ya abierta a todos: devuelve true. Un nivel desconocido cuenta como gratis.
 */
export function enabled(
  feature: string,
  tier: Tier | null | undefined,
  flags: Readonly<Record<string, FeatureFlag>> = FEATURES,
): boolean {
  const flag = flags[feature];
  if (!flag) return true;
  const mio = tier && tier in RANGO ? RANGO[tier] : 0;
  return mio >= RANGO[flag.minTier];
}

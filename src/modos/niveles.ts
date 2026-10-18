// NIVL · Modos F1: el nivel de cada modo (puro, con test).
//
// Misma curva que el nivel global (game.ts → levelFromXp): un modo es una
// vista de la misma XP, no una economía aparte. La XP la suma el servidor en
// `mode_xp` al completar una misión con etiquetas (cada acción suma al nivel
// global y al de cada uno de sus modos); aquí solo se pinta.

import { levelFromXp } from '@/lib/game';
import { MODOS_ETIQUETA, type ModoEtiqueta } from './tipos';

export interface NivelModo {
  modo: ModoEtiqueta;
  xp: number;
  nivel: number;
  xpEnNivel: number;
  /** 0 = nivel máximo. */
  xpSiguiente: number;
}

/**
 * Los niveles que se enseñan en Perfil: los modos activados y los que ya
 * tienen XP aunque se hayan desactivado (lo ganado no se esconde). En el
 * orden de siempre.
 */
export function nivelesDeModos(activados: readonly ModoEtiqueta[], xp: Readonly<Record<ModoEtiqueta, number>>): NivelModo[] {
  return MODOS_ETIQUETA.filter((m) => activados.includes(m) || (xp[m] ?? 0) > 0).map((modo) => {
    const total = Math.max(0, xp[modo] ?? 0);
    const n = levelFromXp(total);
    return { modo, xp: total, nivel: n.level, xpEnNivel: n.into, xpSiguiente: n.next };
  });
}

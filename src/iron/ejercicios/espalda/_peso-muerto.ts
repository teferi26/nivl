// NIVL · IRON · ESPALDA: lo común de los pesos muertos.
//
// La barra sube y baja en vertical sobre el medio del pie: cada pose se
// despeja desde la mano (bisagra) para que el puño caiga sobre esa vertical.
// El bloqueo es de pie, piernas rectas y la barra pegada a los muslos.
// El archivo empieza por «_»: no es un ejercicio.

import type { Pose, SegmentoId } from '../../tipos';
import { bisagra, pose, type Absolutos } from './_pose';

/** La vertical de la barra: un poco por delante del tobillo (medio del pie). */
export const X_BARRA = 4.5;
/** Altura del centro de la barra con discos de 45 cm apoyados en el suelo. */
export const BARRA_SUELO = 12.6;

/** De pie con la barra en los muslos: piernas rectas, algo inclinadas hacia atrás. */
export const BLOQUEO: Absolutos = { tronco: 88, cabeza: 88, muslo: -88, pierna: -88, pie: 0, brazo: -82, antebrazo: -82 };

export function enBarra(tronco: number, altura: number, brazo: number, cabeza: number, escorzo?: { muslo?: number; pierna?: number }): Absolutos {
  return bisagra({ tronco, brazo, mano: { x: X_BARRA, y: altura }, cabeza, escorzo }).abs;
}

export function poseEscorzo(ms: number, a: Absolutos, muslo: number, pierna: number): Pose {
  const e: Partial<Record<SegmentoId, number>> = { muslo_c: muslo, muslo_l: muslo, pierna_c: pierna, pierna_l: pierna };
  return pose(ms, a, { escorzo: e });
}

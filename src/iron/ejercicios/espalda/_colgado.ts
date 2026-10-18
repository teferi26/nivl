// NIVL · IRON · ESPALDA: lo común de las dominadas (colgado de la barra fija).
//
// El ancla es el puño cercano en la barra: las manos no se mueven y el cuerpo
// cuelga de ellas. Rodillas dobladas y pies detrás, igual en todo el recorrido.
// El archivo empieza por «_»: no es un ejercicio.

import type { Ancla, Escenario, Pose } from '../../tipos';
import type { EscenarioEspalda } from '../../material/espalda';
import { brazoHasta, pose, type Absolutos } from './_pose';

export const BARRA_ALTA = { x: 0, y: 118 } as const;

export const ANCLA_COLGADO: Ancla = { punto: 'agarre_c', x: BARRA_ALTA.x, y: BARRA_ALTA.y, segmento: 'antebrazo_c', angulo: 90 };

export const piernasColgado = (tronco: number) => ({ muslo: tronco + 195, pierna: tronco + 110, pie: tronco + 175 });

/** Colgado con el hombro en `hombro`: brazo y antebrazo por IK hasta la barra. */
export function colgado(tronco: number, cabeza: number, hombro: { x: number; y: number }, eBrazo: number, eAnte = 0.95): Absolutos {
  const b = brazoHasta(hombro, BARRA_ALTA, true, { brazo: eBrazo, antebrazo: eAnte });
  return { tronco, cabeza, ...piernasColgado(tronco), ...b };
}

/** La pose con el ángulo del antebrazo (el segmento del ancla) y el escorzo de los brazos. */
export const poseColgado = (ms: number, a: Absolutos, eBrazo: number, eAnte = 0.95): Pose =>
  pose(ms, a, { angulo: a.antebrazo, escorzo: { brazo_c: eBrazo, brazo_l: eBrazo, antebrazo_c: eAnte, antebrazo_l: eAnte } });

export const ESCENARIO_BARRA_ALTA: readonly (Escenario | EscenarioEspalda)[] = [
  { tipo: 'barra_dominadas', x: BARRA_ALTA.x, y: BARRA_ALTA.y, soporte: 'pared', pared: -30, eje: { x: 5, y: 3 }, capa: 'fondo' },
];

export const ENCUADRE_COLGADO = { x: -36, y: 8, ancho: 82, alto: 132 } as const;

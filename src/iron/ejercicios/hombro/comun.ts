// NIVL · IRON · Hombro · Piezas comunes a varios ejercicios del grupo
// (posturas de piernas y anclas). No es un ejercicio: el índice no lo lista.

import type { Ancla, Escenario, Extremidades, SegmentoId } from '../../tipos';

/** De pie, vista lateral: tobillo en el suelo y pie plano (como el curl). */
export const ANCLA_PIE_LATERAL: Ancla = { punto: 'tobillo_c', x: 0, y: 4, segmento: 'pie_c', angulo: 0 };
/** Piernas de pie con las rodillas sueltas; tronco vertical (rodilla = tobillo + cadera). */
export const PIERNAS_PIE_LATERAL = { tobillo: 2, rodilla: 3, cadera: 1 } as const;

/**
 * De pie, vista frontal: la cadera a la altura justa para que las plantas
 * toquen el suelo. En la vista frontal el tobillo compensa la abducción de la
 * cadera (tobillo = -cadera) para que la planta quede horizontal.
 */
export const ANCLA_PIE_FRONTAL: Ancla = { punto: 'cadera', x: 0, y: 52.9, segmento: 'tronco', angulo: 90 };
export const PIERNAS_PIE_FRONTAL = { cadera: 3, rodilla: 0, tobillo: -3 } as const;

/**
 * Sentado en un banco plano, vista frontal: los muslos van hacia la cámara
 * (se ven cortos) y las piernas bajan al suelo. La cadera queda sobre el
 * tablero del banco, que se ve de frente (por su extremo).
 */
export const ANCLA_SENTADO_FRONTAL: Ancla = { punto: 'cadera', x: 0, y: 38.75, segmento: 'tronco', angulo: 90 };
export const PIERNAS_SENTADO_FRONTAL = { cadera: 12, rodilla: 0, tobillo: -12 } as const;
export const ESCORZO_SENTADO_FRONTAL: Readonly<Partial<Record<SegmentoId, number>>> = { muslo_c: 0.45, muslo_l: 0.45 };
export const BANCO_FRONTAL: Escenario = { tipo: 'banco', x: -13, ancho: 26, alto: 33, capa: 'fondo' };

export const conBrazos = (
  piernas: Pick<Extremidades, 'cadera' | 'rodilla' | 'tobillo'>,
  hombro: number,
  codo: number,
): Extremidades => ({ ...piernas, hombro, codo });

// NIVL · IRON · ESPALDA: lo común de los ejercicios sentados en máquina
// (jalones y remos). El ancla es la cadera sobre el asiento y el ángulo del
// tronco; las piernas se dan en absoluto, así no se mueven aunque el tronco
// se incline. Los brazos se despejan para que el puño caiga donde toca (la
// barra del jalón, el agarre del remo).
// El archivo empieza por «_»: no es un ejercicio.

import { LARGO, type Punto } from '../../esqueleto';
import type { Ancla, Pose, SegmentoId } from '../../tipos';
import { brazoHasta, desde, piernaHasta, pose, type Absolutos } from './_pose';

export interface Sentado {
  cadera: Punto;
  tobillo: Punto;
  /** Ángulo del pie (0 = plano en el suelo). */
  pie: number;
}

export function anclaSentado(s: Sentado, tronco: number): Ancla {
  return { punto: 'cadera', x: s.cadera.x, y: s.cadera.y, segmento: 'tronco', angulo: tronco };
}

/** Sentado con el tronco a `tronco` grados y el puño en `mano`. */
export function sentado(
  s: Sentado,
  tronco: number,
  mano: Punto,
  escorzo: { brazo: number; antebrazo: number },
  codoAbajo = true,
  cabeza?: number,
): Absolutos {
  const piernas = piernaHasta(s.cadera, s.tobillo, true);
  const hombro = desde(s.cadera, tronco, LARGO.tronco);
  return { tronco, cabeza, ...piernas, pie: s.pie, ...brazoHasta(hombro, mano, codoAbajo, escorzo) };
}

export const hombroSentado = (s: Sentado, tronco: number): Punto => desde(s.cadera, tronco, LARGO.tronco);

/** La pose con el ángulo del tronco (el del ancla) y el escorzo de los brazos. */
export function poseSentado(ms: number, a: Absolutos, escorzo: { brazo: number; antebrazo: number }): Pose {
  const e: Partial<Record<SegmentoId, number>> = {
    brazo_c: escorzo.brazo,
    brazo_l: escorzo.brazo,
    antebrazo_c: escorzo.antebrazo,
    antebrazo_l: escorzo.antebrazo,
  };
  return pose(ms, a, { angulo: a.tronco, escorzo: e });
}

// ── Jalón ───────────────────────────────────────────────────────────────

export const JALON: Sentado = { cadera: { x: 0, y: 30 }, tobillo: { x: 29, y: 4 }, pie: 0 };

/** El rodillo de muslos: encima del muslo, cerca de la rodilla. */
export function rodilloJalon(): Punto {
  const { muslo } = piernaHasta(JALON.cadera, JALON.tobillo, true);
  const eje = desde(JALON.cadera, muslo, LARGO.muslo * 0.72);
  return desde(eje, muslo + 90, 5.4 + 3.2);
}

/** Arriba: brazos casi estirados por encima de la cabeza. */
export function manoArribaJalon(tronco: number, escorzo: { brazo: number; antebrazo: number }, grados = 84): Punto {
  const alcance = (LARGO.brazo * escorzo.brazo + LARGO.antebrazo * escorzo.antebrazo + LARGO.mano) * 0.98;
  return desde(hombroSentado(JALON, tronco), grados, alcance);
}

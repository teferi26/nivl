// NIVL · IRON · Material: la barra de dominadas (y la barra baja del remo invertido).
//
// Escenario fijo. La barra se ve de punta (un círculo) y, con `eje`, como un
// tramo que sale hacia la cámara en 3/4, igual que la barra con discos. El
// soporte: 'pared' (un brazo hasta la pared, detrás de la espalda) o 'poste'
// (el poste del extremo lejano, que baja al suelo por detrás del cuerpo).
// Las manos se dibujan encima: el puño rodea la barra.

import { caja, circulo, tramo, type P } from './trazo-espalda';

export interface BarraDominadas {
  readonly tipo: 'barra_dominadas';
  /** Centro de la barra (donde van los puños). */
  readonly x: number;
  readonly y: number;
  readonly soporte: 'pared' | 'poste';
  /** Con 'pared': dónde está la pared (x absoluta). */
  readonly pared?: number;
  readonly eje?: { readonly x: number; readonly y: number };
  readonly capa: 'fondo' | 'medio';
}

export const RADIO_BARRA_FIJA = 1.6;

export function dibujarBarraDominadas(b: BarraDominadas): string {
  'worklet';
  const c: P = { x: b.x, y: b.y };
  let d = '';
  if (b.soporte === 'pared') {
    const px = b.pared ?? b.x - 24;
    const s = px < b.x ? -1 : 1;
    // La pared (un tramo de muro) y el brazo con su escuadra.
    d += caja({ x: px + s * 1.5, y: (b.y + 14) / 2 }, 3, b.y + 14);
    d += tramo({ x: px, y: b.y + 2 }, c, 2.4);
    d += tramo({ x: px, y: b.y - 8 }, { x: px - s * 9, y: b.y + 1 }, 1.6);
  } else {
    const lejos = b.eje ? { x: b.x - b.eje.x, y: b.y - b.eje.y } : c;
    d += tramo(lejos, { x: lejos.x, y: 0 }, 2.6);
    d += caja({ x: lejos.x, y: 0.8 }, 12, 1.6);
  }
  if (b.eje) {
    const lejos = { x: b.x - b.eje.x, y: b.y - b.eje.y };
    const cerca = { x: b.x + b.eje.x, y: b.y + b.eje.y };
    d += tramo(lejos, cerca, RADIO_BARRA_FIJA * 1.6) + circulo(cerca, RADIO_BARRA_FIJA, 14);
  }
  d += circulo(c, RADIO_BARRA_FIJA, 14);
  return d;
}

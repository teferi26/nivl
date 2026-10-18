// NIVL · IRON · Material: la polea (torre, cable y agarres).
//
// · La TORRE es escenario fijo: un poste del suelo hasta `alto` con la rueda
//   en (x + hacia × 3, y). `hacia` dice a qué lado sale el cable (+1 a la
//   derecha, -1 a la izquierda).
// · El CABLE es una recta del agarre a la rueda que se recalcula en cada
//   cuadro: no se dibuja a mano, sale del esqueleto del instante.
// · El AGARRE va en la mano: asa en D, cuerda (dos cabos con su nudo), barra
//   (de jalón, de punta; con `eje` se ve el tramo en 3/4) o triángulo (agarre
//   neutro estrecho). El cable se engancha en el vértice del agarre.

import type { Lado } from '../tipos';
import { caja, circulo, tramo, type P } from './trazo-espalda';

export interface TorrePolea {
  readonly tipo: 'polea';
  /** Eje del poste. */
  readonly x: number;
  /** Altura de la rueda. */
  readonly y: number;
  readonly hacia: 1 | -1;
  /** Altura del poste (por defecto, hasta la rueda y un poco más). */
  readonly alto?: number;
  /** Polea alta con brazo: la rueda cuelga a `brazo` del poste (jalón, pullover). */
  readonly brazo?: number;
  readonly capa: 'fondo' | 'medio';
}

export type AgarrePolea = 'asa' | 'cuerda' | 'barra' | 'triangulo';

export interface CargaPolea {
  readonly tipo: 'polea';
  readonly agarre: AgarrePolea;
  /** Centro de la rueda por la que sale el cable (el de la torre o la máquina). */
  readonly polea: { readonly x: number; readonly y: number };
  /** Qué manos llevan agarre (con barra, cuerda o triángulo basta 'cerca'). */
  readonly lados: readonly Lado[];
  /** Barra: el tramo que sale hacia la cámara (como la barra con discos). */
  readonly eje?: { readonly x: number; readonly y: number };
}

export const RADIO_RUEDA = 2.6;

/** Dónde está la rueda de una torre. */
export function ruedaDe(t: TorrePolea): P {
  'worklet';
  return { x: t.x + t.hacia * (t.brazo ?? 3), y: t.y };
}

export function dibujarTorre(t: TorrePolea): string {
  'worklet';
  const alto = t.alto ?? t.y + (t.brazo ? 6 : 8);
  const r = ruedaDe(t);
  let d = caja({ x: t.x, y: alto / 2 }, 4.4, alto);
  // Pie en el suelo y la pila de placas en la base.
  d += caja({ x: t.x, y: 0.9 }, 18, 1.8);
  d += caja({ x: t.x - t.hacia * 5.4, y: 9 }, 5.2, 16);
  // Soporte de la rueda (o el brazo de la polea alta) y la rueda.
  if (t.brazo) {
    d += tramo({ x: t.x, y: alto - 2 }, { x: r.x, y: alto - 2 }, 3);
    d += tramo({ x: r.x, y: alto - 2 }, r, 1.6);
  } else d += tramo({ x: t.x, y: t.y }, r, 2);
  d += circulo(r, RADIO_RUEDA, 16);
  return d;
}

/** Dónde se engancha el cable en el agarre (el vértice), mirando hacia la rueda. */
export function enganche(mano: P, polea: P, agarre: AgarrePolea): P {
  'worklet';
  const dx = polea.x - mano.x;
  const dy = polea.y - mano.y;
  const l = Math.hypot(dx, dy) || 1;
  const largo = agarre === 'barra' ? 0 : agarre === 'asa' ? 4 : agarre === 'triangulo' ? 6.5 : 7;
  return { x: mano.x + (dx / l) * largo, y: mano.y + (dy / l) * largo };
}

function agarreDibujo(mano: P, polea: P, c: CargaPolea): string {
  'worklet';
  const v = enganche(mano, polea, c.agarre);
  const dx = polea.x - mano.x;
  const dy = polea.y - mano.y;
  const l = Math.hypot(dx, dy) || 1;
  const u = { x: dx / l, y: dy / l };
  const n = { x: -u.y, y: u.x };
  if (c.agarre === 'barra') {
    let d = circulo(mano, 1.5, 14);
    if (c.eje) {
      const fin = { x: mano.x + c.eje.x, y: mano.y + c.eje.y };
      d += tramo(mano, fin, 1.6) + circulo(fin, 1.2, 10);
    }
    return d;
  }
  if (c.agarre === 'cuerda') {
    // Los dos cabos van del enganche a la mano y asoman con su nudo.
    const nudo = { x: mano.x - u.x * 2.2, y: mano.y - u.y * 2.2 };
    return tramo(v, nudo, 1.5) + circulo(nudo, 1.5, 12);
  }
  // Asa en D o triángulo: un aro alrededor del puño que acaba en el vértice.
  const ancho = c.agarre === 'asa' ? 2.8 : 4.2;
  const lado = (s: number): P => ({ x: mano.x - u.x * 1.6 + n.x * ancho * s, y: mano.y - u.y * 1.6 + n.y * ancho * s });
  const a = lado(1);
  const b = lado(-1);
  return tramo(a, b, 1.2) + tramo(a, v, 1) + tramo(b, v, 1) + circulo(v, 0.9, 8);
}

/** Cable y agarre de una mano: se recalcula en cada cuadro. */
export function dibujarCargaPolea(c: CargaPolea, mano: P): string {
  'worklet';
  const v = enganche(mano, c.polea, c.agarre);
  return tramo(v, c.polea, 0.7) + agarreDibujo(mano, c.polea, c);
}


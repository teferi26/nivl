// NIVL · IRON · Material: asiento de máquina (jalón, remo en polea y remo en
// máquina), la palanca del remo en máquina y el banco de hiperextensiones.
//
// · ASIENTO: el sillín sobre su columna. Opcional: el rodillo de muslos del
//   jalón, el apoyo de pecho del remo en máquina, la plataforma de pies del
//   remo en polea y el poste con el eje de la palanca.
// · PALANCA (carga): el brazo de la máquina, del eje a la mano, recalculado en
//   cada cuadro. La mano describe un arco alrededor del eje (lo mide un test).
// · HIPEREXTENSIÓN: el banco a 45°: almohadilla de cadera, rodillo de tobillos
//   y plataforma.

import type { Lado } from '../tipos';
import { caja, circulo, tramo, type P } from './trazo-espalda';

export interface Asiento {
  readonly tipo: 'asiento';
  /** Centro del sillín y altura de su cara de arriba. */
  readonly x: number;
  readonly alto: number;
  readonly ancho: number;
  /** Rodillo de muslos (jalón): su centro. */
  readonly rodillo?: { readonly x: number; readonly y: number };
  /** Apoyo de pecho (remo en máquina): cara de apoyo en x, de y0 a y1. */
  readonly pecho?: { readonly x: number; readonly y0: number; readonly y1: number };
  /** Plataforma de pies (remo en polea): centro y dirección del lado largo de la placa. */
  readonly pies?: { readonly x: number; readonly y: number; readonly angulo: number };
  /** Poste con el eje de una palanca. */
  readonly eje?: { readonly x: number; readonly y: number };
  readonly capa: 'fondo' | 'medio';
}

export interface CargaPalanca {
  readonly tipo: 'palanca';
  readonly pivote: { readonly x: number; readonly y: number };
  readonly lados: readonly Lado[];
}

export interface BancoHiperextension {
  readonly tipo: 'hiperextension';
  /** Centro de la cara de apoyo de la almohadilla (donde va la cadera). */
  readonly cadera: { readonly x: number; readonly y: number };
  /** Inclinación de la almohadilla (grados, 45 en el banco clásico). */
  readonly angulo: number;
  /** Centro del rodillo de los tobillos. */
  readonly tobillos: { readonly x: number; readonly y: number };
  readonly capa: 'fondo' | 'medio';
}

export const GROSOR_ALMOHADILLA = 4;
export const RADIO_RODILLO = 3.2;

export function dibujarAsiento(a: Asiento): string {
  'worklet';
  let d = caja({ x: a.x, y: a.alto - GROSOR_ALMOHADILLA / 2 }, a.ancho, GROSOR_ALMOHADILLA);
  d += tramo({ x: a.x, y: a.alto - GROSOR_ALMOHADILLA }, { x: a.x, y: 1.6 }, 3);
  d += caja({ x: a.x, y: 0.8 }, Math.max(16, a.ancho * 0.6), 1.6);
  if (a.rodillo) {
    const r = a.rodillo;
    d += tramo(r, { x: r.x + 9, y: r.y }, 1.8) + tramo({ x: r.x + 9, y: r.y }, { x: r.x + 9, y: a.alto - 2 }, 1.8);
    d += tramo({ x: r.x + 9, y: a.alto - 2 }, { x: a.x + a.ancho / 2, y: a.alto - 2 }, 1.8);
    d += circulo(r, RADIO_RODILLO, 16);
  }
  if (a.pecho) {
    const p = a.pecho;
    const medio = (p.y0 + p.y1) / 2;
    d += caja({ x: p.x + GROSOR_ALMOHADILLA / 2, y: medio }, GROSOR_ALMOHADILLA, p.y1 - p.y0);
    d += tramo({ x: p.x + GROSOR_ALMOHADILLA, y: medio }, { x: p.x + 10, y: medio - 6 }, 2);
    d += tramo({ x: p.x + 10, y: medio - 6 }, { x: p.x + 10, y: 1.6 }, 2.6);
  }
  if (a.pies) {
    const f = a.pies;
    d += caja({ x: f.x, y: f.y }, 13, 2.4, f.angulo);
    d += tramo({ x: f.x + 1.2, y: f.y - 4 }, { x: f.x + 1.2, y: 1 }, 2) + tramo({ x: a.x, y: 1 }, { x: f.x + 2, y: 1 }, 2);
  }
  if (a.eje) {
    d += tramo({ x: a.eje.x, y: a.eje.y }, { x: a.eje.x, y: 1.6 }, 3.4);
    d += caja({ x: a.eje.x, y: 0.8 }, 14, 1.6);
  }
  return d;
}

/** Brazo de la máquina del eje a la mano, con su empuñadura vertical. */
export function dibujarPalanca(c: CargaPalanca, mano: P): string {
  'worklet';
  return tramo(c.pivote, mano, 2.4) + circulo(c.pivote, 2.6, 14) + caja(mano, 1.6, 7.5, 90);
}

export function dibujarHiperextension(b: BancoHiperextension): string {
  'worklet';
  const r = (b.angulo * Math.PI) / 180;
  // Dirección de la almohadilla (sube hacia la cabeza) y su normal hacia fuera.
  const u = { x: Math.cos(r), y: Math.sin(r) };
  const n = { x: -u.y, y: u.x };
  const centro = { x: b.cadera.x - n.x * (GROSOR_ALMOHADILLA / 2), y: b.cadera.y - n.y * (GROSOR_ALMOHADILLA / 2) };
  let d = caja(centro, 13, GROSOR_ALMOHADILLA, b.angulo);
  // Columna de la almohadilla y bastidor hasta los tobillos.
  const base = { x: centro.x - n.x * 3, y: centro.y - n.y * 3 };
  d += tramo(base, { x: base.x, y: 1.6 }, 2.6);
  d += tramo({ x: base.x, y: 1.6 }, { x: b.tobillos.x, y: 1.6 }, 2.6);
  d += tramo({ x: b.tobillos.x, y: 1.6 }, b.tobillos, 2);
  d += circulo(b.tobillos, RADIO_RODILLO, 16);
  return d;
}

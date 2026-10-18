// NIVL · IRON · Material: máquinas de palanca de pierna (pierna, fase 2):
// extensión de cuádriceps y curl femoral tumbado.
//
// · Bancada (escenario, fija): `x`, `ancho`, `alto` del tablero.
//   - 'extension': asiento de `x` a `x + ancho` con el tablero arriba en
//     `alto`, respaldo en `x` y la torre de discos detrás.
//   - 'curl_femoral': banco tumbado de `x` a `x + ancho` y el asa delante (en
//     `x + ancho`, bajo la cabeza: el agarre queda en `x + ancho + 6`, a
//     `alto - 8,9`).
// · Palanca (carga, se mueve con la pierna): gira en `eje` (el de la rodilla,
//   fijo en el mundo); el brazo va por fuera de la pierna y el rodillo se
//   apoya delante del tobillo (extensión, `cara` 'ant') o detrás (curl, 'post').

import { dir, type Esqueleto, type Punto } from '../esqueleto';
import type { Escenario } from '../tipos';
import { caja, circulo, tramo } from './trazo';

const G = 5;

export function bancadaExtension(b: Escenario): string {
  'worklet';
  const x0 = b.x;
  const x1 = b.x + b.ancho;
  let d = caja(x0, b.alto - G, x1, b.alto);
  // Respaldo, algo reclinado (100°), por detrás de la espalda.
  const r = dir(100);
  const base = { x: x0 - 1.4, y: b.alto - 1 };
  d += tramo(base, { x: base.x + r.x * 40, y: base.y + r.y * 40 }, G);
  // Pata delantera, torre de discos detrás y viga en el suelo.
  d += caja(x1 - 6, 0, x1 - 3, b.alto - G);
  d += caja(x0 - 22, 0, x0 - 12, 72);
  for (let i = 0; i < 5; i++) d += caja(x0 - 21, 18 + i * 3.4, x0 - 13, 20.6 + i * 3.4);
  d += caja(x0 - 24, 0, x1 + 4, 2);
  return d;
}

export function bancadaCurlFemoral(b: Escenario): string {
  'worklet';
  const x0 = b.x;
  const x1 = b.x + b.ancho;
  let d = caja(x0, b.alto - G, x1, b.alto);
  // Patas, viga y asas delante (bajo la cabeza).
  d += caja(x0 + 5, 0, x0 + 8, b.alto - G);
  d += caja(x1 - 8, 0, x1 - 5, b.alto - G);
  d += caja(x0, 0, x1 + 6, 2);
  // Asas: un soporte que baja del tablero y el agarre delante, bajo la cara.
  d += caja(x1 - 3, b.alto - G - 5, x1 - 0.6, b.alto - G);
  d += caja(x1 - 3, b.alto - G - 5, x1 + 8, b.alto - G - 2.8);
  return d;
}

/** Radio del rodillo. */
export const RODILLO = 3;

/** Centro del rodillo de la palanca (para los tests). */
export function rodilloPalanca(e: Esqueleto, cara: 'ant' | 'post'): Punto {
  'worklet';
  const d = dir(e.a.pierna_c);
  // Normal anterior de la pierna en la vista lateral (la izquierda del sentido rodilla→tobillo).
  const n = { x: -d.y, y: d.x };
  const s = cara === 'ant' ? 1 : -1;
  const t = e.p.tobillo_c;
  // Justo encima del tobillo: radio de la pierna ahí (≈ 2,4) + radio del rodillo.
  const k = 2.4 + RODILLO;
  return { x: t.x - d.x * 3.5 + n.x * k * s, y: t.y - d.y * 3.5 + n.y * k * s };
}

export function palanca(e: Esqueleto, eje: Punto, cara: 'ant' | 'post'): string {
  'worklet';
  const c = rodilloPalanca(e, cara);
  let d = tramo(eje, c, 1.8);
  d += circulo(eje, 2.4, 14);
  d += circulo(c, RODILLO, 16);
  return d;
}

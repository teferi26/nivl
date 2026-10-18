// NIVL · IRON · Material (core): la esterilla.
//
// Una lámina en el suelo, de `x` a `x + ancho` y de grosor `alto` (el cuerpo
// se apoya encima: en los ejercicios en el suelo el ancla cuenta ese grosor).
// Bordes redondeados para que se lea como una esterilla y no como un escalón.

import type { Escenario } from '../tipos';
import { poligonoMat } from './trazo';

/** Grosor de la esterilla en unidades de cuerpo (≈ 1 cm). */
export const GROSOR_ESTERILLA = 0.8;

export function esterilla(b: Escenario): string {
  'worklet';
  const r = Math.min(b.alto / 2, 1.2);
  const x0 = b.x;
  const x1 = b.x + b.ancho;
  return poligonoMat([
    { x: x0 + r, y: 0 },
    { x: x1 - r, y: 0 },
    { x: x1, y: r },
    { x: x1, y: b.alto - r },
    { x: x1 - r, y: b.alto },
    { x: x0 + r, y: b.alto },
    { x: x0, y: b.alto - r },
    { x: x0, y: r },
  ]);
}

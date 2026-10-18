// NIVL · IRON · Material: cajón (pierna, fase 2).
//
// Un cajón de madera o de saltos visto de lado: el bloque, del suelo a
// `alto`, y la ranura del asa. También sirve de escalón (gemelos) y de silla
// (sentadilla al cajón): en casa vale un banco firme o un escalón.

import type { Escenario } from '../tipos';
import { caja } from './trazo';

export function cajon(b: Escenario): string {
  'worklet';
  const x1 = b.x + b.ancho;
  let d = caja(b.x, 0, x1, b.alto);
  // La ranura del asa, si cabe.
  if (b.alto >= 14 && b.ancho >= 16) {
    const cx = b.x + b.ancho / 2;
    const y = b.alto - Math.min(7, b.alto * 0.28);
    d += caja(cx - b.ancho * 0.18, y - 1.2, cx + b.ancho * 0.18, y + 1.2);
  }
  return d;
}

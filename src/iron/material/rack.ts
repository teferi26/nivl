// NIVL · IRON · Material: rack de sentadillas (pierna, fase 2).
//
// Visto de lado y detrás del cuerpo (capa 'fondo'): dos postes, el travesaño
// de arriba, los soportes en J a la altura `alto` (donde se deja la barra) y
// los brazos de seguridad a `seguro`, por debajo del punto más bajo de la barra.

import type { Escenario } from '../tipos';
import { caja } from './trazo';

/** Altura de los postes, en unidades de cuerpo (100 ≈ la altura de pie). */
export const ALTO_RACK = 122;

export function rack(b: Escenario): string {
  'worklet';
  const g = 2.6;
  const x0 = b.x;
  const x1 = b.x + b.ancho;
  let d = '';
  // Base, postes y travesaño.
  d += caja(x0 - 6, 0, x1 + 6, 1.6);
  d += caja(x0 - g / 2, 0, x0 + g / 2, ALTO_RACK);
  d += caja(x1 - g / 2, 0, x1 + g / 2, ALTO_RACK);
  d += caja(x0 - g / 2, ALTO_RACK - 2.4, x1 + g / 2, ALTO_RACK);
  // Soportes en J en los dos postes, hacia dentro.
  for (const [x, s] of [
    [x0, 1],
    [x1, -1],
  ] as const) {
    d += caja(x + (s * g) / 2, b.alto - 1.4, x + s * (g / 2 + 4.2), b.alto);
    d += caja(x + s * (g / 2 + 3), b.alto, x + s * (g / 2 + 4.2), b.alto + 2.2);
  }
  // Brazos de seguridad.
  if (b.seguro !== undefined) d += caja(x0 - 4, b.seguro - 1.3, x1 + 4, b.seguro + 1.3);
  return d;
}

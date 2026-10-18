// NIVL · IRON · Material: máquina de abductores, vista frontal (pierna, fase 2).
//
// · Bancada (escenario 'abductora', fija): `x` es el centro del asiento,
//   `ancho` su anchura y `alto` la altura del tablero. Asiento, respaldo
//   detrás del tronco, columna y base.
// · Almohadillas (carga 'abductora', se mueven): una por fuera de cada
//   rodilla, con el arranque de su brazo. Siguen a la rodilla.

import type { Esqueleto, Punto } from '../esqueleto';
import type { Escenario } from '../tipos';
import { caja, tramo } from './trazo';

export function bancadaAbductora(b: Escenario): string {
  'worklet';
  const m = b.ancho / 2;
  let d = '';
  // Respaldo (detrás del tronco), asiento, columna y base.
  d += caja(b.x - m * 0.8, b.alto, b.x + m * 0.8, b.alto + 46);
  d += caja(b.x - m, b.alto - 5, b.x + m, b.alto);
  d += caja(b.x - 3, 0, b.x + 3, b.alto - 5);
  d += caja(b.x - m - 6, 0, b.x + m + 6, 2);
  return d;
}

/** Media anchura de la almohadilla y separación desde el centro de la rodilla. */
const ALMOHADILLA = { ancho: 2.8, alto: 7, fuera: 7.2 } as const;

/** Centro de la almohadilla de un lado: por fuera de la rodilla. */
export function almohadilla(e: Esqueleto, lado: 'c' | 'l'): Punto {
  'worklet';
  const k = lado === 'c' ? e.p.rodilla_c : e.p.rodilla_l;
  // En la vista frontal el lado cercano queda a la izquierda de la pantalla.
  const s = lado === 'c' ? -1 : 1;
  return { x: k.x + s * ALMOHADILLA.fuera, y: k.y };
}

export function almohadillas(e: Esqueleto, ejeY: number): string {
  'worklet';
  let d = '';
  for (const lado of ['c', 'l'] as const) {
    const c = almohadilla(e, lado);
    d += caja(c.x - ALMOHADILLA.ancho, c.y - ALMOHADILLA.alto, c.x + ALMOHADILLA.ancho, c.y + ALMOHADILLA.alto);
    // El brazo de la palanca baja por detrás de la pierna hasta su eje: solo
    // se ve el tramo que asoma bajo la almohadilla.
    d += tramo({ x: c.x, y: c.y - ALMOHADILLA.alto }, { x: c.x, y: Math.max(ejeY, c.y - ALMOHADILLA.alto - 6) }, 1.6);
  }
  return d;
}

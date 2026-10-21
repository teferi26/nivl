// NIVL · FOCUS: la piel del mundo del estudiante (P01, lámina 3).
//
// La base sigue siendo «Mármol y tinta» (ink0 a ink10) y el modo añade UN
// acento, el violeta de FOCUS (tokens.ts → modoAcento.focus). Lo que en la
// lámina es «color-mix(acento x %, tarjeta)» aquí se calcula con `mezclar`:
// ningún hex suelto en las pantallas.
//
// Medidas de la lámina (teléfono de 342 de ancho) pasadas a 390 y subidas lo
// justo para que nada se lea por debajo de 11 (SISTEMA §3).

import { ink, modoAcento } from '@/design/tokens';

const hex = (c: string): [number, number, number] => {
  const h = c.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const aHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');

/** `a` sobre `b` al `t` (0 a 1): el color-mix de la lámina. */
export function mezclar(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  return `#${aHex(r1 * t + r2 * (1 - t))}${aHex(g1 * t + g2 * (1 - t))}${aHex(b1 * t + b2 * (1 - t))}`;
}

export const ACENTO = modoAcento.focus;

export const F = {
  acento: ACENTO,
  /** Texto sobre el acento (botón lleno, etiqueta). */
  sobreAcento: ink.ink0,
  fondo: ink.ink0,
  tarjeta: ink.ink1,
  /** Borde de tarjeta (#1c1c21 en la lámina). */
  linea: mezclar(ink.ink3, ink.ink2, 0.5),
  /** Separador de filas (#18181d). */
  separador: ink.ink2,
  /** Borde de control apagado (#23232a / #3a3a42). */
  control: ink.ink4,
  rotulo: ink.ink6,
  texto: ink.ink9,
  meta: ink.ink8,
  pista: mezclar(ACENTO, ink.ink1, 0.12),
  /** Borde de la tarjeta principal (acento al 45 %). */
  bordeHeroe: mezclar(ACENTO, ink.ink1, 0.55),
  /** Arranque del degradado de la tarjeta principal (acento al 22 %). */
  heroe: mezclar(ACENTO, ink.ink1, 0.27),
  /** Fondo de lo activo (chip, bloque del plan): acento al 16-18 %. */
  activo: mezclar(ACENTO, ink.ink1, 0.17),
  bordeActivo: mezclar(ACENTO, ink.ink1, 0.4),
  /** Burbuja del coach (#15151a). */
  burbuja: mezclar(ink.ink2, ink.ink3, 0.6),
  /** Pista del anillo del reloj (#1d1a26). */
  anilloPista: mezclar(ACENTO, ink.ink2, 0.16),
} as const;

export const R = { tarjeta: 18, boton: 14, chip: 12, etiqueta: 6, barra: 4, casilla: 5 } as const;

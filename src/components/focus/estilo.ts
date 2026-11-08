// NIVL · FOCUS: la piel del mundo del estudiante, en Ónix (SISTEMA.md).
//
// Vidrio sobre el fondo degradado, texto y botón principal hueso, y el oro solo
// como hilo: rótulos, cifras, el anillo del reloj y marcos finos. Nunca un
// relleno. Todo sale de tokens.ts: ningún color ni radio suelto en las pantallas.

import { ink, oro, radio, vidrio } from '@/design/tokens';

export const F = {
  /** Oro de rótulos y cifras. */
  acento: oro.claro,
  /** Oro de lo que se traza: el anillo del reloj y las barras. */
  hilo: oro.hilo,
  /** El botón principal y lo marcado: inversión, no oro. */
  hueso: ink.ink10,
  sobreHueso: ink.ink0,
  tarjeta: vidrio.tarjeta,
  linea: vidrio.borde,
  /** Separador de filas. */
  separador: vidrio.linea,
  /** Borde de control apagado. */
  control: ink.ink4,
  rotulo: ink.ink8,
  texto: ink.ink9,
  meta: ink.ink8,
  pista: vidrio.pista,
  /** Marco de la tarjeta principal. */
  bordeHeroe: oro.borde,
  /** Fondo de lo activo (chip, tarjeta de repaso): se distingue por su marco. */
  activo: vidrio.campo,
  bordeActivo: oro.borde,
} as const;

export const R = {
  tarjeta: radio.tarjeta,
  boton: radio.control,
  chip: radio.chip,
  etiqueta: radio.pastilla,
  barra: radio.pastilla,
  /** La casilla cuadrada sigue pareciendo cuadrada al lado de la redonda. */
  casilla: radio.chip / 2,
} as const;

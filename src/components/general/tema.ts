// NIVL · Modo GENERAL (la base): la piel Ónix. Vidrio sobre el fondo casi
// negro, texto y botón hueso y un solo color además: el hilo de oro que los
// cuatro modos comparten (`acentoRueda.general`). Todo sale de los tokens
// (src/design/tokens.ts): aquí solo se les pone el nombre que usan las piezas.

import { acentoRueda, ink, oro, radio, type as tipo, vidrio } from '@/design/tokens';

/** De la lámina (342) a la app (390): la escala con la que se midieron estas piezas. */
const K = 390 / 342;

/** Una medida de la lámina en puntos de la app (al medio punto). */
export function px(n: number): number {
  return Math.round(n * K * 2) / 2;
}

/** Un tamaño de letra de la lámina en la app: nunca por debajo de 11, el mínimo del sistema. */
export function fs(n: number): number {
  return Math.max(11, px(n));
}

/** El hilo de oro de NIVL. */
export const G: string = acentoRueda.general;

/** Las superficies y las tintas de la base. */
export const C = {
  fondo: ink.ink0,
  tarjeta: vidrio.tarjeta,
  filete: vidrio.borde,
  regla: vidrio.linea,
  borde: vidrio.borde,
  pista: vidrio.pista,
  burbuja: vidrio.campo,
  hueco: vidrio.suave,
  suelo: ink.ink3,
  mudo: ink.ink6,
  meta: ink.ink8,
  suave: ink.ink8,
  apagado: ink.ink6,
  tenue: ink.ink6,
  texto: ink.ink9,
  claro: ink.ink9,
  blanco: ink.ink9,
  barra: ink.ink0,
} as const;

/** Playfair para títulos y cifras; Outfit para todo lo que habla. */
export const F = {
  r: tipo.body.family,
  m: tipo.body.family,
  sb: tipo.micro.family,
  b: tipo.label.family,
  xb: tipo.label.family,
  serif: tipo.number.family,
} as const;

/** Medidas de las piezas. */
export const M = {
  margen: 18,
  hueco: px(7),
  radio: radio.tarjeta,
  radioPeso: radio.control,
  radioBoton: radio.control,
  radioChip: radio.chip,
  boton: 48,
  botonFino: 40,
} as const;

/** El oro con transparencia: cada alfa cae en su escalón de token. */
export function oroA(alfa: number): string {
  if (alfa <= 0.1) return oro.fondo;
  return alfa <= 0.2 ? oro.tenue : oro.borde;
}

/** El velo de oro para lo elegido. En Ónix es transparencia: la base no cuenta. */
export function oroMezcla(p: number, _base?: string): string {
  return p <= 0.1 ? oro.fondo : oro.tenue;
}

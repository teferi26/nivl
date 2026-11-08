// NIVL · Mundo IRON: la piel de IRON en Ónix (docs/design-v2/SISTEMA.md). Todo
// sale de src/design/tokens.ts; aquí solo se le pone nombre corto a lo que las
// pantallas de IRON y de Resistencia usan a cada momento.
//
//   · A: el hilo de oro de los rótulos, las cifras y lo elegido. No rellena botones.
//   · H: el hueso del botón principal y de lo marcado, siempre con texto ink0.
//   · O: los velos y marcos del oro.
//   · R: los radios de Ónix.
//
// `px()` y `fs()` vienen de la lámina original (342 de ancho, medida a 390). Las
// pantallas que no se han rehecho los siguen usando para sus proporciones.

import { ink, modoAcento, oro, radio, vidrio } from '@/design/tokens';

/** De la lámina (342) a la app (390). */
const K = 390 / 342;

/** Una medida de la lámina en puntos de la app (al medio punto). */
export function px(n: number): number {
  return Math.round(n * K * 2) / 2;
}

/** Un tamaño de letra de la lámina en la app: nunca por debajo de 10. */
export function fs(n: number): number {
  return Math.max(11, px(n));
}

export const A = modoAcento.iron;
export const H = ink.ink10;
export const O = oro;
export const R = radio;

/** Superficies, líneas y textos de IRON en la escala de Ónix. */
export const C = {
  fondo: ink.ink0,
  tarjeta: vidrio.tarjeta,
  filete: vidrio.borde,
  regla: vidrio.linea,
  borde: vidrio.borde,
  pista: vidrio.pista,
  burbuja: vidrio.campo,
  hueco: vidrio.campo,
  suelo: ink.ink3,
  mudo: ink.ink6,
  meta: ink.ink8,
  suave: ink.ink8,
  apagado: ink.ink6,
  tenue: ink.ink6,
  texto: ink.ink9,
  claro: ink.ink9,
  blanco: ink.ink9,
  barra: ink.ink1,
} as const;

/** Las familias que carga `_layout`: Outfit para leer, Playfair para las cifras y la marca. */
export const F = {
  r: 'Outfit_400Regular',
  m: 'Outfit_500Medium',
  sb: 'Outfit_600SemiBold',
  b: 'Outfit_700Bold',
  xb: 'Outfit_800ExtraBold',
  serif: 'PlayfairDisplay_700Bold',
} as const;

/** Medidas comunes (las de la maqueta Ónix, a 390 de ancho). */
export const M = {
  margen: 18,
  hueco: 9,
  radio: radio.tarjeta,
  radioPeso: radio.control,
  radioBoton: radio.control,
  radioChip: radio.chip,
  boton: 48,
  botonFino: 40,
} as const;

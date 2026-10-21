// NIVL · Mundo IRON: la piel de la lámina 2 de la P01 («IRON: tu gimnasio,
// nada más», propuestas_modos/p01/propuesta.html). Teferi la aprobó así y
// pidió la app IGUAL que el PDF (FEEDBACK_TEFERI_1011_B32, punto 0): dentro de
// IRON mandan estas medidas, no las del mármol de NIVL.
//
// La lámina dibuja el móvil a 342 px de ancho; la app se mide a 390. Toda
// medida de la lámina pasa por `px()` (× 390/342) y los textos por `fs()`, que
// además no baja de 10 (la lámina llega a 7,5 en las etiquetas).
//
// Un único color además de los grises: el acento de IRON de `modoAcento`
// (azul eléctrico). Los grises son los de la lámina (#0c0c0f de tarjeta,
// #1c1c21 de filete…), que no están en la escala `ink` a propósito: son los
// del mundo IRON y solo viven aquí.

import { modoAcento } from '@/design/tokens';

/** De la lámina (342) a la app (390). */
const K = 390 / 342;

/** Una medida de la lámina en puntos de la app (al medio punto). */
export function px(n: number): number {
  return Math.round(n * K * 2) / 2;
}

/** Un tamaño de letra de la lámina en la app: nunca por debajo de 10. */
export function fs(n: number): number {
  return Math.max(10, px(n));
}

export const A = modoAcento.iron;

/** El acento con transparencia (0 a 1): bordes y brillos de la lámina (`color-mix`). */
export function acentoA(alfa: number): string {
  const n = parseInt(A.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alfa})`;
}

/** `color-mix(in srgb, acento p%, base)` en hex: el fondo del héroe y de lo activo. */
export function mezcla(p: number, base: string): string {
  const a = parseInt(A.slice(1), 16);
  const b = parseInt(base.slice(1), 16);
  const canal = (s: number) => Math.round((((a >> s) & 255) * p + ((b >> s) & 255) * (1 - p)));
  return `#${[16, 8, 0].map((s) => canal(s).toString(16).padStart(2, '0')).join('')}`;
}

/** Los grises de la lámina. */
export const C = {
  fondo: '#000000',
  tarjeta: '#0c0c0f',
  filete: '#1c1c21',
  regla: '#18181d',
  borde: '#23232a',
  pista: '#1b1b20',
  burbuja: '#15151a',
  hueco: '#16161b',
  suelo: '#2a2a30',
  mudo: '#8a8a92',
  meta: '#9a9aa2',
  suave: '#a9a9b0',
  apagado: '#5d5d65',
  tenue: '#66666e',
  texto: '#dddddd',
  claro: '#e6e6e6',
  blanco: '#ffffff',
  barra: '#141418',
} as const;

/** Las familias que carga `_layout` (Outfit 400 a 800, Cinzel 700). */
export const F = {
  r: 'Outfit_400Regular',
  m: 'Outfit_500Medium',
  sb: 'Outfit_600SemiBold',
  b: 'Outfit_700Bold',
  xb: 'Outfit_800ExtraBold',
  cinzel: 'Cinzel_700Bold',
} as const;

/** Medidas de la lámina ya pasadas a la app. */
export const M = {
  margen: px(14),
  hueco: px(7),
  radio: px(16),
  radioPeso: px(13),
  radioBoton: px(11),
  radioChip: px(10),
  boton: px(32),
  botonFino: px(26),
} as const;

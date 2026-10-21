// NIVL · Modo GENERAL (la base): la piel de la lámina 4 de la P01 («NIVL: el
// cuartel general»). Las mismas medidas y grises que los mundos (se toman de
// la piel de IRON, la referencia aprobada: tarjeta #0c0c0f, filete #1c1c21,
// Outfit y Cinzel) y un solo color además de los grises: el oro de NIVL
// (`acentoRueda.general`), con el hueso de los textos.

import { acentoRueda } from '@/design/tokens';

export { C, F, fs, M, px } from '@/components/ironmundo/tema';

/** El oro de NIVL. */
export const G: string = acentoRueda.general;

/** El oro con transparencia (0 a 1): bordes, halos y fondos tenues. */
export function oroA(alfa: number): string {
  const n = parseInt(G.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alfa})`;
}

/** `color-mix(in srgb, oro p, base)` en hex: el fondo del héroe y de lo elegido. */
export function oroMezcla(p: number, base: string): string {
  const a = parseInt(G.slice(1), 16);
  const b = parseInt(base.slice(1), 16);
  const canal = (s: number) => Math.round(((a >> s) & 255) * p + ((b >> s) & 255) * (1 - p));
  return `#${[16, 8, 0].map((s) => canal(s).toString(16).padStart(2, '0')).join('')}`;
}

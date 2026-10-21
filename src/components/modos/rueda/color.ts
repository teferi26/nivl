// NIVL · Modos: mezclas del acento para la rueda, el emblema y la cabecera.
//
// La lámina P01 usa `color-mix(in srgb, acento N%, #000)` y transparencias del
// acento para fondos, halos y bordes. Aquí, lo mismo con hex de 6 cifras.

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `hex` con transparencia `a` (0 a 1), como rgba. */
export function conAlfa(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** `color-mix(in srgb, hex t, base)`: t = 0 es la base, 1 el color. */
export function mezcla(hex: string, t: number, base = '#000000'): string {
  const a = rgb(hex);
  const b = rgb(base);
  const c = a.map((v, i) => Math.round(b[i] + (v - b[i]) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Halo de la lámina (`box-shadow: 0 0 Npx acento`), para `boxShadow` de RN 0.81. */
export function halo(hex: string, radio: number, a: number, anillo?: { ancho: number; color: string }): string {
  const sombra = `0px 0px ${radio}px ${conAlfa(hex, a)}`;
  return anillo ? `0px 0px 0px ${anillo.ancho}px ${anillo.color}, ${sombra}` : sombra;
}

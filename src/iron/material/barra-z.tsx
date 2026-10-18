// NIVL · IRON · Material: la barra Z (equipo brazos, fase 2).
//
// Con la cámara en 3/4 la barra se ve como un tramo que sale del agarre hacia
// el disco cercano (ver `VistaBarra` en src/iron/tipos.ts). En la barra Z ese
// tramo no es recto: las dos ondas del agarre (las que dejan la muñeca en
// semisupinación) se dibujan como un zigzag suave antes del manguito recto
// donde va el disco. Solo trazado: el disco lo pone el motor (dibujo.ts).
// Puro y 'worklet'; cada función va después de las que llama.

import type { Punto } from '../esqueleto';

/** Grosor del tubo y amplitud de las ondas, en unidades de cuerpo. */
const GROSOR = 1.5;
const ONDA = 1.3;

function cifra(v: number): string {
  'worklet';
  return (Math.round(v * 10) / 10).toString();
}

function punto(p: Punto): string {
  'worklet';
  return `${cifra(p.x)} ${cifra(-p.y)}`;
}

/**
 * Trazado del tramo de barra Z que va de `c` (el agarre) a `c + eje`.
 * Línea central: dos ondas en el primer 55 % (donde van las manos) y el resto
 * recto; se engorda a los dos lados para hacer un tubo cerrado.
 */
export function tramoBarraZ(c: Punto, eje: Punto): string {
  'worklet';
  const largo = Math.hypot(eje.x, eje.y);
  if (largo === 0) return '';
  const u = { x: eje.x / largo, y: eje.y / largo };
  const n = { x: -u.y, y: u.x };
  // Desde un poco antes del agarre (que el puño quede dentro de la onda).
  const t0 = -1.5;
  const t1 = largo + 1.5;
  const N = 24;
  const ida: Punto[] = [];
  const vuelta: Punto[] = [];
  for (let i = 0; i <= N; i++) {
    const t = t0 + ((t1 - t0) * i) / N;
    const f = (t - t0) / (largo * 0.55);
    // Dos ondas: sube, baja, sube y se queda en el centro (seno con fin suave).
    const desv = f < 1 ? ONDA * Math.sin(f * Math.PI * 2) * Math.sin(f * Math.PI) : 0;
    const cx = c.x + u.x * t + n.x * desv;
    const cy = c.y + u.y * t + n.y * desv;
    ida.push({ x: cx + n.x * (GROSOR / 2), y: cy + n.y * (GROSOR / 2) });
    vuelta.push({ x: cx - n.x * (GROSOR / 2), y: cy - n.y * (GROSOR / 2) });
  }
  vuelta.reverse();
  const pts = ida.concat(vuelta);
  let d = `M${punto(pts[0])}`;
  for (let i = 1; i < pts.length; i++) d += `L${punto(pts[i])}`;
  return `${d}Z`;
}

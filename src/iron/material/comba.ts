// NIVL · IRON · Material (core): la comba.
//
// Vista lateral. La cuerda gira alrededor del eje que une las dos manos: de
// perfil, toda ella cae en la línea que va de las manos al punto más lejano
// del lazo, que recorre una elipse (abajo, detrás, arriba y delante: el giro
// normal, hacia delante). Se dibuja un poco arqueada hacia atrás del giro,
// como una cuerda que arrastra el aire, y sin bajar del suelo.
// · `cuerdaComba`: la cuerda, en la capa de detrás del cuerpo (no tapa ni la
//   cabeza ni el torso).
// · `manijaComba`: el mango en el puño.
// `fase` es la fracción del ciclo (0 a 1); con fase 0 la cuerda pasa bajo
// los pies: el ejercicio pone ahí el punto más alto del salto.

import type { Esqueleto, Punto } from '../esqueleto';
import { barraMat, cintaMat } from './trazo';

/** Semiejes de la elipse que recorre el lazo y su centro respecto a las manos. */
export const LAZO_COMBA = { rx: 30, ry: 60, dx: -2, dy: 6 } as const;

/** Altura mínima de la cuerda: roza el suelo, no lo atraviesa. */
const RAS = 0.4;

/** Las manos: el punto medio de los dos puños. */
export function manosComba(e: Esqueleto): Punto {
  'worklet';
  return { x: (e.p.agarre_c.x + e.p.agarre_l.x) / 2, y: (e.p.agarre_c.y + e.p.agarre_l.y) / 2 };
}

/** El punto más lejano del lazo en una fase de giro (en vueltas, de 0 a 1). */
export function apiceComba(manos: Punto, giro: number): Punto {
  'worklet';
  const th = giro * Math.PI * 2;
  const cx = manos.x + LAZO_COMBA.dx;
  const cy = manos.y + LAZO_COMBA.dy;
  return { x: cx - Math.sin(th) * LAZO_COMBA.rx, y: Math.max(RAS, cy - Math.cos(th) * LAZO_COMBA.ry) };
}

/** En qué vuelta va la cuerda (0 a 1) en una fase del ciclo. */
export function giroComba(fase: number, vueltas: number): number {
  'worklet';
  return (((fase * vueltas) % 1) + 1) % 1;
}

export function cuerdaComba(e: Esqueleto, fase: number, vueltas: number): string {
  'worklet';
  const giro = giroComba(fase, vueltas);
  const h = manosComba(e);
  const a = apiceComba(h, giro);
  // Arrastre: el medio de la cuerda se queda atrás respecto al sentido de giro.
  const th = giro * Math.PI * 2;
  const vx = -Math.cos(th) * LAZO_COMBA.rx;
  const vy = Math.sin(th) * LAZO_COMBA.ry;
  const lv = Math.hypot(vx, vy) || 1;
  const q = { x: (h.x + a.x) / 2 - (vx / lv) * 7, y: (h.y + a.y) / 2 - (vy / lv) * 7 };
  const linea: Punto[] = [];
  const N = 16;
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const u = 1 - s;
    linea.push({ x: u * u * h.x + 2 * u * s * q.x + s * s * a.x, y: Math.max(RAS, u * u * h.y + 2 * u * s * q.y + s * s * a.y) });
  }
  return cintaMat(linea, 0.8);
}

export function manijaComba(e: Esqueleto, lado: 'c' | 'l'): string {
  'worklet';
  const c = lado === 'c' ? e.p.agarre_c : e.p.agarre_l;
  const ang = (lado === 'c' ? e.a.antebrazo_c : e.a.antebrazo_l) * (Math.PI / 180);
  const d = { x: Math.cos(ang), y: Math.sin(ang) };
  return barraMat({ x: c.x + d.x * 1.2, y: c.y + d.y * 1.2 }, d, 7, 1.8);
}

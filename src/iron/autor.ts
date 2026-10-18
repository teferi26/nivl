// NIVL · IRON · Ayudas para escribir poses (no se usan en la app).
//
// Las poses se guardan como ángulos de articulación, pero se piensan mejor
// en el espacio: «la mano en la barra», «el pie plano», «el antebrazo
// vertical». Estas funciones despejan los ángulos a partir de eso y se usan
// desde un script o una prueba al escribir un ejercicio nuevo (ver
// docs/modos/F1-motor.md, «Cómo se añade un ejercicio»).

import type { Punto } from './esqueleto';

/** Normaliza un ángulo a (-180, 180]. */
export function normalizar(a: number): number {
  const r = ((a % 360) + 360) % 360;
  return r > 180 ? r - 360 : r;
}

/**
 * Cinemática inversa de dos eslabones (brazo y antebrazo, muslo y pierna):
 * desde `origen`, con largos `l1` y `l2`, llegar a `objetivo`. `codoAbajo`
 * elige cuál de las dos soluciones. Devuelve los ángulos absolutos de los dos
 * segmentos y dónde queda la articulación del medio.
 */
export function ikDosEslabones(
  origen: Punto,
  objetivo: Punto,
  l1: number,
  l2: number,
  codoAbajo: boolean,
): { a1: number; a2: number; medio: Punto; alcanza: boolean } {
  const dx = objetivo.x - origen.x;
  const dy = objetivo.y - origen.y;
  const d = Math.hypot(dx, dy);
  const alcanza = d <= l1 + l2 && d >= Math.abs(l1 - l2);
  const dd = Math.min(Math.max(d, Math.abs(l1 - l2) + 1e-6), l1 + l2 - 1e-6);
  const base = Math.atan2(dy, dx);
  const c = (l1 * l1 + dd * dd - l2 * l2) / (2 * l1 * dd);
  const al = Math.acos(Math.max(-1, Math.min(1, c)));
  const a1 = base + (codoAbajo ? -al : al);
  const medio = { x: origen.x + l1 * Math.cos(a1), y: origen.y + l1 * Math.sin(a1) };
  const a2 = Math.atan2(objetivo.y - medio.y, objetivo.x - medio.x);
  return { a1: (a1 * 180) / Math.PI, a2: (a2 * 180) / Math.PI, medio, alcanza };
}

/**
 * De ángulos absolutos (los del dibujo) a ángulos de articulación, con las
 * mismas fórmulas que el esqueleto (src/iron/esqueleto.ts, vista lateral).
 */
export const articulacion = {
  hombro: (tronco: number, brazo: number) => normalizar(brazo - tronco - 180),
  codo: (brazo: number, antebrazo: number) => normalizar(antebrazo - brazo),
  cadera: (tronco: number, muslo: number) => normalizar(muslo - tronco - 180),
  rodilla: (muslo: number, pierna: number) => normalizar(muslo - pierna),
  tobillo: (pierna: number, pie: number) => normalizar(pie - pierna - 90),
  cuello: (tronco: number, cabeza: number) => normalizar(tronco - cabeza),
};

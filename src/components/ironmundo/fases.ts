// NIVL · Mundo IRON: las tres fases de la técnica (SUBE · BAJA · FONDO) de la
// lámina 2, sacadas del ciclo del motor (puro, con test). El motor ya sabe la
// fase de esfuerzo (la concéntrica) y la pose clave que se enseña quieta (la
// más exigente): de ahí salen los tres tramos, sea cual sea el número de poses.
//   · SUBE: dentro de una fase de esfuerzo (la carga sube).
//   · FONDO: alrededor de la pose clave (msFicha o la pose central), hasta que
//     empieza el esfuerzo.
//   · BAJA: el resto del ciclo (la excéntrica y la vuelta).

import type { Ejercicio } from '@/iron/tipos';

export type FaseTecnica = 'sube' | 'baja' | 'fondo';
export const FASES_TECNICA: readonly FaseTecnica[] = ['sube', 'baja', 'fondo'];

type EjFases = Pick<Ejercicio, 'cicloMs' | 'esfuerzo' | 'poses' | 'msFicha' | 'tipo'>;

/** El instante clave (el mismo que pinta el maniquí quieto). */
export function msClave(ej: Pick<Ejercicio, 'msFicha' | 'poses'>): number {
  return ej.msFicha ?? ej.poses[Math.floor(ej.poses.length / 2)]!.ms;
}

/** La ventana del fondo: desde un poco antes de la pose clave hasta el siguiente esfuerzo. */
function ventanaFondo(ej: EjFases): { desde: number; hasta: number } {
  const clave = msClave(ej);
  const margen = ej.cicloMs * 0.06;
  const siguiente = ej.esfuerzo.map((f) => f.desde).filter((d) => d >= clave).sort((a, b) => a - b)[0];
  return { desde: clave - margen, hasta: siguiente ?? clave + margen };
}

export function faseEn(ej: EjFases, ms: number): FaseTecnica {
  const t = ((ms % ej.cicloMs) + ej.cicloMs) % ej.cicloMs;
  if (ej.tipo === 'isometrico') return 'fondo';
  if (ej.esfuerzo.some((f) => t >= f.desde && t <= f.hasta)) return 'sube';
  const f = ventanaFondo(ej);
  if (t >= f.desde && t < f.hasta) return 'fondo';
  return 'baja';
}

/** Dos poses fantasma: la de salida y la de mitad de la bajada (la lámina). */
export function msFantasmas(ej: Pick<Ejercicio, 'msFicha' | 'poses'>): [number, number] {
  const inicio = ej.poses[0]!.ms;
  const clave = msClave(ej);
  return [inicio, inicio + (clave - inicio) / 2];
}

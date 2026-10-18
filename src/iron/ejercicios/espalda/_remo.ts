// NIVL · IRON · ESPALDA: lo común de los remos de pie (barra y mancuernas).
//
// Postura fija de bisagra: el tronco inclinado, rodillas dobladas y la carga
// colgando bajo los hombros, sobre el medio del pie. Solo se mueven los
// brazos: abajo cuelgan rectos y arriba el puño llega al tronco (el codo pasa
// la línea de la espalda). El archivo empieza por «_»: no es un ejercicio.

import type { Punto } from '../../esqueleto';
import type { Pose } from '../../tipos';
import { bisagra, brazoHasta, pose, sobreTronco, type Absolutos } from './_pose';

export interface Remo {
  abajo: Absolutos;
  medio: Absolutos;
  arriba: Absolutos;
  hombro: Punto;
  cadera: Punto;
}

/**
 * `tronco`: inclinación; `mano`: dónde cuelga el puño abajo (sobre el medio
 * del pie); `brazo`: ángulo del brazo abajo (-90 = vertical); `t` y
 * `separacion`: adónde llega el puño arriba (sobre el tronco).
 */
export function remo(o: { tronco: number; mano: Punto; brazo?: number; cabeza?: number; t: number; separacion: number }): Remo {
  const b = bisagra({ tronco: o.tronco, brazo: o.brazo ?? -90, mano: o.mano, cabeza: o.cabeza });
  const fin = sobreTronco(b.cadera, o.tronco, o.t, o.separacion);
  const mitad = { x: (o.mano.x + fin.x) / 2 + 1, y: (o.mano.y + fin.y) / 2 };
  return {
    abajo: b.abs,
    medio: { ...b.abs, ...brazoHasta(b.hombro, mitad, true) },
    arriba: { ...b.abs, ...brazoHasta(b.hombro, fin, true) },
    hombro: b.hombro,
    cadera: b.cadera,
  };
}

/** Ciclo de remo: pausa abajo, tirón, pausa arriba y bajada más lenta. */
export function posesRemo(r: Remo): Pose[] {
  return [pose(0, r.abajo), pose(400, r.abajo), pose(850, r.medio), pose(1300, r.arriba), pose(1650, r.arriba), pose(2500, r.medio)];
}
export const CICLO_REMO = 3400;
export const ESFUERZO_REMO = [{ desde: 400, hasta: 1300 }] as const;

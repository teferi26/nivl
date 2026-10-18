// NIVL · IRON · Extensión de tríceps en polea alta con cuerda, de pie.
//
// Ronda 2 (polea y cuerda del equipo espalda). Tronco algo inclinado hacia
// delante y quieto, brazos pegados al costado y quietos: solo se mueve el
// antebrazo, de doblado (por encima de los 90°) a estirado del todo, abriendo
// la cuerda abajo. El cable baja de la polea alta, delante de la cara.
// Biomecánica (src/iron/__tests__/ronda2.test.ts): brazo quieto (±2°) y casi
// vertical, codo de ≥ 95° a ≤ 8°, el cable no toca la cabeza.

import type { Ejercicio } from '../../tipos';
import { ANCLA_DE_PIE, desde, hombroEn, pose, type Absolutos } from '../espalda/_pose';
import { textos } from './comun';

const CUERPO = { tronco: 76, cabeza: 84, muslo: -80, pierna: -96, pie: 0 } as const;
const BRAZO = -88;
const con = (codo: number): Absolutos => ({ ...CUERPO, brazo: BRAZO, antebrazo: BRAZO + codo });
const ARRIBA = con(102);
const MEDIO = con(55);
const ABAJO = con(4);
const HOMBRO = hombroEn(ANCLA_DE_PIE, pose(0, ARRIBA));
/** Polea alta, delante y por encima de la cabeza. */
const POLEA = desde(HOMBRO, 62, 40);
const T = textos('extension-triceps-polea', ['codos', 'abajo', 'tronco'], ['codosSeAbren', 'hombros']);

export const extensionTricepsPolea: Ejercicio = {
  id: 'extension-triceps-polea',
  nombre: T.nombre,
  grupo: 'brazo',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['polea'],
  musculos: { principales: ['triceps'], secundarios: ['antebrazo', 'abdomen'] },
  sustitutos: ['press-frances-mancuerna', 'patada-triceps', 'fondos-banco'],
  vista: 'lateral',
  ancla: ANCLA_DE_PIE,
  poses: [pose(0, ARRIBA), pose(300, ARRIBA), pose(800, MEDIO), pose(1300, ABAJO), pose(1600, ABAJO), pose(2600, MEDIO)],
  cicloMs: 3600,
  esfuerzo: [{ desde: 300, hasta: 1300 }],
  msFicha: 1300,
  carga: { tipo: 'polea', agarre: 'cuerda', polea: { x: Math.round(POLEA.x * 10) / 10, y: Math.round(POLEA.y * 10) / 10 }, lados: ['cerca'] },
  escenario: [{ tipo: 'polea', x: Math.round(POLEA.x * 10) / 10 + 3, y: Math.round(POLEA.y * 10) / 10, hacia: -1, alto: Math.round(POLEA.y) + 10, capa: 'fondo' }],
  encuadre: { x: -34, y: -4, ancho: 88, alto: 130 },
  cues: T.cues,
  errores: T.errores,
};

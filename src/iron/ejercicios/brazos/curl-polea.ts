// NIVL · IRON · Curl de bíceps en polea baja con barra, de pie, vista lateral.
//
// Ronda 2 (polea del equipo espalda). La misma técnica que el curl con barra
// (curl-barra.ts): codos junto al costado, solo se mueve el antebrazo y la
// bajada es más lenta. El cable sale de la polea baja que hay delante y tira
// de la barra hacia ella durante todo el recorrido (tensión también abajo).
// Biomecánica (src/iron/__tests__/ronda2.test.ts): hombro de 0 a 20°, tronco
// quieto, ≥ 115° de codo, el cable no cruza el cuerpo ni la cabeza.

import type { Ejercicio, Extremidades } from '../../tipos';
import { ANCLA_DE_PIE, DE_PIE, pose, textos } from './comun';

const ABAJO: Extremidades = { ...DE_PIE, hombro: 9, codo: 4 };
const ARRIBA: Extremidades = { ...DE_PIE, hombro: 17, codo: 136 };
/** La rueda de la polea baja, delante de los pies. */
export const POLEA_BAJA = { x: 34, y: 7 } as const;
const T = textos('curl-polea', ['codos', 'cerca', 'bajada'], ['balanceo', 'codosDelante']);

export const curlPolea: Ejercicio = {
  id: 'curl-polea',
  nombre: T.nombre,
  grupo: 'brazo',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['polea'],
  musculos: { principales: ['biceps'], secundarios: ['braquial', 'braquiorradial', 'antebrazo'] },
  sustitutos: ['curl-barra', 'curl-barra-z', 'curl-biceps-mancuerna'],
  vista: 'lateral',
  ancla: ANCLA_DE_PIE,
  poses: [pose(0, ABAJO), pose(400, ABAJO), pose(1600, ARRIBA), pose(1900, ARRIBA)],
  cicloMs: 3900,
  esfuerzo: [{ desde: 400, hasta: 1600 }],
  msFicha: 1100,
  carga: { tipo: 'polea', agarre: 'barra', polea: POLEA_BAJA, lados: ['cerca'], eje: { x: 6, y: -4 } },
  escenario: [{ tipo: 'polea', x: POLEA_BAJA.x + 3, y: POLEA_BAJA.y, hacia: -1, alto: 96, capa: 'fondo' }],
  encuadre: { x: -36, y: -4, ancho: 84, alto: 112 },
  cues: T.cues,
  errores: T.errores,
};

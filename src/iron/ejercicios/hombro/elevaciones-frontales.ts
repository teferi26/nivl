// NIVL · IRON · Hombro · Elevaciones frontales con mancuernas, de pie, vista lateral.
//
// Biomecánica (src/iron/__tests__/hombro.test.ts):
// · Flexión de hombro de ~8° (mancuernas delante de los muslos) a 90° (la
//   mano a la altura del hombro, no más arriba).
// · Codo casi estirado y fijo (≤ 15°).
// · Tronco quieto (sin balanceo hacia atrás); bajada más lenta que la subida.
// Agarre prono: la mancuerna se ve de punta.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';
import { ANCLA_PIE_LATERAL, conBrazos, PIERNAS_PIE_LATERAL } from './comun';

export const FRONTAL_ABAJO: Extremidades = conBrazos(PIERNAS_PIE_LATERAL, 8, 8);
export const FRONTAL_ARRIBA: Extremidades = conBrazos(PIERNAS_PIE_LATERAL, 90, 8);

const pose = (ms: number, cerca: Extremidades): Pose => ({ ms, cuello: 0, cerca });
export const POSES_FRONTAL: readonly Pose[] = [
  pose(0, FRONTAL_ABAJO),
  pose(300, FRONTAL_ABAJO),
  pose(1300, FRONTAL_ARRIBA),
  pose(1600, FRONTAL_ARRIBA),
];

export const elevacionesFrontales: Ejercicio = {
  id: 'elevaciones-frontales',
  nombre: 'iron-hombro:ejercicios.elevaciones-frontales.nombre',
  grupo: 'hombro',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['mancuerna'],
  musculos: {
    principales: ['deltoides_anterior'],
    secundarios: ['deltoides_lateral', 'pectoral', 'trapecio'],
  },
  sustitutos: ['elevacion-frontal-barra', 'elevacion-frontal-banda'],
  vista: 'lateral',
  ancla: ANCLA_PIE_LATERAL,
  poses: POSES_FRONTAL,
  cicloMs: 3700,
  esfuerzo: [{ desde: 300, hasta: 1300 }],
  msFicha: 1450,
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'punta', lados: ['cerca', 'lejos'] },
  encuadre: { x: -32, y: -4, ancho: 96, alto: 112 },
  cues: [
    'iron-hombro:ejercicios.elevaciones-frontales.cues.altura',
    'iron-hombro:ejercicios.elevaciones-frontales.cues.tronco',
    'iron-hombro:ejercicios.elevaciones-frontales.cues.bajada',
  ],
  errores: [
    'iron-hombro:ejercicios.elevaciones-frontales.errores.balanceo',
    'iron-hombro:ejercicios.elevaciones-frontales.errores.alto',
  ],
};

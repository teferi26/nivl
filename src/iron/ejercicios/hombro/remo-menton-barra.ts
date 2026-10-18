// NIVL · IRON · Hombro · Remo al mentón con barra, agarre al ancho de hombros.
//
// Vista FRONTAL: los codos suben por fuera y eso de perfil no se ve.
// Biomecánica (src/iron/__tests__/hombro.test.ts):
// · Las manos suben en vertical pegadas al cuerpo, de los muslos a la parte
//   baja del pecho (no hasta el mentón: así el hombro no se pinza).
// · Los codos por encima de las manos todo el recorrido y, arriba, a la
//   altura del hombro como mucho (abducción ≤ 90°).
// · Agarre al ancho de hombros, no estrecho. Tronco quieto.
// Los codos van algo por delante del tronco: brazo en escorzo (0,89).

import type { Ejercicio, Extremidades, Pose } from '../../tipos';
import { ANCLA_PIE_FRONTAL, conBrazos, PIERNAS_PIE_FRONTAL } from './comun';

// Despejados con la mano en x = ±13 (ancho de hombros) a 48,5, 57, 65 y 72 de altura.
const PASOS: readonly (readonly [number, number])[] = [
  [11.7, -20.6],
  [46.4, -84.6],
  [66.6, -118.7],
  [85, -144.2],
];

const pose = (ms: number, [hombro, codo]: readonly [number, number]): Pose => ({
  ms,
  cuello: 0,
  cerca: conBrazos(PIERNAS_PIE_FRONTAL, hombro, codo) as Extremidades,
  escorzo: { brazo_c: 0.89, brazo_l: 0.89 },
});

export const POSES_REMO_MENTON: readonly Pose[] = [
  pose(0, PASOS[0]),
  pose(300, PASOS[0]),
  pose(650, PASOS[1]),
  pose(950, PASOS[2]),
  pose(1250, PASOS[3]),
  pose(1550, PASOS[3]),
  pose(2050, PASOS[2]),
  pose(2550, PASOS[1]),
];

export const remoMentonBarra: Ejercicio = {
  id: 'remo-menton-barra',
  nombre: 'iron-hombro:ejercicios.remo-menton-barra.nombre',
  grupo: 'hombro',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['barra'],
  musculos: {
    principales: ['deltoides_lateral'],
    secundarios: ['trapecio', 'deltoides_anterior', 'biceps', 'antebrazo'],
  },
  sustitutos: ['remo-menton-mancuerna', 'remo-menton-banda', 'elevaciones-laterales'],
  vista: 'frontal',
  ancla: ANCLA_PIE_FRONTAL,
  poses: POSES_REMO_MENTON,
  cicloMs: 3300,
  esfuerzo: [{ desde: 300, hasta: 1250 }],
  msFicha: 1400,
  carga: { tipo: 'barra', en: 'agarre' },
  encuadre: { x: -54, y: -4, ancho: 108, alto: 112 },
  cues: [
    'iron-hombro:ejercicios.remo-menton-barra.cues.agarre',
    'iron-hombro:ejercicios.remo-menton-barra.cues.codos',
    'iron-hombro:ejercicios.remo-menton-barra.cues.altura',
  ],
  errores: [
    'iron-hombro:ejercicios.remo-menton-barra.errores.estrecho',
    'iron-hombro:ejercicios.remo-menton-barra.errores.alto',
    'iron-hombro:ejercicios.remo-menton-barra.errores.balanceo',
  ],
};

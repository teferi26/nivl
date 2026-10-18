// NIVL · IRON · Crunch inverso en esterilla, vista lateral (cabeza a la izquierda).
//
// Tumbado boca arriba con cadera y rodillas a 90° y los brazos en el suelo.
// Se enrolla la pelvis: las rodillas van al pecho y los glúteos se despegan
// un poco; se baja despacio sin dejar caer las piernas.
// Biomecánica (comprobada en src/iron/__tests__/core.test.ts):
// · Hombros y cabeza quietos en la esterilla (el ancla es el hombro).
// · Los brazos siguen apoyados en el suelo (el hombro compensa el tronco).
// · La cadera sube poco (≤ 10 unidades): se enrolla, no se lanza.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

// Brazos en el suelo: el ángulo del brazo en el mundo no cambia.
const ABAJO: Extremidades = { cadera: 87.3, rodilla: 90, tobillo: -15, hombro: -7.7, codo: 0 };
const ARRIBA: Extremidades = { cadera: 107.3, rodilla: 100, tobillo: -15, hombro: -22.7, codo: 0 };

const pose = (ms: number, cerca: Extremidades, angulo: number, cuello: number): Pose => ({ ms, cerca, angulo, cuello });

export const crunchInverso: Ejercicio = {
  id: 'crunch-inverso',
  nombre: 'iron-core:ejercicios.crunch-inverso.nombre',
  grupo: 'core',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['esterilla'],
  musculos: {
    principales: ['abdomen'],
    secundarios: ['oblicuos', 'transverso'],
  },
  sustitutos: ['elevaciones-piernas', 'crunch', 'dead-bug'],
  vista: 'lateral',
  ancla: { punto: 'hombro', x: -30, y: 8, segmento: 'tronco', angulo: 182.7 },
  poses: [
    pose(0, ABAJO, 182.7, 0),
    pose(300, ABAJO, 182.7, 0),
    pose(1100, ARRIBA, 197.7, 15),
    pose(1400, ARRIBA, 197.7, 15),
  ],
  cicloMs: 3000,
  esfuerzo: [{ desde: 300, hasta: 1100 }],
  msFicha: 1250,
  escenario: [{ tipo: 'esterilla', x: -50, ancho: 92, alto: 0.8, capa: 'fondo' }],
  encuadre: { x: -54, y: -4, ancho: 92, alto: 72 },
  cues: [
    'iron-core:ejercicios.crunch-inverso.cues.brazos',
    'iron-core:ejercicios.crunch-inverso.cues.pelvis',
    'iron-core:ejercicios.crunch-inverso.cues.bajada',
  ],
  errores: [
    'iron-core:ejercicios.crunch-inverso.errores.impulso',
    'iron-core:ejercicios.crunch-inverso.errores.caida',
  ],
};

// NIVL · IRON · Dead bug (bicho muerto), vista lateral (cabeza a la izquierda).
//
// Boca arriba, brazos hacia el techo y cadera y rodillas a 90° (mesa). Se
// estiran a la vez un brazo por encima de la cabeza y la pierna contraria
// hasta casi rozar el suelo, se vuelve y se cambia de lado.
// Biomecánica (comprobada en src/iron/__tests__/core.test.ts):
// · Tronco y cadera quietos: la espalda no se arquea (el ancla es la cadera).
// · Siempre brazo y pierna contrarios: cerca el brazo con lejos la pierna.
// · La pierna estirada no toca el suelo.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const MESA: Extremidades = { cadera: 87.3, rodilla: 90, tobillo: -10, hombro: 87.3, codo: 0 };
/** Brazo por encima de la cabeza (en diagonal, sin tapar la cara) y pierna mesa. */
const BRAZO: Extremidades = { ...MESA, hombro: 132.3 };
/** Pierna estirada a unos 10° del suelo y brazo al techo. */
const PIERNA: Extremidades = { ...MESA, cadera: 7.3, rodilla: 0, tobillo: -25 };

const pose = (ms: number, cerca: Extremidades, lejos: Extremidades): Pose => ({ ms, cerca, lejos, cuello: 0 });

export const deadBug: Ejercicio = {
  id: 'dead-bug',
  nombre: 'iron-core:ejercicios.dead-bug.nombre',
  grupo: 'core',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['esterilla'],
  musculos: {
    principales: ['transverso', 'abdomen'],
    secundarios: ['oblicuos', 'cuadriceps', 'deltoides_anterior'],
  },
  sustitutos: ['bird-dog', 'hollow-hold', 'crunch'],
  vista: 'lateral',
  ancla: { punto: 'cadera', x: 0, y: 9.4, segmento: 'tronco', angulo: 182.7 },
  poses: [
    pose(0, MESA, MESA),
    pose(300, MESA, MESA),
    pose(1400, BRAZO, PIERNA),
    pose(1800, BRAZO, PIERNA),
    pose(2900, MESA, MESA),
    pose(3200, MESA, MESA),
    pose(4300, PIERNA, BRAZO),
    pose(4700, PIERNA, BRAZO),
  ],
  cicloMs: 5800,
  esfuerzo: [
    { desde: 300, hasta: 1400 },
    { desde: 3200, hasta: 4300 },
  ],
  msFicha: 1600,
  escenario: [{ tipo: 'esterilla', x: -60, ancho: 118, alto: 0.8, capa: 'fondo' }],
  encuadre: { x: -78, y: -4, ancho: 136, alto: 64 },
  cues: [
    'iron-core:ejercicios.dead-bug.cues.lumbar',
    'iron-core:ejercicios.dead-bug.cues.contrarios',
    'iron-core:ejercicios.dead-bug.cues.lento',
  ],
  errores: [
    'iron-core:ejercicios.dead-bug.errores.arco',
    'iron-core:ejercicios.dead-bug.errores.prisa',
  ],
};

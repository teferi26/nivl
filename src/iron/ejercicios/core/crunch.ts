// NIVL · IRON · Crunch abdominal en esterilla, vista lateral (cabeza a la izquierda).
//
// Tumbado boca arriba, rodillas dobladas y pies planos; brazos cruzados
// sobre el pecho. Se despegan los hombros del suelo enrollando el tronco
// unos 25° y se baja despacio.
// Biomecánica (comprobada en src/iron/__tests__/core.test.ts):
// · La cadera no se mueve y los pies siguen planos en la esterilla: sube el
//   tronco, no las piernas (el ángulo de cadera compensa el del tronco).
// · Recorrido corto: el tronco sube entre 18 y 30°; no es un sit-up.
// · Barbilla un poco metida arriba (cuello 12°); abajo la cabeza apoya.
// El tronco del motor es rígido: el enrollado se dibuja como un giro desde
// la cadera, que es lo más parecido sin columna articulada.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const PIERNA = { rodilla: 114.8, tobillo: -22.6 } as const;
// Cadera y hombro despejados para que pies y brazos sigan quietos en el mundo.
const ABAJO: Extremidades = { ...PIERNA, cadera: 44.7, hombro: 25, codo: 148 };
const ARRIBA: Extremidades = { ...PIERNA, cadera: 67.4, hombro: 31, codo: 148 };

const pose = (ms: number, cerca: Extremidades, angulo: number, cuello: number): Pose => ({ ms, cerca, angulo, cuello });

export const crunch: Ejercicio = {
  id: 'crunch',
  nombre: 'iron-core:ejercicios.crunch.nombre',
  grupo: 'core',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['esterilla'],
  musculos: {
    principales: ['abdomen'],
    secundarios: ['oblicuos', 'transverso', 'cuello'],
  },
  sustitutos: ['crunch-inverso', 'dead-bug', 'elevaciones-piernas'],
  vista: 'lateral',
  // Cadera apoyada en la esterilla; el tronco algo inclinado para que la espalda alta toque.
  ancla: { punto: 'cadera', x: 0, y: 9.4, segmento: 'tronco', angulo: 182.7 },
  poses: [
    pose(0, ABAJO, 182.7, 0),
    pose(300, ABAJO, 182.7, 0),
    pose(1100, ARRIBA, 160, 12),
    pose(1500, ARRIBA, 160, 12),
  ],
  cicloMs: 3000,
  esfuerzo: [{ desde: 300, hasta: 1100 }],
  msFicha: 1300,
  escenario: [{ tipo: 'esterilla', x: -50, ancho: 92, alto: 0.8, capa: 'fondo' }],
  encuadre: { x: -52, y: -4, ancho: 96, alto: 50 },
  cues: [
    'iron-core:ejercicios.crunch.cues.pies',
    'iron-core:ejercicios.crunch.cues.subir',
    'iron-core:ejercicios.crunch.cues.cuello',
  ],
  errores: [
    'iron-core:ejercicios.crunch.errores.cuello',
    'iron-core:ejercicios.crunch.errores.impulso',
    'iron-core:ejercicios.crunch.errores.situp',
  ],
};

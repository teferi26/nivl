// NIVL · IRON · Bird dog (cuadrupedia con brazo y pierna contrarios), vista lateral.
//
// A cuatro patas: rodillas bajo la cadera, manos un poco por delante de los
// hombros y los dedos de los pies apoyados. Se estiran a la vez un brazo
// al frente y la pierna contraria atrás, en línea con el tronco, y se vuelve.
// Biomecánica (comprobada en src/iron/__tests__/core.test.ts):
// · El tronco no se mueve ni gira (ancla en la cadera, ángulo fijo).
// · La rodilla de apoyo sigue en la esterilla y la mano de apoyo, en el suelo.
// · Arriba, brazo y pierna casi horizontales: no se sube la pierna por
//   encima de la cadera arqueando la zona lumbar.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const APOYO: Extremidades = { cadera: 72.4, rodilla: 109.4, tobillo: 19.1, hombro: 76.8, codo: 18.9 };
/** El brazo estirado al frente, un poco por debajo de la horizontal (no tapa la cara). */
const BRAZO: Extremidades = { ...APOYO, hombro: 148, codo: 0 };
/** La pierna estirada atrás, a la altura de la cadera. */
const PIERNA: Extremidades = { ...APOYO, cadera: -18, rodilla: 0, tobillo: -15 };

const pose = (ms: number, cerca: Extremidades, lejos: Extremidades): Pose => ({ ms, cerca, lejos, cuello: 0 });

export const birdDog: Ejercicio = {
  id: 'bird-dog',
  nombre: 'iron-core:ejercicios.bird-dog.nombre',
  grupo: 'core',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['esterilla'],
  musculos: {
    principales: ['transverso', 'lumbares'],
    secundarios: ['gluteo', 'oblicuos', 'deltoides_anterior', 'isquiotibiales'],
  },
  sustitutos: ['dead-bug', 'plancha', 'toques-hombro'],
  vista: 'lateral',
  // Cadera sobre la rodilla de apoyo; el tronco, a 18° (manos más largas que el muslo).
  ancla: { punto: 'cadera', x: 0, y: 29.3, segmento: 'tronco', angulo: 18 },
  poses: [
    pose(0, APOYO, APOYO),
    pose(300, APOYO, APOYO),
    pose(1300, BRAZO, PIERNA),
    pose(1900, BRAZO, PIERNA),
    pose(2900, APOYO, APOYO),
    pose(3200, APOYO, APOYO),
    pose(4200, PIERNA, BRAZO),
    pose(4800, PIERNA, BRAZO),
  ],
  cicloMs: 5800,
  esfuerzo: [
    { desde: 300, hasta: 1300 },
    { desde: 3200, hasta: 4200 },
  ],
  msFicha: 1600,
  escenario: [{ tipo: 'esterilla', x: -60, ancho: 116, alto: 0.8, capa: 'fondo' }],
  encuadre: { x: -66, y: -4, ancho: 140, alto: 60 },
  cues: [
    'iron-core:ejercicios.bird-dog.cues.apoyos',
    'iron-core:ejercicios.bird-dog.cues.linea',
    'iron-core:ejercicios.bird-dog.cues.lento',
  ],
  errores: [
    'iron-core:ejercicios.bird-dog.errores.arco',
    'iron-core:ejercicios.bird-dog.errores.giro',
  ],
};

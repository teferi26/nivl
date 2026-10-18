// NIVL · IRON · Patada de glúteo en cuadrupedia, vista lateral. En casa.
//
// A cuatro apoyos (manos bajo los hombros y la rodilla lejana bajo la
// cadera), la pierna cercana sube con la rodilla a 90° empujando la planta
// hacia el techo, sin arquear la zona lumbar.
// Biomecánica (comprobada en src/iron/__tests__/pierna.test.ts):
// · El tronco no se mueve (rodilla de apoyo fija y manos en el suelo).
// · La rodilla de la pierna que trabaja se queda a unos 90° (±8°).
// · Arriba el muslo llega a la horizontal sin pasar de -30° de extensión de
//   cadera (sin arquear la espalda) y abajo la rodilla no toca el suelo.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const APOYO: Extremidades = { cadera: 72, rodilla: 105, tobillo: -15, hombro: 57.4, codo: 35.6 };
const BRAZOS = { hombro: 57.4, codo: 35.6 } as const;

const ABAJO: Extremidades = { cadera: 74, rodilla: 105, tobillo: -40, ...BRAZOS };
const MEDIO: Extremidades = { cadera: 12, rodilla: 95, tobillo: -15, ...BRAZOS };
const ARRIBA: Extremidades = { cadera: -25, rodilla: 92, tobillo: 0, ...BRAZOS };

const pose = (ms: number, cerca: Extremidades): Pose => ({ ms, cerca, lejos: APOYO, cuello: 0 });

export const patadaGluteo: Ejercicio = {
  id: 'patada-gluteo',
  nombre: 'iron-pierna:ejercicios.patada-gluteo.nombre',
  grupo: 'pierna',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['peso_corporal'],
  musculos: {
    principales: ['gluteo'],
    secundarios: ['isquiotibiales', 'abdomen', 'lumbares'],
  },
  sustitutos: ['puente-gluteo', 'puente-gluteo-una-pierna'],
  vista: 'lateral',
  // Apoyo en la rodilla lejana: la espinilla en el suelo, con el tobillo algo levantado.
  ancla: { punto: 'rodilla_l', x: 0, y: 3.8, segmento: 'pierna_l', angulo: 165 },
  poses: [pose(0, ABAJO), pose(300, ABAJO), pose(750, MEDIO), pose(1150, ARRIBA), pose(1550, ARRIBA), pose(2250, MEDIO)],
  cicloMs: 2900,
  esfuerzo: [{ desde: 300, hasta: 1150 }],
  msFicha: 1350,
  encuadre: { x: -56, y: -4, ancho: 104, alto: 68 },
  cues: [
    'iron-pierna:ejercicios.patada-gluteo.cues.espalda',
    'iron-pierna:ejercicios.patada-gluteo.cues.talon',
    'iron-pierna:ejercicios.patada-gluteo.cues.rodilla',
  ],
  errores: [
    'iron-pierna:ejercicios.patada-gluteo.errores.arquear',
    'iron-pierna:ejercicios.patada-gluteo.errores.girar',
  ],
};

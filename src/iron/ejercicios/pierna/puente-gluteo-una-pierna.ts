// NIVL · IRON · Puente de glúteo a una pierna, vista lateral. En casa.
//
// Como el puente de glúteo, con la pierna lejana estirada en la línea del
// muslo: todo el peso va a la pierna de apoyo y la cadera tiene que subir
// sin girar.
// Biomecánica (comprobada en src/iron/__tests__/pierna.test.ts):
// · Pie de apoyo plano y quieto; la espalda alta no se despega del suelo.
// · Arriba: tronco y muslo de apoyo en línea (cadera ±6°).
// · La pierna libre sigue estirada (rodilla ≤ 5°), paralela al muslo de apoyo,
//   y no toca el suelo.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const ABAJO: Extremidades = { cadera: 47.4, rodilla: 124.3, tobillo: -16.2, hombro: -9, codo: 2 };
const MEDIO: Extremidades = { cadera: 23.7, rodilla: 115.6, tobillo: -12, hombro: -20, codo: 2 };
const ARRIBA: Extremidades = { cadera: 1.7, rodilla: 103.8, tobillo: -13, hombro: -31, codo: 2 };

/** La pierna libre: estirada, en la línea del muslo de apoyo. */
const libre = (e: Extremidades): Extremidades => ({ ...e, rodilla: 0, tobillo: -15 });

const pose = (ms: number, cerca: Extremidades, cuello: number): Pose => ({ ms, cerca, lejos: libre(cerca), cuello });

export const puenteGluteoUnaPierna: Ejercicio = {
  id: 'puente-gluteo-una-pierna',
  nombre: 'iron-pierna:ejercicios.puente-gluteo-una-pierna.nombre',
  grupo: 'pierna',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['peso_corporal'],
  musculos: {
    principales: ['gluteo'],
    secundarios: ['isquiotibiales', 'gluteo_medio', 'abdomen', 'psoas'],
  },
  sustitutos: ['puente-gluteo', 'hip-thrust', 'peso-muerto-una-pierna'],
  vista: 'lateral',
  ancla: { punto: 'tobillo_c', x: 0, y: 4, segmento: 'pie_c', angulo: 0 },
  poses: [
    pose(0, ABAJO, 3),
    pose(300, ABAJO, 3),
    pose(850, MEDIO, 18),
    pose(1300, ARRIBA, 35),
    pose(1800, ARRIBA, 35),
    pose(2450, MEDIO, 18),
  ],
  cicloMs: 3100,
  esfuerzo: [{ desde: 300, hasta: 1300 }],
  msFicha: 1550,
  encuadre: { x: -78, y: -4, ancho: 112, alto: 60 },
  cues: [
    'iron-pierna:ejercicios.puente-gluteo-una-pierna.cues.talon',
    'iron-pierna:ejercicios.puente-gluteo-una-pierna.cues.nivel',
    'iron-pierna:ejercicios.puente-gluteo-una-pierna.cues.arriba',
  ],
  errores: [
    'iron-pierna:ejercicios.puente-gluteo-una-pierna.errores.girar',
    'iron-pierna:ejercicios.puente-gluteo-una-pierna.errores.lumbar',
  ],
};

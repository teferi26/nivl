// NIVL · IRON · Puente de glúteo en el suelo, vista lateral. En casa.
//
// Tumbado boca arriba, pies planos cerca de los glúteos y brazos en el suelo.
// La cadera sube hasta dejar hombros, cadera y rodillas en línea y aprieta
// arriba un segundo.
// Biomecánica (comprobada en src/iron/__tests__/pierna.test.ts):
// · Pies planos y quietos; la espalda alta no se despega del suelo (las poses
//   están despejadas para que el punto de apoyo no se mueva).
// · Arriba: tronco y muslo en línea (cadera ±6°).
// · Abajo, los glúteos rozan el suelo sin atravesarlo; la cabeza descansa en él.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const ABAJO: Extremidades = { cadera: 47.4, rodilla: 124.3, tobillo: -16.2, hombro: -9, codo: 2 };
const MEDIO: Extremidades = { cadera: 23.7, rodilla: 115.6, tobillo: -12, hombro: -20, codo: 2 };
const ARRIBA: Extremidades = { cadera: 1.7, rodilla: 103.8, tobillo: -13, hombro: -31, codo: 2 };

const pose = (ms: number, cerca: Extremidades, cuello: number): Pose => ({ ms, cerca, cuello });

export const puenteGluteo: Ejercicio = {
  id: 'puente-gluteo',
  nombre: 'iron-pierna:ejercicios.puente-gluteo.nombre',
  grupo: 'pierna',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['peso_corporal'],
  musculos: {
    principales: ['gluteo'],
    secundarios: ['isquiotibiales', 'gluteo_medio', 'abdomen'],
  },
  sustitutos: ['puente-gluteo-una-pierna', 'hip-thrust'],
  vista: 'lateral',
  ancla: { punto: 'tobillo_c', x: 0, y: 4, segmento: 'pie_c', angulo: 0 },
  poses: [
    pose(0, ABAJO, 3),
    pose(300, ABAJO, 3),
    pose(800, MEDIO, 18),
    pose(1200, ARRIBA, 35),
    pose(1700, ARRIBA, 35),
    pose(2300, MEDIO, 18),
  ],
  cicloMs: 2900,
  esfuerzo: [{ desde: 300, hasta: 1200 }],
  msFicha: 1450,
  encuadre: { x: -78, y: -4, ancho: 96, alto: 52 },
  cues: [
    'iron-pierna:ejercicios.puente-gluteo.cues.talones',
    'iron-pierna:ejercicios.puente-gluteo.cues.arriba',
    'iron-pierna:ejercicios.puente-gluteo.cues.lumbar',
  ],
  errores: [
    'iron-pierna:ejercicios.puente-gluteo.errores.arquear',
    'iron-pierna:ejercicios.puente-gluteo.errores.rapido',
  ],
};

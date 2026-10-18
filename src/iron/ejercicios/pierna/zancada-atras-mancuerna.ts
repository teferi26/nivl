// NIVL · IRON · Zancada atrás con mancuernas, vista lateral.
//
// De pie con los pies juntos, se da un paso atrás con la pierna lejana, se
// baja hasta que la rodilla de atrás casi toca el suelo y se vuelve empujando
// con el pie de delante. Más amable con la rodilla que la zancada adelante.
// Biomecánica (comprobada en src/iron/__tests__/pierna.test.ts):
// · El pie de delante no se mueve en todo el ciclo (es el ancla) y va plano.
// · El pie de atrás no atraviesa el suelo al dar el paso ni al volver.
// · Abajo, la rodilla de atrás queda cerca del suelo (por debajo de 12).
// · Brazos colgando en vertical (±10°).

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const DE_PIE: Extremidades = { cadera: 0, rodilla: 2, tobillo: 2, hombro: 0, codo: 0 };
const PASO: Extremidades = { cadera: 14, rodilla: 16, tobillo: 4, hombro: 2, codo: 0 };
const DESPEGUE: Extremidades = { cadera: 3, rodilla: 4, tobillo: 2, hombro: 0, codo: 0 };
const TOCA: Extremidades = { cadera: 43.2, rodilla: 35.6, tobillo: -1.6, hombro: 6, codo: 0 };
const APOYA: Extremidades = { cadera: 51.6, rodilla: 48.5, tobillo: 3.4, hombro: 6.5, codo: 0 };
const BAJANDO: Extremidades = { cadera: 58.7, rodilla: 58.6, tobillo: 6.9, hombro: 7, codo: 0 };
const MEDIO: Extremidades = { cadera: 71.3, rodilla: 74.9, tobillo: 11.5, hombro: 8, codo: 0 };
const ABAJO: Extremidades = { cadera: 94.5, rodilla: 99.6, tobillo: 15.1, hombro: 10, codo: 0 };

// La pierna que da el paso: en el aire, el pie atrás y arriba.
const DESPEGUE_L: Extremidades = { cadera: -2, rodilla: 28, tobillo: 18, hombro: 0, codo: 0 };
const PASO_L: Extremidades = { cadera: -18, rodilla: 62, tobillo: 20, hombro: 2, codo: 0 };
const TOCA_L: Extremidades = { cadera: -22.8, rodilla: 19.2, tobillo: 13.1, hombro: 6, codo: 0 };
const APOYA_L: Extremidades = { cadera: -11.3, rodilla: 43.4, tobillo: 22.5, hombro: 6.5, codo: 0 };
const BAJANDO_L: Extremidades = { cadera: -4.4, rodilla: 58.5, tobillo: 27.4, hombro: 7, codo: 0 };
const MEDIO_L: Extremidades = { cadera: 4.9, rodilla: 80.4, tobillo: 33.5, hombro: 8, codo: 0 };
const ABAJO_L: Extremidades = { cadera: 14.3, rodilla: 110.8, tobillo: 42.5, hombro: 10, codo: 0 };

const pose = (ms: number, cerca: Extremidades, lejos: Extremidades, cuello: number): Pose => ({ ms, cerca, lejos, cuello });

export const zancadaAtrasMancuerna: Ejercicio = {
  id: 'zancada-atras-mancuerna',
  nombre: 'iron-pierna:ejercicios.zancada-atras-mancuerna.nombre',
  grupo: 'pierna',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['mancuerna'],
  musculos: {
    principales: ['cuadriceps', 'gluteo'],
    secundarios: ['aductores', 'gluteo_medio', 'isquiotibiales', 'psoas'],
  },
  sustitutos: ['sentadilla-bulgara', 'zancada-estatica', 'step-up-cajon'],
  vista: 'lateral',
  ancla: { punto: 'tobillo_c', x: 0, y: 4, segmento: 'pie_c', angulo: 0 },
  poses: [
    pose(0, DE_PIE, DE_PIE, 0),
    pose(300, DE_PIE, DE_PIE, 0),
    pose(450, DESPEGUE, DESPEGUE_L, 0),
    pose(750, PASO, PASO_L, 0),
    pose(1100, TOCA, TOCA_L, 0),
    pose(1200, APOYA, APOYA_L, 0),
    pose(1300, BAJANDO, BAJANDO_L, -1),
    pose(1500, MEDIO, MEDIO_L, -2),
    pose(1800, ABAJO, ABAJO_L, -4),
    pose(2050, ABAJO, ABAJO_L, -4),
    pose(2450, MEDIO, MEDIO_L, -2),
    pose(2650, BAJANDO, BAJANDO_L, -1),
    pose(2750, APOYA, APOYA_L, 0),
    pose(2850, TOCA, TOCA_L, 0),
    pose(3150, PASO, PASO_L, 0),
    pose(3420, DESPEGUE, DESPEGUE_L, 0),
  ],
  cicloMs: 3600,
  esfuerzo: [{ desde: 2050, hasta: 3600 }],
  msFicha: 1900,
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'punta', lados: ['cerca', 'lejos'] },
  encuadre: { x: -62, y: -4, ancho: 100, alto: 104 },
  cues: [
    'iron-pierna:ejercicios.zancada-atras-mancuerna.cues.paso',
    'iron-pierna:ejercicios.zancada-atras-mancuerna.cues.peso',
    'iron-pierna:ejercicios.zancada-atras-mancuerna.cues.tronco',
  ],
  errores: [
    'iron-pierna:ejercicios.zancada-atras-mancuerna.errores.corto',
    'iron-pierna:ejercicios.zancada-atras-mancuerna.errores.rodilla',
  ],
};

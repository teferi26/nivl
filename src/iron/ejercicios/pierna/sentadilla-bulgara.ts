// NIVL · IRON · Sentadilla búlgara con mancuernas, vista lateral.
//
// Pie cercano delante, plano en el suelo; el lejano detrás, con los dedos
// apoyados en un banco. Se baja en vertical hasta que la rodilla de atrás
// casi toca el suelo. Una mancuerna en cada mano, con los brazos colgando.
// Biomecánica (comprobada en src/iron/__tests__/pierna.test.ts):
// · Pie de delante plano y quieto; los dedos del de atrás no se mueven del
//   banco (±1,5 en todo el ciclo).
// · Abajo la rodilla de atrás queda cerca del suelo (por debajo de 12) y la
//   de delante no pasa la punta del pie más de 3.
// · Brazos colgando en vertical (±10°).

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const ARRIBA: Extremidades = { cadera: 33.4, rodilla: 38.4, tobillo: 13, hombro: 8, codo: 0 };
const MEDIO: Extremidades = { cadera: 66.5, rodilla: 83.1, tobillo: 30.5, hombro: 14, codo: 0 };
const ABAJO: Extremidades = { cadera: 92.9, rodilla: 109, tobillo: 36.1, hombro: 20, codo: 0 };

const ARRIBA_L: Extremidades = { cadera: -4.9, rodilla: 94.7, tobillo: -17.4, hombro: 8, codo: 0 };
const MEDIO_L: Extremidades = { cadera: -6.8, rodilla: 111.4, tobillo: 7.2, hombro: 14, codo: 0 };
const ABAJO_L: Extremidades = { cadera: -16.5, rodilla: 118.7, tobillo: 30.2, hombro: 20, codo: 0 };

const pose = (ms: number, cerca: Extremidades, lejos: Extremidades, cuello: number): Pose => ({ ms, cerca, lejos, cuello });

export const sentadillaBulgara: Ejercicio = {
  id: 'sentadilla-bulgara',
  nombre: 'iron-pierna:ejercicios.sentadilla-bulgara.nombre',
  grupo: 'pierna',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['mancuerna', 'banco'],
  musculos: {
    principales: ['cuadriceps', 'gluteo'],
    secundarios: ['aductores', 'gluteo_medio', 'isquiotibiales', 'psoas'],
  },
  sustitutos: ['zancada-atras-mancuerna', 'zancada-estatica', 'step-up-cajon'],
  vista: 'lateral',
  ancla: { punto: 'tobillo_c', x: 0, y: 4, segmento: 'pie_c', angulo: 0 },
  poses: [
    pose(0, ARRIBA, ARRIBA_L, 0),
    pose(400, ARRIBA, ARRIBA_L, 0),
    pose(1300, MEDIO, MEDIO_L, -4),
    pose(2200, ABAJO, ABAJO_L, -6),
    pose(2450, ABAJO, ABAJO_L, -6),
    pose(3150, MEDIO, MEDIO_L, -4),
  ],
  cicloMs: 3900,
  esfuerzo: [{ desde: 2450, hasta: 3900 }],
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'punta', lados: ['cerca', 'lejos'] },
  escenario: [{ tipo: 'banco', x: -72, ancho: 34, alto: 26, capa: 'fondo' }],
  encuadre: { x: -76, y: -4, ancho: 112, alto: 104 },
  cues: [
    'iron-pierna:ejercicios.sentadilla-bulgara.cues.vertical',
    'iron-pierna:ejercicios.sentadilla-bulgara.cues.pie',
    'iron-pierna:ejercicios.sentadilla-bulgara.cues.atras',
  ],
  errores: [
    'iron-pierna:ejercicios.sentadilla-bulgara.errores.cerca',
    'iron-pierna:ejercicios.sentadilla-bulgara.errores.rodilla',
    'iron-pierna:ejercicios.sentadilla-bulgara.errores.empujarAtras',
  ],
};

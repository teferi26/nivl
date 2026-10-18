// NIVL · IRON · Sentadilla con el peso del cuerpo, vista lateral. En casa.
//
// Los brazos van estirados hacia delante como contrapeso.
// Biomecánica (comprobada en src/iron/__tests__/pierna.test.ts):
// · Pies planos todo el recorrido; abajo la cadera pasa por debajo de la rodilla.
// · Los hombros quedan sobre el pie.
// · Brazos a la altura de los hombros (horizontales).

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const ARRIBA: Extremidades = { cadera: -1.3, rodilla: 3.2, tobillo: 6.5, hombro: 92, codo: 0 };
const MEDIO: Extremidades = { cadera: 80.5, rodilla: 89.8, tobillo: 33.4, hombro: 114, codo: 0 };
const ABAJO: Extremidades = { cadera: 132.2, rodilla: 121.4, tobillo: 27.2, hombro: 128, codo: 0 };

const pose = (ms: number, cerca: Extremidades, cuello: number): Pose => ({ ms, cerca, cuello });

export const sentadillaPesoCorporal: Ejercicio = {
  id: 'sentadilla-peso-corporal',
  nombre: 'iron-pierna:ejercicios.sentadilla-peso-corporal.nombre',
  grupo: 'pierna',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['peso_corporal'],
  musculos: {
    principales: ['cuadriceps', 'gluteo'],
    secundarios: ['aductores', 'isquiotibiales', 'abdomen'],
  },
  sustitutos: ['sentadilla-cajon', 'sentadilla-goblet', 'zancada-estatica'],
  vista: 'lateral',
  ancla: { punto: 'tobillo_c', x: 0, y: 4, segmento: 'pie_c', angulo: 0 },
  poses: [
    pose(0, ARRIBA, 0),
    pose(500, ARRIBA, 0),
    pose(1400, MEDIO, -6),
    pose(2300, ABAJO, -12),
    pose(2550, ABAJO, -12),
    pose(3250, MEDIO, -6),
  ],
  cicloMs: 4000,
  esfuerzo: [{ desde: 2550, hasta: 4000 }],
  encuadre: { x: -48, y: -4, ancho: 96, alto: 112 },
  cues: [
    'iron-pierna:ejercicios.sentadilla-peso-corporal.cues.talones',
    'iron-pierna:ejercicios.sentadilla-peso-corporal.cues.cadera',
    'iron-pierna:ejercicios.sentadilla-peso-corporal.cues.rodillas',
  ],
  errores: [
    'iron-pierna:ejercicios.sentadilla-peso-corporal.errores.talones',
    'iron-pierna:ejercicios.sentadilla-peso-corporal.errores.medio',
    'iron-pierna:ejercicios.sentadilla-peso-corporal.errores.rodillasDentro',
  ],
};

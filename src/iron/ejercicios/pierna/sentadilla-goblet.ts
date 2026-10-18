// NIVL · IRON · Sentadilla goblet con kettlebell, vista lateral.
//
// La kettlebell se sujeta por los cuernos contra el pecho, con los codos hacia
// abajo. El peso delante ayuda a bajar con el tronco erguido: buena primera
// sentadilla con carga y buena opción en casa.
// Biomecánica (comprobada en src/iron/__tests__/pierna.test.ts):
// · La kettlebell sube y baja en vertical sobre el medio del pie (±3).
// · Pies planos; abajo la cadera pasa por debajo de la rodilla.
// · La kettlebell no se separa del pecho.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const BRAZOS = { hombro: -10.7, codo: 141.8 } as const;

const ARRIBA: Extremidades = { cadera: 14.6, rodilla: 11.4, tobillo: -2.2, ...BRAZOS };
const MEDIO: Extremidades = { cadera: 78.5, rodilla: 84.7, tobillo: 22.2, ...BRAZOS };
const ABAJO: Extremidades = { cadera: 130.4, rodilla: 120.6, tobillo: 18.2, ...BRAZOS };

const pose = (ms: number, cerca: Extremidades, cuello: number): Pose => ({ ms, cerca, cuello });

export const sentadillaGoblet: Ejercicio = {
  id: 'sentadilla-goblet',
  nombre: 'iron-pierna:ejercicios.sentadilla-goblet.nombre',
  grupo: 'pierna',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['kettlebell'],
  musculos: {
    principales: ['cuadriceps', 'gluteo'],
    secundarios: ['aductores', 'abdomen', 'espalda_alta'],
  },
  sustitutos: ['sentadilla-frontal', 'sentadilla-peso-corporal', 'prensa'],
  vista: 'lateral',
  ancla: { punto: 'tobillo_c', x: 0, y: 4, segmento: 'pie_c', angulo: 0 },
  poses: [
    pose(0, ARRIBA, 0),
    pose(600, ARRIBA, 0),
    pose(1600, MEDIO, -4),
    pose(2600, ABAJO, -10),
    pose(2900, ABAJO, -10),
    pose(3700, MEDIO, -4),
  ],
  cicloMs: 4600,
  esfuerzo: [{ desde: 2900, hasta: 4600 }],
  carga: { tipo: 'kettlebell', en: 'agarre', cuelga: 'abajo' },
  encuadre: { x: -48, y: -4, ancho: 96, alto: 112 },
  cues: [
    'iron-pierna:ejercicios.sentadilla-goblet.cues.pecho',
    'iron-pierna:ejercicios.sentadilla-goblet.cues.codos',
    'iron-pierna:ejercicios.sentadilla-goblet.cues.talones',
  ],
  errores: [
    'iron-pierna:ejercicios.sentadilla-goblet.errores.separar',
    'iron-pierna:ejercicios.sentadilla-goblet.errores.lumbar',
    'iron-pierna:ejercicios.sentadilla-goblet.errores.rodillasDentro',
  ],
};

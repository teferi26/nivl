// NIVL · IRON · Balanceo de pierna adelante y atrás, vista lateral.
//
// De pie sobre la pierna de lejos, con los brazos al frente para el
// equilibrio (o una mano en la pared). La pierna de cerca se balancea
// adelante y atrás, suelta y cada vez un poco más alta.
// Biomecánica (comprobada en src/iron/__tests__/core.test.ts):
// · La pierna de apoyo no se mueve y el pie sigue plano (ancla en su tobillo).
// · Tronco erguido: se balancea la pierna, no el tronco.
// · Recorrido de unos 25° atrás a 65° delante; al pasar por abajo la rodilla
//   se dobla un poco para que el pie no toque el suelo.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const BRAZOS = { hombro: 80, codo: 10 } as const;
const APOYO: Extremidades = { cadera: 0, rodilla: 0, tobillo: 0, ...BRAZOS };
const ATRAS: Extremidades = { cadera: -25, rodilla: 30, tobillo: -15, ...BRAZOS };
const ABAJO: Extremidades = { cadera: 22, rodilla: 60, tobillo: 10, ...BRAZOS };
const DELANTE: Extremidades = { cadera: 65, rodilla: 5, tobillo: -10, ...BRAZOS };

const pose = (ms: number, cerca: Extremidades): Pose => ({ ms, cuello: 0, cerca, lejos: APOYO });

export const balanceoPierna: Ejercicio = {
  id: 'balanceo-pierna',
  nombre: 'iron-core:ejercicios.balanceo-pierna.nombre',
  grupo: 'movilidad',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['peso_corporal'],
  musculos: {
    principales: ['isquiotibiales', 'gluteo'],
    secundarios: ['cuadriceps', 'aductores', 'abdomen'],
  },
  sustitutos: ['bisagra-cadera', 'flexor-cadera', 'perro-boca-abajo'],
  vista: 'lateral',
  // El tobillo de la pierna de apoyo (la lejana), con el pie plano.
  ancla: { punto: 'tobillo_l', x: 0, y: 4, segmento: 'pie_l', angulo: 0 },
  poses: [pose(0, ATRAS), pose(550, ABAJO), pose(1100, DELANTE), pose(1650, ABAJO)],
  cicloMs: 2200,
  esfuerzo: [{ desde: 550, hasta: 1100 }],
  msFicha: 1100,
  encuadre: { x: -48, y: -4, ancho: 108, alto: 108 },
  cues: [
    'iron-core:ejercicios.balanceo-pierna.cues.apoyo',
    'iron-core:ejercicios.balanceo-pierna.cues.suelta',
    'iron-core:ejercicios.balanceo-pierna.cues.rango',
  ],
  errores: [
    'iron-core:ejercicios.balanceo-pierna.errores.tronco',
    'iron-core:ejercicios.balanceo-pierna.errores.forzar',
  ],
};

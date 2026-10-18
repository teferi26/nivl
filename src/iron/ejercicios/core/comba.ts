// NIVL · IRON · Saltar a la comba, vista lateral.
//
// Saltos pequeños sobre la parte delantera de los pies, rodillas sueltas y
// codos pegados al cuerpo; la cuerda la giran las muñecas.
// Biomecánica (comprobada en src/iron/__tests__/core.test.ts):
// · Dos saltos y dos vueltas de cuerda por ciclo: la cuerda pasa bajo los
//   pies justo cuando están en el aire (el punto más alto del salto).
// · Saltos bajos (los pies suben ≤ 6 unidades, unos 10 cm).
// · Codos junto al cuerpo y manos a la altura de la cadera.
// · Apoyo en la parte delantera del pie, sin clavar los talones.
// El ancla es la cadera y se mueve (`punto`). La cuerda va detrás del
// cuerpo (no tapa cabeza ni torso); ver src/iron/material/comba.ts.

import type { Ejercicio, Pose } from '../../tipos';

type Instante = Omit<Pose, 'ms'>;

const SUELO: Instante = {
  punto: { x: -1, y: 55.6 },
  cuello: 0,
  cerca: { cadera: 16.2, rodilla: 25.9, tobillo: -8.2, hombro: 0, codo: 30 },
};
const AIRE: Instante = {
  punto: { x: -1, y: 61 },
  cuello: 0,
  cerca: { cadera: 15.2, rodilla: 22.9, tobillo: -20.3, hombro: 3, codo: 28 },
};

const en = (ms: number, p: Instante): Pose => ({ ms, ...p });

export const comba: Ejercicio = {
  id: 'comba',
  nombre: 'iron-core:ejercicios.comba.nombre',
  grupo: 'cardio',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['comba'],
  musculos: {
    principales: ['gemelos'],
    secundarios: ['cuadriceps', 'antebrazo', 'deltoides_anterior', 'abdomen'],
  },
  sustitutos: ['saltos-tijera', 'rodillas-arriba', 'talones-gluteo'],
  vista: 'lateral',
  ancla: { punto: 'cadera', x: -1, y: 55.6, segmento: 'tronco', angulo: 88 },
  poses: [en(0, AIRE), en(400, SUELO), en(800, AIRE), en(1200, SUELO)],
  cicloMs: 1600,
  esfuerzo: [
    { desde: 400, hasta: 800 },
    { desde: 1200, hasta: 1600 },
  ],
  msFicha: 0,
  carga: { tipo: 'comba', vueltas: 2 },
  encuadre: { x: -36, y: -4, ancho: 84, alto: 128 },
  cues: [
    'iron-core:ejercicios.comba.cues.bajo',
    'iron-core:ejercicios.comba.cues.munecas',
    'iron-core:ejercicios.comba.cues.pisada',
  ],
  errores: [
    'iron-core:ejercicios.comba.errores.alto',
    'iron-core:ejercicios.comba.errores.brazos',
  ],
};

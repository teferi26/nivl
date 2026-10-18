// NIVL · IRON · Hollow hold (posición de barca hueca), vista lateral (cabeza a la izquierda).
//
// Isométrico: boca arriba, hombros y piernas despegados del suelo, brazos
// estirados hacia el techo y la zona lumbar pegada a la esterilla.
// Biomecánica (comprobada en src/iron/__tests__/core.test.ts):
// · Hombros por encima de la cadera (tronco unos 10° arriba).
// · Piernas estiradas a unos 20° del suelo, pies en punta.
// · Brazos estirados hacia el techo (la versión de base: con los brazos por
//   encima de la cabeza el de cerca taparía la cara y hacia los pies, el abdomen).
// · Solo apoya la zona baja de la espalda y los glúteos.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const POSTURA: Extremidades = { cadera: 30, rodilla: 0, tobillo: -30, hombro: 95, codo: 0 };

const pose = (ms: number): Pose => ({ ms, cuello: 8, cerca: POSTURA });

export const hollowHold: Ejercicio = {
  id: 'hollow-hold',
  nombre: 'iron-core:ejercicios.hollow-hold.nombre',
  grupo: 'core',
  nivel: 'intermedio',
  tipo: 'isometrico',
  material: ['esterilla'],
  musculos: {
    principales: ['abdomen', 'transverso'],
    secundarios: ['oblicuos', 'cuadriceps', 'cuello'],
  },
  sustitutos: ['dead-bug', 'tijeras-abdominales', 'plancha'],
  vista: 'lateral',
  // La cadera, a la altura justa para que glúteos y zona lumbar toquen la esterilla.
  ancla: { punto: 'cadera', x: 0, y: 9.3, segmento: 'tronco', angulo: 170 },
  poses: [pose(0), pose(2000)],
  cicloMs: 4000,
  esfuerzo: [{ desde: 0, hasta: 4000 }],
  escenario: [{ tipo: 'esterilla', x: -56, ancho: 112, alto: 0.8, capa: 'fondo' }],
  encuadre: { x: -54, y: -4, ancho: 112, alto: 64 },
  cues: [
    'iron-core:ejercicios.hollow-hold.cues.lumbar',
    'iron-core:ejercicios.hollow-hold.cues.altura',
    'iron-core:ejercicios.hollow-hold.cues.respira',
  ],
  errores: [
    'iron-core:ejercicios.hollow-hold.errores.arco',
    'iron-core:ejercicios.hollow-hold.errores.cuello',
  ],
};

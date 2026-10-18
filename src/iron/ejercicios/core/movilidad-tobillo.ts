// NIVL · IRON · Movilidad de tobillo en media rodilla, vista lateral.
//
// Rodilla de atrás en la esterilla y el pie de delante plano. Se lleva la
// rodilla de delante hacia delante, por encima de los dedos, sin levantar
// el talón, y se vuelve.
// Biomecánica (comprobada en src/iron/__tests__/core.test.ts):
// · El pie de delante no se mueve y sigue plano (ancla en su tobillo).
// · El tobillo gana unos 20° de flexión dorsal: la rodilla pasa por delante
//   del tobillo y llega cerca de la punta del pie.
// · La rodilla de atrás sigue apoyada en la esterilla.

import type { Ejercicio, Pose } from '../../tipos';

const MANOS = { hombro: -12, codo: 100 } as const;
const ATRAS: Pose = {
  ms: 0,
  angulo: 0,
  cuello: 0,
  cerca: { cadera: 92.1, rodilla: 86.6, tobillo: -3.5, ...MANOS },
  lejos: { cadera: -2.7, rodilla: 103.3, tobillo: 18, ...MANOS },
};
const DELANTE: Omit<Pose, 'ms'> = {
  angulo: 0,
  cuello: 0,
  cerca: { cadera: 101.8, rodilla: 114, tobillo: 20.2, ...MANOS },
  lejos: { cadera: -21.3, rodilla: 78.7, tobillo: 18, ...MANOS },
};
const en = (ms: number, p: Omit<Pose, 'ms'>): Pose => ({ ...p, ms });

export const movilidadTobillo: Ejercicio = {
  id: 'movilidad-tobillo',
  nombre: 'iron-core:ejercicios.movilidad-tobillo.nombre',
  grupo: 'movilidad',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['esterilla'],
  musculos: {
    principales: ['gemelos'],
    secundarios: ['tibial', 'cuadriceps'],
  },
  sustitutos: ['perro-boca-abajo', 'flexor-cadera', 'balanceo-pierna'],
  vista: 'lateral',
  // El tobillo de delante, con el pie plano en la esterilla.
  ancla: { punto: 'tobillo_c', x: 26, y: 4.8, segmento: 'pie_c', angulo: 0 },
  poses: [en(0, ATRAS), en(300, ATRAS), en(1300, DELANTE), en(1900, DELANTE)],
  cicloMs: 2900,
  esfuerzo: [{ desde: 300, hasta: 1300 }],
  msFicha: 1600,
  escenario: [{ tipo: 'esterilla', x: -36, ancho: 84, alto: 0.8, capa: 'fondo' }],
  encuadre: { x: -40, y: -4, ancho: 92, alto: 86 },
  cues: [
    'iron-core:ejercicios.movilidad-tobillo.cues.talon',
    'iron-core:ejercicios.movilidad-tobillo.cues.rodilla',
    'iron-core:ejercicios.movilidad-tobillo.cues.suave',
  ],
  errores: [
    'iron-core:ejercicios.movilidad-tobillo.errores.talon',
    'iron-core:ejercicios.movilidad-tobillo.errores.rodillaDentro',
  ],
};

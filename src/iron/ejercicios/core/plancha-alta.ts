// NIVL · IRON · Plancha alta (brazos estirados), vista lateral.
//
// Isométrico: la posición de arriba de una flexión. Manos bajo los hombros,
// brazos estirados y el cuerpo en línea de la cabeza a los talones.
// Biomecánica (comprobada en src/iron/__tests__/core.test.ts):
// · Mano bajo el hombro: brazo vertical y codo estirado.
// · Hombro, cadera y tobillo en línea recta (±1).
// · Apoyo en manos y puntas de los pies.
// · Empujar el suelo separa las escápulas: trabaja el serrato anterior.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

// Tronco a 20,3°: con el brazo vertical, las puntas de los pies tocan la esterilla.
export const PLANCHA_ALTA: Extremidades = { cadera: 0, rodilla: 0, tobillo: -20, hombro: 69.7, codo: 0 };
/** Tronco de la plancha alta (grados) y dónde queda el hombro con la mano en el origen. */
export const TRONCO_PLANCHA_ALTA = 20.3;

const pose = (ms: number): Pose => ({ ms, cuello: 0, cerca: PLANCHA_ALTA });

export const planchaAlta: Ejercicio = {
  id: 'plancha-alta',
  nombre: 'iron-core:ejercicios.plancha-alta.nombre',
  grupo: 'core',
  nivel: 'principiante',
  tipo: 'isometrico',
  material: ['esterilla'],
  musculos: {
    principales: ['abdomen'],
    secundarios: ['serrato', 'transverso', 'deltoides_anterior', 'triceps', 'cuadriceps'],
  },
  sustitutos: ['plancha', 'toques-hombro', 'bird-dog'],
  vista: 'lateral',
  // La mano en la esterilla y el brazo vertical.
  ancla: { punto: 'agarre_c', x: 0, y: 3.2, segmento: 'brazo_c', angulo: -90 },
  poses: [pose(0), pose(2000)],
  cicloMs: 4000,
  esfuerzo: [{ desde: 0, hasta: 4000 }],
  escenario: [{ tipo: 'esterilla', x: -96, ancho: 112, alto: 0.8, capa: 'fondo' }],
  encuadre: { x: -100, y: -4, ancho: 124, alto: 60 },
  cues: [
    'iron-core:ejercicios.plancha-alta.cues.manos',
    'iron-core:ejercicios.plancha-alta.cues.linea',
    'iron-core:ejercicios.plancha-alta.cues.empuja',
  ],
  errores: [
    'iron-core:ejercicios.plancha-alta.errores.caderaCaida',
    'iron-core:ejercicios.plancha-alta.errores.hombros',
    'iron-core:ejercicios.plancha-alta.errores.apnea',
  ],
};

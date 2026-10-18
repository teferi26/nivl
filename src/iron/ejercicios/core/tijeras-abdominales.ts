// NIVL · IRON · Tijeras abdominales (flutter kicks), vista lateral (cabeza a la izquierda).
//
// Boca arriba, brazos en el suelo y piernas estiradas en el aire. Se
// alternan patadas cortas arriba y abajo sin que los talones toquen el suelo.
// Biomecánica (comprobada en src/iron/__tests__/core.test.ts):
// · Tronco y cadera quietos (el ancla es la cadera).
// · Rodillas estiradas; las piernas se cruzan en el medio del recorrido.
// · Ningún talón baja a la esterilla.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const BRAZOS = { hombro: -7.7, codo: 0 } as const;
const BAJA: Extremidades = { ...BRAZOS, cadera: 10.3, rodilla: 0, tobillo: -25 };
const ALTA: Extremidades = { ...BRAZOS, cadera: 32.3, rodilla: 0, tobillo: -25 };

const pose = (ms: number, cerca: Extremidades, lejos: Extremidades): Pose => ({ ms, cerca, lejos, cuello: 0 });

export const tijerasAbdominales: Ejercicio = {
  id: 'tijeras-abdominales',
  nombre: 'iron-core:ejercicios.tijeras-abdominales.nombre',
  grupo: 'core',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['esterilla'],
  musculos: {
    principales: ['abdomen'],
    secundarios: ['cuadriceps', 'transverso', 'oblicuos'],
  },
  sustitutos: ['elevaciones-piernas', 'hollow-hold', 'dead-bug'],
  vista: 'lateral',
  ancla: { punto: 'cadera', x: 0, y: 9.4, segmento: 'tronco', angulo: 182.7 },
  poses: [pose(0, BAJA, ALTA), pose(800, ALTA, BAJA)],
  cicloMs: 1600,
  esfuerzo: [
    { desde: 0, hasta: 800 },
    { desde: 800, hasta: 1600 },
  ],
  msFicha: 0,
  escenario: [{ tipo: 'esterilla', x: -50, ancho: 108, alto: 0.8, capa: 'fondo' }],
  encuadre: { x: -54, y: -4, ancho: 112, alto: 48 },
  cues: [
    'iron-core:ejercicios.tijeras-abdominales.cues.espalda',
    'iron-core:ejercicios.tijeras-abdominales.cues.corto',
    'iron-core:ejercicios.tijeras-abdominales.cues.respira',
  ],
  errores: [
    'iron-core:ejercicios.tijeras-abdominales.errores.arco',
    'iron-core:ejercicios.tijeras-abdominales.errores.rodillas',
  ],
};

// NIVL · IRON · Elevaciones de piernas tumbado, vista lateral (cabeza a la izquierda).
//
// Boca arriba, brazos en el suelo junto al cuerpo y piernas estiradas. Se
// suben las piernas juntas hasta la vertical y se bajan despacio sin llegar
// a tocar el suelo.
// Biomecánica (comprobada en src/iron/__tests__/core.test.ts):
// · Tronco y cadera quietos: la espalda no se despega (el ancla es la cadera).
// · Rodillas casi estiradas todo el recorrido (≤ 10°).
// · Abajo los talones quedan en el aire, por encima de la esterilla.
// · La bajada dura más que la subida.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const BRAZOS = { hombro: -7.7, codo: 0 } as const;
const ABAJO: Extremidades = { ...BRAZOS, cadera: 3.3, rodilla: 0, tobillo: -25 };
const ARRIBA: Extremidades = { ...BRAZOS, cadera: 85.3, rodilla: 6, tobillo: -15 };

const pose = (ms: number, cerca: Extremidades): Pose => ({ ms, cerca, cuello: 0 });

export const elevacionesPiernas: Ejercicio = {
  id: 'elevaciones-piernas',
  nombre: 'iron-core:ejercicios.elevaciones-piernas.nombre',
  grupo: 'core',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['esterilla'],
  musculos: {
    principales: ['abdomen'],
    secundarios: ['cuadriceps', 'oblicuos', 'transverso'],
  },
  sustitutos: ['crunch-inverso', 'tijeras-abdominales', 'dead-bug'],
  vista: 'lateral',
  ancla: { punto: 'cadera', x: 0, y: 9.4, segmento: 'tronco', angulo: 182.7 },
  poses: [pose(0, ABAJO), pose(300, ABAJO), pose(1300, ARRIBA), pose(1600, ARRIBA)],
  cicloMs: 3600,
  esfuerzo: [{ desde: 300, hasta: 1300 }],
  msFicha: 800,
  escenario: [{ tipo: 'esterilla', x: -50, ancho: 108, alto: 0.8, capa: 'fondo' }],
  encuadre: { x: -54, y: -4, ancho: 116, alto: 76 },
  cues: [
    'iron-core:ejercicios.elevaciones-piernas.cues.espalda',
    'iron-core:ejercicios.elevaciones-piernas.cues.rodillas',
    'iron-core:ejercicios.elevaciones-piernas.cues.bajada',
  ],
  errores: [
    'iron-core:ejercicios.elevaciones-piernas.errores.arco',
    'iron-core:ejercicios.elevaciones-piernas.errores.impulso',
  ],
};

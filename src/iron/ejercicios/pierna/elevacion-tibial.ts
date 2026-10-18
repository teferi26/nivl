// NIVL · IRON · Elevación de tibiales sentado, vista lateral. En casa (vale una silla).
//
// Sentado, con el talón apoyado y la espinilla vertical, se suben las puntas
// de los pies todo lo posible y se bajan despacio. Trabaja el tibial anterior.
// Biomecánica (comprobada en src/iron/__tests__/pierna.test.ts):
// · La cadera no se mueve del banco (es el ancla).
// · El talón no se mueve del suelo (±0,6): el pie gira sobre él, de plano a
//   unos 28° de flexión dorsal; la espinilla queda casi vertical (±12°).

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const MANOS = { hombro: -11.2, codo: 92.4 } as const;

const ABAJO: Extremidades = { cadera: 81.4, rodilla: 78.4, tobillo: -1, ...MANOS };
const MEDIO: Extremidades = { cadera: 83.7, rodilla: 83.7, tobillo: 16, ...MANOS };
const ARRIBA: Extremidades = { cadera: 85.1, rodilla: 88.3, tobillo: 33.2, ...MANOS };

const pose = (ms: number, cerca: Extremidades): Pose => ({ ms, cerca, cuello: 8 });

export const elevacionTibial: Ejercicio = {
  id: 'elevacion-tibial',
  nombre: 'iron-pierna:ejercicios.elevacion-tibial.nombre',
  grupo: 'pierna',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['banco'],
  musculos: {
    principales: ['tibial'],
    secundarios: [],
  },
  sustitutos: ['gemelos-sentado'],
  vista: 'lateral',
  ancla: { punto: 'cadera', x: 0, y: 33, segmento: 'tronco', angulo: 88 },
  poses: [pose(0, ABAJO), pose(300, ABAJO), pose(650, MEDIO), pose(1000, ARRIBA), pose(1400, ARRIBA), pose(2100, MEDIO)],
  cicloMs: 2800,
  esfuerzo: [{ desde: 300, hasta: 1000 }],
  msFicha: 1200,
  escenario: [{ tipo: 'banco', x: -26, ancho: 40, alto: 26, capa: 'fondo' }],
  encuadre: { x: -30, y: -4, ancho: 74, alto: 84 },
  cues: [
    'iron-pierna:ejercicios.elevacion-tibial.cues.talon',
    'iron-pierna:ejercicios.elevacion-tibial.cues.arriba',
    'iron-pierna:ejercicios.elevacion-tibial.cues.bajada',
  ],
  errores: [
    'iron-pierna:ejercicios.elevacion-tibial.errores.rapido',
    'iron-pierna:ejercicios.elevacion-tibial.errores.talon',
  ],
};

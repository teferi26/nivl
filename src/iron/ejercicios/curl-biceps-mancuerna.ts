// NIVL · IRON · Curl de bíceps con mancuernas, de pie, vista lateral.
//
// Biomecánica (comprobada en src/iron/__tests__/biomecanica.test.ts):
// · El codo se queda junto al costado: el hombro solo se adelanta un poco
//   arriba (≤ 15°) para cerrar el curl, sin balanceo.
// · Recorrido completo: de brazo casi estirado (codo 8°) a codo cerrado (140°).
// · Bajada más lenta que la subida; tronco y piernas quietos.
// Agarre en supinación: la mancuerna se ve de punta.

import type { Ejercicio, Extremidades, Pose } from '../tipos';

const PIERNAS = { tobillo: 2, rodilla: 3, cadera: 1 } as const;
const ABAJO: Extremidades = { ...PIERNAS, hombro: 0, codo: 8 };
const ARRIBA: Extremidades = { ...PIERNAS, hombro: 12, codo: 140 };

const pose = (ms: number, cerca: Extremidades): Pose => ({ ms, cuello: 0, cerca });

export const curlBicepsMancuerna: Ejercicio = {
  id: 'curl-biceps-mancuerna',
  nombre: 'iron:ejercicios.curl-biceps-mancuerna.nombre',
  grupo: 'brazo',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['mancuerna'],
  musculos: {
    principales: ['biceps'],
    secundarios: ['antebrazo', 'deltoides_anterior'],
  },
  sustitutos: [],
  vista: 'lateral',
  ancla: { punto: 'tobillo_c', x: 0, y: 4, segmento: 'pie_c', angulo: 0 },
  poses: [pose(0, ABAJO), pose(400, ABAJO), pose(1600, ARRIBA), pose(1900, ARRIBA)],
  cicloMs: 3900,
  esfuerzo: [{ desde: 400, hasta: 1600 }],
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'punta', lados: ['cerca', 'lejos'] },
  encuadre: { x: -42, y: -4, ancho: 84, alto: 112 },
  cues: [
    'iron:ejercicios.curl-biceps-mancuerna.cues.codos',
    'iron:ejercicios.curl-biceps-mancuerna.cues.recorrido',
    'iron:ejercicios.curl-biceps-mancuerna.cues.bajada',
  ],
  errores: [
    'iron:ejercicios.curl-biceps-mancuerna.errores.balanceo',
    'iron:ejercicios.curl-biceps-mancuerna.errores.codosDelante',
    'iron:ejercicios.curl-biceps-mancuerna.errores.medioRecorrido',
  ],
};

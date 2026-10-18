// NIVL · IRON · Peso muerto a una pierna con mancuerna, vista lateral.
//
// Se apoya la pierna cercana con la rodilla suave; la lejana se va atrás en
// línea con el tronco como contrapeso. La mancuerna cuelga bajo el hombro.
// Trabaja glúteo e isquios de la pierna de apoyo y el equilibrio de la cadera.
// Biomecánica (comprobada en src/iron/__tests__/pierna.test.ts):
// · Pie de apoyo plano; espinilla casi vertical y rodilla suave (≤ 25°).
// · Abajo, la pierna lejana sigue la línea del tronco (cadera lejana ±10°).
// · El brazo cuelga vertical (±12°) y el pie lejano no toca el suelo.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const ARRIBA: Extremidades = { cadera: 8, rodilla: 8, tobillo: 4, hombro: 4, codo: 0 };
const MEDIO: Extremidades = { cadera: 54, rodilla: 14, tobillo: 0, hombro: 40, codo: 0 };
const ABAJO: Extremidades = { cadera: 98, rodilla: 20, tobillo: -2, hombro: 76, codo: 0 };

const ARRIBA_L: Extremidades = { ...ARRIBA, cadera: -10, rodilla: 45, tobillo: 0 };
const MEDIO_L: Extremidades = { ...MEDIO, cadera: -4, rodilla: 12, tobillo: 0 };
const ABAJO_L: Extremidades = { ...ABAJO, cadera: 0, rodilla: 4, tobillo: 0 };

const pose = (ms: number, cerca: Extremidades, lejos: Extremidades, cuello: number): Pose => ({ ms, cerca, lejos, cuello });

export const pesoMuertoUnaPierna: Ejercicio = {
  id: 'peso-muerto-una-pierna',
  nombre: 'iron-pierna:ejercicios.peso-muerto-una-pierna.nombre',
  grupo: 'pierna',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['mancuerna'],
  musculos: {
    principales: ['gluteo', 'isquiotibiales'],
    secundarios: ['gluteo_medio', 'lumbares', 'aductores'],
  },
  sustitutos: ['peso-muerto-rumano-mancuerna', 'puente-gluteo-una-pierna'],
  vista: 'lateral',
  ancla: { punto: 'tobillo_c', x: 0, y: 4, segmento: 'pie_c', angulo: 0 },
  poses: [
    pose(0, ARRIBA, ARRIBA_L, 0),
    pose(400, ARRIBA, ARRIBA_L, 0),
    pose(1400, MEDIO, MEDIO_L, 4),
    pose(2400, ABAJO, ABAJO_L, 6),
    pose(2700, ABAJO, ABAJO_L, 6),
    pose(3500, MEDIO, MEDIO_L, 4),
  ],
  cicloMs: 4400,
  esfuerzo: [{ desde: 2700, hasta: 4400 }],
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'punta', lados: ['cerca'] },
  encuadre: { x: -68, y: -4, ancho: 120, alto: 106 },
  cues: [
    'iron-pierna:ejercicios.peso-muerto-una-pierna.cues.linea',
    'iron-pierna:ejercicios.peso-muerto-una-pierna.cues.cadera',
    'iron-pierna:ejercicios.peso-muerto-una-pierna.cues.apoyo',
  ],
  errores: [
    'iron-pierna:ejercicios.peso-muerto-una-pierna.errores.abrir',
    'iron-pierna:ejercicios.peso-muerto-una-pierna.errores.redondear',
  ],
};

// NIVL · IRON · Swing con kettlebell (ruso, a la altura del pecho), vista lateral.
//
// Bisagra explosiva: la kettlebell pasa entre las piernas y la cadera la
// lanza hasta el pecho con los brazos estirados; los brazos solo la guían.
// Biomecánica (comprobada en src/iron/__tests__/pierna.test.ts):
// · Pies planos; es una bisagra, no una sentadilla: rodillas ≤ 25° y la
//   cadera siempre por encima de la rodilla.
// · Arriba, de pie y bloqueado: tronco vertical, cadera extendida y la
//   kettlebell a la altura del pecho (el brazo horizontal ±12°).
// · Atrás, la kettlebell pasa por detrás de las rodillas, entre las piernas.
// · Brazos estirados todo el recorrido (codo 0).

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const ATRAS: Extremidades = { cadera: 73, rodilla: 22, tobillo: 9, hombro: 22.3, codo: 0 };
const MEDIO: Extremidades = { cadera: 34, rodilla: 10, tobillo: 4, hombro: 58, codo: 0 };
const ARRIBA: Extremidades = { cadera: -3, rodilla: 2, tobillo: 2, hombro: 83, codo: 0 };

const pose = (ms: number, cerca: Extremidades, cuello: number): Pose => ({ ms, cerca, cuello });

export const swingKettlebell: Ejercicio = {
  id: 'swing-kettlebell',
  nombre: 'iron-pierna:ejercicios.swing-kettlebell.nombre',
  grupo: 'pierna',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['kettlebell'],
  musculos: {
    principales: ['gluteo', 'isquiotibiales'],
    secundarios: ['lumbares', 'abdomen', 'antebrazo', 'deltoides_anterior'],
  },
  sustitutos: ['hip-thrust', 'peso-muerto-rumano-mancuerna'],
  vista: 'lateral',
  ancla: { punto: 'tobillo_c', x: 0, y: 4, segmento: 'pie_c', angulo: 0 },
  poses: [pose(0, ATRAS, 6), pose(450, MEDIO, 2), pose(750, ARRIBA, 0), pose(950, ARRIBA, 0), pose(1350, MEDIO, 2)],
  cicloMs: 1800,
  esfuerzo: [{ desde: 0, hasta: 750 }],
  // La ficha enseña el final del lanzamiento: cadera bloqueada y kettlebell al pecho.
  msFicha: 850,
  carga: { tipo: 'kettlebell', en: 'agarre', cuelga: 'antebrazo' },
  encuadre: { x: -46, y: -4, ancho: 108, alto: 112 },
  cues: [
    'iron-pierna:ejercicios.swing-kettlebell.cues.cadera',
    'iron-pierna:ejercicios.swing-kettlebell.cues.brazos',
    'iron-pierna:ejercicios.swing-kettlebell.cues.bloqueo',
  ],
  errores: [
    'iron-pierna:ejercicios.swing-kettlebell.errores.sentadilla',
    'iron-pierna:ejercicios.swing-kettlebell.errores.brazos',
    'iron-pierna:ejercicios.swing-kettlebell.errores.lumbar',
  ],
};

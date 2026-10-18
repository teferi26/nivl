// NIVL · IRON · Pullover con mancuerna, tumbado en el banco.
//
// Tumbado como en el press de banca (cabeza a la izquierda, pies planos), una
// mancuerna sujeta con las dos manos. Los brazos, casi rectos, van de encima
// del pecho a detrás de la cabeza (en línea con el tronco) y vuelven.
// Biomecánica (src/iron/__tests__/espalda.test.ts): el codo no cambia (el
// movimiento es solo del hombro), la mancuerna nunca baja del banco y la
// cabeza sigue apoyada.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const PIERNAS = { cadera: -15, rodilla: 85.5, tobillo: 7 } as const;
const brazos = (hombro: number): Extremidades => ({ ...PIERNAS, hombro, codo: 14 });
const p = (ms: number, hombro: number): Pose => ({ ms, cuello: 0, cerca: brazos(hombro) });

export const pulloverMancuerna: Ejercicio = {
  id: 'pullover-mancuerna',
  nombre: 'iron-espalda:ejercicios.pullover-mancuerna.nombre',
  grupo: 'espalda',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['mancuerna', 'banco'],
  musculos: {
    principales: ['dorsal'],
    secundarios: ['pectoral', 'triceps', 'abdomen', 'deltoides_posterior'],
  },
  sustitutos: ['pullover-polea', 'jalon-pecho'],
  vista: 'lateral',
  // Igual que el press de banca: espalda alta y cabeza apoyadas.
  ancla: { punto: 'cadera', x: 0, y: 33.2, segmento: 'tronco', angulo: 183.5 },
  poses: [p(0, 80), p(400, 80), p(1600, 165), p(1900, 165), p(2900, 118)],
  cicloMs: 3600,
  esfuerzo: [{ desde: 1900, hasta: 3600 }],
  msFicha: 1750,
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'punta', lados: ['cerca'] },
  escenario: [{ tipo: 'banco', x: -54, ancho: 68, alto: 24.6, capa: 'medio' }],
  encuadre: { x: -80, y: -4, ancho: 118, alto: 96 },
  cues: [
    'iron-espalda:ejercicios.pullover-mancuerna.cues.agarre',
    'iron-espalda:ejercicios.pullover-mancuerna.cues.codos',
    'iron-espalda:ejercicios.pullover-mancuerna.cues.rango',
  ],
  errores: [
    'iron-espalda:ejercicios.pullover-mancuerna.errores.lumbar',
    'iron-espalda:ejercicios.pullover-mancuerna.errores.codos',
  ],
};

// NIVL · IRON · Superman (en el suelo, sin material).
//
// Boca abajo con los brazos estirados por delante. Se levantan a la vez el
// pecho, los brazos y las piernas unos centímetros, se aguanta un momento y
// se baja. El apoyo es la pelvis (el ancla es la cadera en el suelo).
// Biomecánica (src/iron/__tests__/espalda.test.ts): la elevación es pequeña
// (tronco ≤ 18° y piernas ≤ 15°), la cadera no se mueve y nada atraviesa el
// suelo.

import type { Ejercicio, Pose } from '../../tipos';

const SUELO: Pose['cerca'] = { cadera: 0, rodilla: 0, tobillo: -50, hombro: 178, codo: 0 };
const ARRIBA: Pose['cerca'] = { cadera: -26, rodilla: 5, tobillo: -50, hombro: 176, codo: 0 };

const p = (ms: number, cerca: Pose['cerca'], angulo: number): Pose => ({ ms, cuello: 0, cerca, angulo });

export const superman: Ejercicio = {
  id: 'superman',
  nombre: 'iron-espalda:ejercicios.superman.nombre',
  grupo: 'espalda',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['peso_corporal'],
  musculos: {
    principales: ['lumbares'],
    secundarios: ['gluteo', 'isquiotibiales', 'espalda_alta', 'deltoides_posterior'],
  },
  sustitutos: ['hiperextension', 'peso-muerto-mancuernas'],
  vista: 'lateral',
  ancla: { punto: 'cadera', x: 0, y: 6.8, segmento: 'tronco', angulo: 0 },
  poses: [p(0, SUELO, 0), p(500, SUELO, 0), p(1200, ARRIBA, 14), p(2400, ARRIBA, 14)],
  cicloMs: 3400,
  esfuerzo: [{ desde: 500, hasta: 2400 }],
  msFicha: 1800,
  encuadre: { x: -66, y: -4, ancho: 142, alto: 44 },
  cues: [
    'iron-espalda:ejercicios.superman.cues.mirada',
    'iron-espalda:ejercicios.superman.cues.poco',
    'iron-espalda:ejercicios.superman.cues.pausa',
  ],
  errores: [
    'iron-espalda:ejercicios.superman.errores.cuello',
    'iron-espalda:ejercicios.superman.errores.impulso',
  ],
};

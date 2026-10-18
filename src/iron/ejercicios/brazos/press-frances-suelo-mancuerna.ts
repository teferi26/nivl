// NIVL · IRON · Press francés en el suelo con mancuernas (en casa, sin banco).
//
// Tumbado boca arriba en el suelo, rodillas dobladas y pies planos. Brazos
// casi verticales y quietos; las mancuernas bajan hasta los lados de la
// cabeza. El suelo pone el tope: no hace falta banco.
// Biomecánica (comprobada en src/iron/__tests__/brazos.test.ts): el brazo no
// se mueve, nada atraviesa el suelo y los pies quedan planos.

import type { Ejercicio, Extremidades } from '../../tipos';
import { pose, textos } from './comun';

// Tronco a 180° (cabeza a la izquierda), muslo a 40° y pierna a -53,5°: pie plano.
const PIERNAS = { cadera: 40, rodilla: 93.5, tobillo: -36.5 } as const;
// hombro 100 = brazo a 100° en el mundo.
const ARRIBA: Extremidades = { ...PIERNAS, hombro: 100, codo: 6 };
const MEDIO: Extremidades = { ...PIERNAS, hombro: 100, codo: 55 };
const ABAJO: Extremidades = { ...PIERNAS, hombro: 100, codo: 90 };
const T = textos('press-frances-suelo-mancuerna', ['apoyo', 'brazos', 'bajada'], ['brazosMovidos', 'golpe']);

export const pressFrancesSueloMancuerna: Ejercicio = {
  id: 'press-frances-suelo-mancuerna',
  nombre: T.nombre,
  grupo: 'brazo',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['mancuerna'],
  musculos: { principales: ['triceps'], secundarios: ['antebrazo'] },
  sustitutos: ['press-frances-mancuerna', 'extension-triceps-cabeza-mancuerna', 'flexiones-diamante'],
  vista: 'lateral',
  ancla: { punto: 'cadera', x: 0, y: 8, segmento: 'tronco', angulo: 180 },
  poses: [pose(0, ARRIBA), pose(400, ARRIBA), pose(1300, MEDIO), pose(2100, ABAJO), pose(2350, ABAJO), pose(3000, MEDIO)],
  cicloMs: 3700,
  esfuerzo: [{ desde: 2350, hasta: 3700 }],
  msFicha: 3000,
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'lado', lados: ['cerca'] },
  encuadre: { x: -66, y: -4, ancho: 116, alto: 64 },
  cues: T.cues,
  errores: T.errores,
};

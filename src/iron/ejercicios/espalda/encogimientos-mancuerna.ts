// NIVL · IRON · Encogimientos con mancuernas, de pie.
//
// Igual que con barra, con una mancuerna en cada mano a los lados (agarre
// neutro: se ve a lo largo). La subida del hombro se dibuja alargando el
// tronco (escorzo de 0,93 a 1). Reglas en src/iron/__tests__/espalda.test.ts.

import type { Ejercicio } from '../../tipos';
import { ANCLA_DE_PIE, pose, type Absolutos } from './_pose';

const DE_PIE: Absolutos = { tronco: 89, cabeza: 89, muslo: -89, pierna: -91, pie: 0, brazo: -89, antebrazo: -89 };
const ABAJO = pose(0, DE_PIE, { escorzo: { tronco: 0.93 } });
const ARRIBA = (ms: number) => pose(ms, DE_PIE, { escorzo: { tronco: 1 } });

export const encogimientosMancuerna: Ejercicio = {
  id: 'encogimientos-mancuerna',
  nombre: 'iron-espalda:ejercicios.encogimientos-mancuerna.nombre',
  grupo: 'espalda',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['mancuerna'],
  musculos: {
    principales: ['trapecio'],
    secundarios: ['espalda_alta', 'antebrazo'],
  },
  sustitutos: ['encogimientos-barra'],
  vista: 'lateral',
  ancla: ANCLA_DE_PIE,
  poses: [ABAJO, { ...ABAJO, ms: 400 }, ARRIBA(1000), ARRIBA(1600)],
  cicloMs: 2700,
  esfuerzo: [{ desde: 400, hasta: 1000 }],
  msFicha: 1300,
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'lado', lados: ['cerca', 'lejos'] },
  encuadre: { x: -30, y: -4, ancho: 64, alto: 112 },
  cues: [
    'iron-espalda:ejercicios.encogimientos-mancuerna.cues.vertical',
    'iron-espalda:ejercicios.encogimientos-mancuerna.cues.brazos',
    'iron-espalda:ejercicios.encogimientos-mancuerna.cues.pausa',
  ],
  errores: [
    'iron-espalda:ejercicios.encogimientos-mancuerna.errores.rodar',
    'iron-espalda:ejercicios.encogimientos-mancuerna.errores.cabeza',
  ],
};

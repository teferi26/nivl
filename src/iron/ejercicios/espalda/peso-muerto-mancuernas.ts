// NIVL · IRON · Peso muerto con mancuernas (la versión de casa).
//
// Una mancuerna en cada mano, a los lados de las piernas (agarre neutro: se
// ve a lo largo). Bisagra de cadera hasta media espinilla, espalda neutra y
// vuelta a estar de pie apretando glúteos. Reglas en
// src/iron/__tests__/espalda.test.ts.

import type { Ejercicio } from '../../tipos';
import { ANCLA_DE_PIE, pose, type Absolutos } from './_pose';
import { enBarra } from './_peso-muerto';

const ARRIBA: Absolutos = { tronco: 89, cabeza: 89, muslo: -88, pierna: -91, pie: 0, brazo: -90, antebrazo: -90 };
const MEDIO = enBarra(56, 33, -91, 64);
const ABAJO = enBarra(30, 19, -92, 40);

export const pesoMuertoMancuernas: Ejercicio = {
  id: 'peso-muerto-mancuernas',
  nombre: 'iron-espalda:ejercicios.peso-muerto-mancuernas.nombre',
  grupo: 'espalda',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['mancuerna'],
  musculos: {
    principales: ['lumbares', 'gluteo', 'isquiotibiales'],
    secundarios: ['cuadriceps', 'trapecio', 'antebrazo', 'abdomen'],
  },
  sustitutos: ['peso-muerto', 'peso-muerto-rumano', 'superman'],
  vista: 'lateral',
  ancla: ANCLA_DE_PIE,
  poses: [pose(0, ARRIBA), pose(400, ARRIBA), pose(1200, MEDIO), pose(2000, ABAJO), pose(2300, ABAJO), pose(2900, MEDIO)],
  cicloMs: 3700,
  esfuerzo: [{ desde: 2300, hasta: 3700 }],
  msFicha: 2150,
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'lado', lados: ['cerca', 'lejos'] },
  encuadre: { x: -34, y: -4, ancho: 80, alto: 112 },
  cues: [
    'iron-espalda:ejercicios.peso-muerto-mancuernas.cues.cadera',
    'iron-espalda:ejercicios.peso-muerto-mancuernas.cues.espalda',
    'iron-espalda:ejercicios.peso-muerto-mancuernas.cues.arriba',
  ],
  errores: [
    'iron-espalda:ejercicios.peso-muerto-mancuernas.errores.lumbar',
    'iron-espalda:ejercicios.peso-muerto-mancuernas.errores.lejos',
  ],
};

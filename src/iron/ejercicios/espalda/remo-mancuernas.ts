// NIVL · IRON · Remo con dos mancuernas, de pie e inclinado.
//
// La versión de casa del remo con barra: agarre neutro (palmas enfrentadas,
// la mancuerna se ve a lo largo), codos pegados y tirón hacia la cadera.
// Reglas en src/iron/__tests__/espalda.test.ts.

import type { Ejercicio } from '../../tipos';
import { ANCLA_DE_PIE } from './_pose';
import { CICLO_REMO, ESFUERZO_REMO, posesRemo, remo } from './_remo';

const R = remo({ tronco: 45, mano: { x: 4.5, y: 30 }, cabeza: 58, t: 0.42, separacion: 6.4 });

export const remoMancuernas: Ejercicio = {
  id: 'remo-mancuernas',
  nombre: 'iron-espalda:ejercicios.remo-mancuernas.nombre',
  grupo: 'espalda',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['mancuerna'],
  musculos: {
    principales: ['dorsal'],
    secundarios: ['espalda_alta', 'trapecio', 'deltoides_posterior', 'biceps', 'lumbares'],
  },
  sustitutos: ['remo-mancuerna', 'remo-barra', 'remo-invertido'],
  vista: 'lateral',
  ancla: ANCLA_DE_PIE,
  poses: posesRemo(R),
  cicloMs: CICLO_REMO,
  esfuerzo: ESFUERZO_REMO,
  msFicha: 200,
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'lado', lados: ['cerca', 'lejos'] },
  encuadre: { x: -40, y: -4, ancho: 88, alto: 92 },
  cues: [
    'iron-espalda:ejercicios.remo-mancuernas.cues.bisagra',
    'iron-espalda:ejercicios.remo-mancuernas.cues.codos',
    'iron-espalda:ejercicios.remo-mancuernas.cues.cuello',
  ],
  errores: [
    'iron-espalda:ejercicios.remo-mancuernas.errores.tronco',
    'iron-espalda:ejercicios.remo-mancuernas.errores.encoger',
  ],
};

// NIVL · IRON · Hombro · Elevación frontal con banda elástica, de pie, vista lateral.
//
// La banda pisada bajo los pies: la tensión crece al subir. Opción para casa
// con la misma técnica que con mancuernas (elevaciones-frontales.ts).

import type { Ejercicio } from '../../tipos';
import { ANCLA_PIE_LATERAL } from './comun';
import { POSES_FRONTAL } from './elevaciones-frontales';

export const elevacionFrontalBanda: Ejercicio = {
  id: 'elevacion-frontal-banda',
  nombre: 'iron-hombro:ejercicios.elevacion-frontal-banda.nombre',
  grupo: 'hombro',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['banda'],
  musculos: {
    principales: ['deltoides_anterior'],
    secundarios: ['deltoides_lateral', 'pectoral', 'trapecio'],
  },
  sustitutos: ['elevaciones-frontales', 'elevacion-frontal-barra'],
  vista: 'lateral',
  ancla: ANCLA_PIE_LATERAL,
  poses: POSES_FRONTAL,
  cicloMs: 3700,
  esfuerzo: [{ desde: 300, hasta: 1300 }],
  msFicha: 1450,
  carga: { tipo: 'banda', en: 'agarre', lados: ['cerca'], anclaje: 'pies' },
  encuadre: { x: -32, y: -4, ancho: 96, alto: 112 },
  cues: [
    'iron-hombro:ejercicios.elevacion-frontal-banda.cues.pisada',
    'iron-hombro:ejercicios.elevacion-frontal-banda.cues.altura',
    'iron-hombro:ejercicios.elevacion-frontal-banda.cues.bajada',
  ],
  errores: [
    'iron-hombro:ejercicios.elevacion-frontal-banda.errores.balanceo',
    'iron-hombro:ejercicios.elevacion-frontal-banda.errores.soltar',
  ],
};

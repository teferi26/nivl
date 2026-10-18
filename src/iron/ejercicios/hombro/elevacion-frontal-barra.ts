// NIVL · IRON · Hombro · Elevación frontal con barra, de pie, vista lateral.
//
// La misma técnica que con mancuernas (src/iron/ejercicios/hombro/
// elevaciones-frontales.ts), con las dos manos en la barra: no se puede
// compensar un brazo con el otro. Cámara en 3/4 para que el disco no tape.

import type { Ejercicio } from '../../tipos';
import { ANCLA_PIE_LATERAL } from './comun';
import { POSES_FRONTAL } from './elevaciones-frontales';

export const elevacionFrontalBarra: Ejercicio = {
  id: 'elevacion-frontal-barra',
  nombre: 'iron-hombro:ejercicios.elevacion-frontal-barra.nombre',
  grupo: 'hombro',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['barra'],
  musculos: {
    principales: ['deltoides_anterior'],
    secundarios: ['deltoides_lateral', 'pectoral', 'trapecio', 'abdomen'],
  },
  sustitutos: ['elevaciones-frontales', 'elevacion-frontal-banda'],
  vista: 'lateral',
  ancla: ANCLA_PIE_LATERAL,
  poses: POSES_FRONTAL,
  cicloMs: 3700,
  esfuerzo: [{ desde: 300, hasta: 1300 }],
  msFicha: 1450,
  carga: { tipo: 'barra', en: 'agarre', disco: 7.5, eje: { x: 11, y: -5 } },
  encuadre: { x: -32, y: -4, ancho: 96, alto: 112 },
  cues: [
    'iron-hombro:ejercicios.elevacion-frontal-barra.cues.altura',
    'iron-hombro:ejercicios.elevacion-frontal-barra.cues.tronco',
    'iron-hombro:ejercicios.elevacion-frontal-barra.cues.ligera',
  ],
  errores: [
    'iron-hombro:ejercicios.elevacion-frontal-barra.errores.balanceo',
    'iron-hombro:ejercicios.elevacion-frontal-barra.errores.codos',
  ],
};

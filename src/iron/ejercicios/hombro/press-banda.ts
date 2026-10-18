// NIVL · IRON · Hombro · Press de hombro con banda elástica, de pie.
//
// La banda pisada bajo los pies y un extremo en cada mano: la misma técnica
// que con mancuernas (press-militar-mancuerna.ts), vista frontal. Opción para
// casa; la tensión es máxima arriba, donde el hombro es más fuerte.

import type { Ejercicio } from '../../tipos';
import { ANCLA_PIE_FRONTAL } from './comun';
import { POSES_PRESS_FRONTAL } from './press-militar-mancuerna';

export const pressBanda: Ejercicio = {
  id: 'press-banda',
  nombre: 'iron-hombro:ejercicios.press-banda.nombre',
  grupo: 'hombro',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['banda'],
  musculos: {
    principales: ['deltoides_anterior'],
    secundarios: ['deltoides_lateral', 'triceps', 'trapecio'],
  },
  sustitutos: ['press-militar-mancuerna', 'flexion-pica'],
  vista: 'frontal',
  ancla: ANCLA_PIE_FRONTAL,
  poses: POSES_PRESS_FRONTAL,
  cicloMs: 3400,
  esfuerzo: [{ desde: 300, hasta: 1300 }],
  msFicha: 800,
  carga: { tipo: 'banda', en: 'agarre', lados: ['cerca', 'lejos'], anclaje: 'pies' },
  encuadre: { x: -54, y: -4, ancho: 108, alto: 136 },
  cues: [
    'iron-hombro:ejercicios.press-banda.cues.pisada',
    'iron-hombro:ejercicios.press-banda.cues.antebrazos',
    'iron-hombro:ejercicios.press-banda.cues.abdomen',
  ],
  errores: [
    'iron-hombro:ejercicios.press-banda.errores.arco',
    'iron-hombro:ejercicios.press-banda.errores.soltar',
  ],
};

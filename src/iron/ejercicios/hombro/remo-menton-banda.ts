// NIVL · IRON · Hombro · Remo al mentón con banda elástica.
//
// La misma técnica que con barra (remo-menton-barra.ts), vista frontal.
// La banda pisada bajo los pies: opción para casa; más tensión arriba.

import type { Ejercicio } from '../../tipos';
import { ANCLA_PIE_FRONTAL } from './comun';
import { POSES_REMO_MENTON } from './remo-menton-barra';

export const remoMentonBanda: Ejercicio = {
  id: 'remo-menton-banda',
  nombre: 'iron-hombro:ejercicios.remo-menton-banda.nombre',
  grupo: 'hombro',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['banda'],
  musculos: {
    principales: ['deltoides_lateral'],
    secundarios: ['trapecio', 'deltoides_anterior', 'biceps', 'antebrazo'],
  },
  sustitutos: ['remo-menton-mancuerna', 'remo-menton-barra', 'elevacion-lateral-banda'],
  vista: 'frontal',
  ancla: ANCLA_PIE_FRONTAL,
  poses: POSES_REMO_MENTON,
  cicloMs: 3300,
  esfuerzo: [{ desde: 300, hasta: 1250 }],
  msFicha: 1400,
  carga: { tipo: 'banda', en: 'agarre', lados: ['cerca', 'lejos'], anclaje: 'pies' },
  encuadre: { x: -54, y: -4, ancho: 108, alto: 112 },
  cues: [
    'iron-hombro:ejercicios.remo-menton-banda.cues.agarre',
    'iron-hombro:ejercicios.remo-menton-banda.cues.codos',
    'iron-hombro:ejercicios.remo-menton-banda.cues.altura',
  ],
  errores: [
    'iron-hombro:ejercicios.remo-menton-banda.errores.estrecho',
    'iron-hombro:ejercicios.remo-menton-banda.errores.alto',
    'iron-hombro:ejercicios.remo-menton-banda.errores.balanceo',
  ],
};

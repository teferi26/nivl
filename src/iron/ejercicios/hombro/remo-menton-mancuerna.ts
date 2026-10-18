// NIVL · IRON · Hombro · Remo al mentón con mancuernas.
//
// La misma técnica que con barra (remo-menton-barra.ts), vista frontal.
// Con mancuernas cada mano sigue su camino: más cómodo para la muñeca.
// La mancuerna se dibuja de punta para que no gire con el antebrazo.

import type { Ejercicio } from '../../tipos';
import { ANCLA_PIE_FRONTAL } from './comun';
import { POSES_REMO_MENTON } from './remo-menton-barra';

export const remoMentonMancuerna: Ejercicio = {
  id: 'remo-menton-mancuerna',
  nombre: 'iron-hombro:ejercicios.remo-menton-mancuerna.nombre',
  grupo: 'hombro',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['mancuerna'],
  musculos: {
    principales: ['deltoides_lateral'],
    secundarios: ['trapecio', 'deltoides_anterior', 'biceps', 'antebrazo'],
  },
  sustitutos: ['remo-menton-barra', 'remo-menton-banda', 'elevaciones-laterales'],
  vista: 'frontal',
  ancla: ANCLA_PIE_FRONTAL,
  poses: POSES_REMO_MENTON,
  cicloMs: 3300,
  esfuerzo: [{ desde: 300, hasta: 1250 }],
  msFicha: 1400,
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'lado', lados: ['cerca', 'lejos'] },
  encuadre: { x: -54, y: -4, ancho: 108, alto: 112 },
  cues: [
    'iron-hombro:ejercicios.remo-menton-mancuerna.cues.agarre',
    'iron-hombro:ejercicios.remo-menton-mancuerna.cues.codos',
    'iron-hombro:ejercicios.remo-menton-mancuerna.cues.altura',
  ],
  errores: [
    'iron-hombro:ejercicios.remo-menton-mancuerna.errores.estrecho',
    'iron-hombro:ejercicios.remo-menton-mancuerna.errores.alto',
    'iron-hombro:ejercicios.remo-menton-mancuerna.errores.balanceo',
  ],
};

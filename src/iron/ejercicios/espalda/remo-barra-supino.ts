// NIVL · IRON · Remo con barra supino (palmas hacia arriba).
//
// Tronco más erguido (unos 65°) y la barra llega a la parte baja del
// abdomen, con los codos pegados al cuerpo. El bíceps ayuda más.
// Reglas en src/iron/__tests__/espalda.test.ts.

import type { Ejercicio } from '../../tipos';
import { ANCLA_DE_PIE } from './_pose';
import { CICLO_REMO, ESFUERZO_REMO, posesRemo, remo } from './_remo';

const R = remo({ tronco: 65, mano: { x: 4.5, y: 40 }, cabeza: 72, t: 0.32, separacion: 6.6 });

export const remoBarraSupino: Ejercicio = {
  id: 'remo-barra-supino',
  nombre: 'iron-espalda:ejercicios.remo-barra-supino.nombre',
  grupo: 'espalda',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['barra'],
  musculos: {
    principales: ['dorsal'],
    secundarios: ['espalda_alta', 'biceps', 'trapecio', 'deltoides_posterior', 'lumbares'],
  },
  sustitutos: ['remo-barra', 'jalon-supino', 'remo-mancuernas'],
  vista: 'lateral',
  ancla: ANCLA_DE_PIE,
  poses: posesRemo(R),
  cicloMs: CICLO_REMO,
  esfuerzo: ESFUERZO_REMO,
  msFicha: 200,
  carga: { tipo: 'barra', en: 'agarre', disco: 10, eje: { x: 13, y: -9 } },
  encuadre: { x: -36, y: -4, ancho: 92, alto: 112 },
  cues: [
    'iron-espalda:ejercicios.remo-barra-supino.cues.tronco',
    'iron-espalda:ejercicios.remo-barra-supino.cues.codos',
    'iron-espalda:ejercicios.remo-barra-supino.cues.bajada',
  ],
  errores: [
    'iron-espalda:ejercicios.remo-barra-supino.errores.balanceo',
    'iron-espalda:ejercicios.remo-barra-supino.errores.munecas',
  ],
};

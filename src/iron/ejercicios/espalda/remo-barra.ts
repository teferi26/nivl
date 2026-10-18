// NIVL · IRON · Remo con barra (agarre prono), de pie e inclinado.
//
// Biomecánica (src/iron/__tests__/espalda.test.ts):
// · Tronco a unos 50° del suelo, quieto: solo se mueven los brazos.
// · La barra cuelga y sube sobre el medio del pie (±3).
// · Antebrazos casi verticales: tira el codo, que arriba pasa la espalda.
// · Pies planos y espalda neutra (la cabeza sigue al tronco).

import type { Ejercicio } from '../../tipos';
import { ANCLA_DE_PIE } from './_pose';
import { CICLO_REMO, ESFUERZO_REMO, posesRemo, remo } from './_remo';

const R = remo({ tronco: 50, mano: { x: 4.5, y: 32 }, cabeza: 62, t: 0.42, separacion: 7 });

export const remoBarra: Ejercicio = {
  id: 'remo-barra',
  nombre: 'iron-espalda:ejercicios.remo-barra.nombre',
  grupo: 'espalda',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['barra'],
  musculos: {
    principales: ['dorsal', 'espalda_alta'],
    secundarios: ['trapecio', 'deltoides_posterior', 'biceps', 'lumbares', 'isquiotibiales'],
  },
  sustitutos: ['remo-mancuernas', 'remo-polea-sentado', 'remo-maquina'],
  vista: 'lateral',
  ancla: ANCLA_DE_PIE,
  poses: posesRemo(R),
  cicloMs: CICLO_REMO,
  esfuerzo: ESFUERZO_REMO,
  msFicha: 200,
  carga: { tipo: 'barra', en: 'agarre', disco: 11, eje: { x: 13, y: -9 } },
  encuadre: { x: -40, y: -4, ancho: 92, alto: 96 },
  cues: [
    'iron-espalda:ejercicios.remo-barra.cues.bisagra',
    'iron-espalda:ejercicios.remo-barra.cues.codos',
    'iron-espalda:ejercicios.remo-barra.cues.espalda',
  ],
  errores: [
    'iron-espalda:ejercicios.remo-barra.errores.tronco',
    'iron-espalda:ejercicios.remo-barra.errores.lumbar',
    'iron-espalda:ejercicios.remo-barra.errores.recorrido',
  ],
};

// NIVL · IRON · Remo en polea baja sentado, con barra larga y agarre abierto.
//
// La misma estación que el remo con triángulo, pero con agarre prono ancho:
// los codos se abren hacia fuera (el brazo sale del plano y al final se ve
// corto) y la barra llega a la parte baja del pecho. Carga más la espalda alta
// y el deltoides posterior. Reglas en src/iron/__tests__/espalda.test.ts.

import type { Ejercicio } from '../../tipos';
import { desde, sobreTronco } from './_pose';
import { anclaSentado, hombroSentado, poseSentado, sentado, type Sentado } from './_sentado';

const S: Sentado = { cadera: { x: 0, y: 27 }, tobillo: { x: 40, y: 15 }, pie: 75 };
const POLEA = { x: 61, y: 16 } as const;
const E_DELANTE = { brazo: 0.95, antebrazo: 0.97 };
const E_MEDIO = { brazo: 0.78, antebrazo: 0.96 };
const E_FIN = { brazo: 0.6, antebrazo: 0.95 };

const hacia = (de: { x: number; y: number }, a: { x: number; y: number }) => (Math.atan2(a.y - de.y, a.x - de.x) * 180) / Math.PI;
const H0 = hombroSentado(S, 84);
const MANO_DELANTE = desde(H0, hacia(H0, POLEA), 33);
const MANO_FIN = sobreTronco(S.cadera, 94, 0.66, 9);
const MANO_MEDIO = { x: (MANO_DELANTE.x + MANO_FIN.x) / 2 + 1, y: (MANO_DELANTE.y + MANO_FIN.y) / 2 + 1 };

const DELANTE = sentado(S, 84, MANO_DELANTE, E_DELANTE, true, 80);
const MEDIO = sentado(S, 89, MANO_MEDIO, E_MEDIO, true, 88);
const FIN = sentado(S, 94, MANO_FIN, E_FIN, true, 93);

const PIES = {
  x: S.tobillo.x + 4 * Math.cos((75 * Math.PI) / 180) + 5.2 * Math.cos((-15 * Math.PI) / 180),
  y: S.tobillo.y + 4 * Math.sin((75 * Math.PI) / 180) + 5.2 * Math.sin((-15 * Math.PI) / 180),
  angulo: 75,
};

export const remoPoleaAbierto: Ejercicio = {
  id: 'remo-polea-abierto',
  nombre: 'iron-espalda:ejercicios.remo-polea-abierto.nombre',
  grupo: 'espalda',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['polea'],
  musculos: {
    principales: ['espalda_alta', 'dorsal'],
    secundarios: ['deltoides_posterior', 'trapecio', 'biceps', 'antebrazo'],
  },
  sustitutos: ['remo-polea-sentado', 'face-pull', 'remo-maquina'],
  vista: 'lateral',
  ancla: anclaSentado(S, 84),
  poses: [
    poseSentado(0, DELANTE, E_DELANTE),
    poseSentado(400, DELANTE, E_DELANTE),
    poseSentado(900, MEDIO, E_MEDIO),
    poseSentado(1400, FIN, E_FIN),
    poseSentado(1700, FIN, E_FIN),
    poseSentado(2700, MEDIO, E_MEDIO),
  ],
  cicloMs: 3700,
  esfuerzo: [{ desde: 400, hasta: 1400 }],
  msFicha: 300,
  carga: { tipo: 'polea', agarre: 'barra', polea: POLEA, lados: ['cerca'], eje: { x: 4, y: 2.5 } },
  escenario: [
    { tipo: 'polea', x: POLEA.x + 3, y: POLEA.y, hacia: -1, alto: 58, capa: 'fondo' },
    { tipo: 'asiento', x: -6, alto: 20, ancho: 44, pies: PIES, capa: 'medio' },
  ],
  encuadre: { x: -36, y: -4, ancho: 108, alto: 82 },
  cues: [
    'iron-espalda:ejercicios.remo-polea-abierto.cues.agarre',
    'iron-espalda:ejercicios.remo-polea-abierto.cues.codos',
    'iron-espalda:ejercicios.remo-polea-abierto.cues.escapulas',
  ],
  errores: [
    'iron-espalda:ejercicios.remo-polea-abierto.errores.balanceo',
    'iron-espalda:ejercicios.remo-polea-abierto.errores.encoger',
  ],
};

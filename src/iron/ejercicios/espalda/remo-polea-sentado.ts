// NIVL · IRON · Remo en polea baja, sentado (agarre de triángulo).
//
// Sentado en el banco largo con los pies en la plataforma y las rodillas
// algo dobladas. El triángulo viaja de los brazos estirados al abdomen; el
// cable va del vértice a la polea baja en cada cuadro.
// Biomecánica (src/iron/__tests__/espalda.test.ts):
// · El tronco se mueve poco (de 82° a 96°): sin balanceo.
// · Al final el codo pasa la línea de la espalda.
// · El antebrazo sigue la línea del cable.

import type { Ejercicio } from '../../tipos';
import { desde, sobreTronco } from './_pose';
import { anclaSentado, hombroSentado, poseSentado, sentado, type Sentado } from './_sentado';

const S: Sentado = { cadera: { x: 0, y: 27 }, tobillo: { x: 40, y: 15 }, pie: 75 };
const POLEA = { x: 61, y: 16 } as const;
const E = { brazo: 0.97, antebrazo: 0.97 };

const hacia = (de: { x: number; y: number }, a: { x: number; y: number }) => (Math.atan2(a.y - de.y, a.x - de.x) * 180) / Math.PI;
const H0 = hombroSentado(S, 82);
const MANO_DELANTE = desde(H0, hacia(H0, POLEA), 33.5);
const MANO_FIN = sobreTronco(S.cadera, 96, 0.42, 7.6);
const MANO_MEDIO = { x: (MANO_DELANTE.x + MANO_FIN.x) / 2 + 1, y: (MANO_DELANTE.y + MANO_FIN.y) / 2 + 1 };

const DELANTE = sentado(S, 82, MANO_DELANTE, E, true, 78);
const MEDIO = sentado(S, 90, MANO_MEDIO, E, true, 88);
const FIN = sentado(S, 96, MANO_FIN, E, true, 94);

// La plataforma: a lo largo de la planta del pie, por delante de ella.
const PIES = {
  x: S.tobillo.x + 4 * Math.cos((75 * Math.PI) / 180) + 5.2 * Math.cos((-15 * Math.PI) / 180),
  y: S.tobillo.y + 4 * Math.sin((75 * Math.PI) / 180) + 5.2 * Math.sin((-15 * Math.PI) / 180),
  angulo: 75,
};

export const remoPoleaSentado: Ejercicio = {
  id: 'remo-polea-sentado',
  nombre: 'iron-espalda:ejercicios.remo-polea-sentado.nombre',
  grupo: 'espalda',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['polea'],
  musculos: {
    principales: ['dorsal', 'espalda_alta'],
    secundarios: ['trapecio', 'deltoides_posterior', 'biceps', 'antebrazo', 'lumbares'],
  },
  sustitutos: ['remo-maquina', 'remo-barra', 'remo-invertido'],
  vista: 'lateral',
  ancla: anclaSentado(S, 82),
  poses: [
    poseSentado(0, DELANTE, E),
    poseSentado(400, DELANTE, E),
    poseSentado(900, MEDIO, E),
    poseSentado(1400, FIN, E),
    poseSentado(1700, FIN, E),
    poseSentado(2700, MEDIO, E),
  ],
  cicloMs: 3700,
  esfuerzo: [{ desde: 400, hasta: 1400 }],
  msFicha: 300,
  carga: { tipo: 'polea', agarre: 'triangulo', polea: POLEA, lados: ['cerca'] },
  escenario: [
    { tipo: 'polea', x: POLEA.x + 3, y: POLEA.y, hacia: -1, alto: 58, capa: 'fondo' },
    { tipo: 'asiento', x: -6, alto: 20, ancho: 44, pies: PIES, capa: 'medio' },
  ],
  encuadre: { x: -36, y: -4, ancho: 108, alto: 82 },
  cues: [
    'iron-espalda:ejercicios.remo-polea-sentado.cues.pecho',
    'iron-espalda:ejercicios.remo-polea-sentado.cues.codos',
    'iron-espalda:ejercicios.remo-polea-sentado.cues.vuelta',
  ],
  errores: [
    'iron-espalda:ejercicios.remo-polea-sentado.errores.balanceo',
    'iron-espalda:ejercicios.remo-polea-sentado.errores.lumbar',
  ],
};

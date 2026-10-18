// NIVL · IRON · Jalón supino (palmas hacia ti, a la anchura de los hombros).
//
// Como el jalón al pecho, con los brazos en el plano: los codos bajan junto
// al cuerpo y el bíceps ayuda más. La barra llega a la parte baja del pecho.
// Reglas en src/iron/__tests__/espalda.test.ts.

import type { Ejercicio } from '../../tipos';
import { sobreTronco } from './_pose';
import { anclaSentado, JALON, manoArribaJalon, poseSentado, rodilloJalon, sentado } from './_sentado';

const E_ARRIBA = { brazo: 0.97, antebrazo: 0.97 };
const E_MEDIO = { brazo: 0.95, antebrazo: 0.97 };
const E_ABAJO = { brazo: 0.92, antebrazo: 0.97 };

const MANO_ARRIBA = manoArribaJalon(100, E_ARRIBA, 82);
const MANO_ABAJO = sobreTronco(JALON.cadera, 108, 0.8, 9.6);
const MANO_MEDIO = { x: (MANO_ARRIBA.x + MANO_ABAJO.x) / 2 + 1, y: (MANO_ARRIBA.y + MANO_ABAJO.y) / 2 };
const POLEA = { x: MANO_ARRIBA.x + 0.5, y: 116 };

const ARRIBA = sentado(JALON, 100, MANO_ARRIBA, E_ARRIBA, true, 104);
const MEDIO = sentado(JALON, 104, MANO_MEDIO, E_MEDIO, true, 110);
const ABAJO = sentado(JALON, 108, MANO_ABAJO, E_ABAJO, true, 112);

export const jalonSupino: Ejercicio = {
  id: 'jalon-supino',
  nombre: 'iron-espalda:ejercicios.jalon-supino.nombre',
  grupo: 'espalda',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['polea', 'maquina'],
  musculos: {
    principales: ['dorsal'],
    secundarios: ['biceps', 'espalda_alta', 'antebrazo', 'deltoides_posterior'],
  },
  sustitutos: ['dominada-supina', 'jalon-pecho', 'jalon-neutro'],
  vista: 'lateral',
  ancla: anclaSentado(JALON, 100),
  poses: [
    poseSentado(0, ARRIBA, E_ARRIBA),
    poseSentado(400, ARRIBA, E_ARRIBA),
    poseSentado(900, MEDIO, E_MEDIO),
    poseSentado(1400, ABAJO, E_ABAJO),
    poseSentado(1700, ABAJO, E_ABAJO),
    poseSentado(2700, MEDIO, E_MEDIO),
  ],
  cicloMs: 3700,
  esfuerzo: [{ desde: 400, hasta: 1400 }],
  msFicha: 1550,
  carga: { tipo: 'polea', agarre: 'barra', polea: POLEA, lados: ['cerca'], eje: { x: 4, y: 2.5 } },
  escenario: [
    { tipo: 'polea', x: 52, y: POLEA.y, hacia: -1, brazo: 52 - POLEA.x, capa: 'fondo' },
    { tipo: 'asiento', x: 2, alto: 23, ancho: 18, rodillo: rodilloJalon(), capa: 'medio' },
  ],
  encuadre: { x: -30, y: -4, ancho: 92, alto: 128 },
  cues: [
    'iron-espalda:ejercicios.jalon-supino.cues.agarre',
    'iron-espalda:ejercicios.jalon-supino.cues.codos',
    'iron-espalda:ejercicios.jalon-supino.cues.subida',
  ],
  errores: [
    'iron-espalda:ejercicios.jalon-supino.errores.balanceo',
    'iron-espalda:ejercicios.jalon-supino.errores.munecas',
  ],
};

// NIVL · IRON · Jalón con agarre neutro estrecho (triángulo).
//
// Palmas enfrentadas en el triángulo: brazos en el plano, codos pegados y
// tirón hacia la parte baja del pecho. El cable sale del vértice del
// triángulo. Reglas en src/iron/__tests__/espalda.test.ts.

import type { Ejercicio } from '../../tipos';
import { sobreTronco } from './_pose';
import { anclaSentado, JALON, manoArribaJalon, poseSentado, rodilloJalon, sentado } from './_sentado';

const E_ARRIBA = { brazo: 0.97, antebrazo: 0.97 };
const E_MEDIO = { brazo: 0.95, antebrazo: 0.97 };
const E_ABAJO = { brazo: 0.93, antebrazo: 0.97 };

const MANO_ARRIBA = manoArribaJalon(100, E_ARRIBA, 83);
const MANO_ABAJO = sobreTronco(JALON.cadera, 109, 0.78, 9.4);
const MANO_MEDIO = { x: (MANO_ARRIBA.x + MANO_ABAJO.x) / 2 + 1, y: (MANO_ARRIBA.y + MANO_ABAJO.y) / 2 };
const POLEA = { x: MANO_ARRIBA.x + 0.5, y: 116 };

const ARRIBA = sentado(JALON, 100, MANO_ARRIBA, E_ARRIBA, true, 104);
const MEDIO = sentado(JALON, 105, MANO_MEDIO, E_MEDIO, true, 110);
const ABAJO = sentado(JALON, 109, MANO_ABAJO, E_ABAJO, true, 113);

export const jalonNeutro: Ejercicio = {
  id: 'jalon-neutro',
  nombre: 'iron-espalda:ejercicios.jalon-neutro.nombre',
  grupo: 'espalda',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['polea', 'maquina'],
  musculos: {
    principales: ['dorsal'],
    secundarios: ['espalda_alta', 'biceps', 'antebrazo', 'deltoides_posterior'],
  },
  sustitutos: ['dominada-neutra', 'jalon-pecho', 'remo-polea-sentado'],
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
  carga: { tipo: 'polea', agarre: 'triangulo', polea: POLEA, lados: ['cerca'] },
  escenario: [
    { tipo: 'polea', x: 52, y: POLEA.y, hacia: -1, brazo: 52 - POLEA.x, capa: 'fondo' },
    { tipo: 'asiento', x: 2, alto: 23, ancho: 18, rodillo: rodilloJalon(), capa: 'medio' },
  ],
  encuadre: { x: -30, y: -4, ancho: 92, alto: 128 },
  cues: [
    'iron-espalda:ejercicios.jalon-neutro.cues.codos',
    'iron-espalda:ejercicios.jalon-neutro.cues.pecho',
    'iron-espalda:ejercicios.jalon-neutro.cues.subida',
  ],
  errores: [
    'iron-espalda:ejercicios.jalon-neutro.errores.balanceo',
    'iron-espalda:ejercicios.jalon-neutro.errores.encoger',
  ],
};

// NIVL · IRON · Jalón al pecho (agarre prono ancho), sentado en la máquina.
//
// Muslos bajo el rodillo y pies planos. La barra baja delante de la cara
// hasta la parte alta del pecho, con el tronco algo inclinado atrás.
// Biomecánica (src/iron/__tests__/espalda.test.ts):
// · El tronco se inclina como mucho 20° atrás y no se balancea.
// · Abajo la barra toca la parte alta del pecho, delante de la cara.
// · El antebrazo sigue la línea del cable (casi vertical): tira el codo.
// · El cable va del agarre a la polea en cada cuadro.
// Agarre ancho: el brazo sale del plano y abajo se ve corto (escorzo).

import type { Ejercicio } from '../../tipos';
import { sobreTronco } from './_pose';
import { anclaSentado, JALON, manoArribaJalon, poseSentado, rodilloJalon, sentado } from './_sentado';

const E_ARRIBA = { brazo: 0.92, antebrazo: 0.95 };
const E_MEDIO = { brazo: 0.84, antebrazo: 0.95 };
const E_ABAJO = { brazo: 0.74, antebrazo: 0.95 };

const MANO_ARRIBA = manoArribaJalon(100, E_ARRIBA);
const MANO_ABAJO = sobreTronco(JALON.cadera, 110, 0.88, 9.6);
const MANO_MEDIO = { x: (MANO_ARRIBA.x + MANO_ABAJO.x) / 2 + 0.6, y: (MANO_ARRIBA.y + MANO_ABAJO.y) / 2 };
const POLEA = { x: MANO_ARRIBA.x + 0.5, y: 116 };

const ARRIBA = sentado(JALON, 100, MANO_ARRIBA, E_ARRIBA, true, 104);
const MEDIO = sentado(JALON, 105, MANO_MEDIO, E_MEDIO, true, 112);
const ABAJO = sentado(JALON, 110, MANO_ABAJO, E_ABAJO, true, 114);

export const jalonPecho: Ejercicio = {
  id: 'jalon-pecho',
  nombre: 'iron-espalda:ejercicios.jalon-pecho.nombre',
  grupo: 'espalda',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['polea', 'maquina'],
  musculos: {
    principales: ['dorsal'],
    secundarios: ['espalda_alta', 'biceps', 'deltoides_posterior', 'antebrazo'],
  },
  sustitutos: ['dominada', 'jalon-neutro', 'pullover-polea'],
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
  carga: { tipo: 'polea', agarre: 'barra', polea: POLEA, lados: ['cerca'], eje: { x: 5, y: 3 } },
  escenario: [
    { tipo: 'polea', x: 52, y: POLEA.y, hacia: -1, brazo: 52 - POLEA.x, capa: 'fondo' },
    { tipo: 'asiento', x: 2, alto: 23, ancho: 18, rodillo: rodilloJalon(), capa: 'medio' },
  ],
  encuadre: { x: -30, y: -4, ancho: 92, alto: 128 },
  cues: [
    'iron-espalda:ejercicios.jalon-pecho.cues.rodillo',
    'iron-espalda:ejercicios.jalon-pecho.cues.pecho',
    'iron-espalda:ejercicios.jalon-pecho.cues.codos',
  ],
  errores: [
    'iron-espalda:ejercicios.jalon-pecho.errores.balanceo',
    'iron-espalda:ejercicios.jalon-pecho.errores.nuca',
    'iron-espalda:ejercicios.jalon-pecho.errores.subida',
  ],
};

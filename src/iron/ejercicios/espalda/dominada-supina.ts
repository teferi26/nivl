// NIVL · IRON · Dominada supina (palmas hacia ti, a la anchura de los hombros).
//
// Como la dominada, pero con el agarre estrecho los brazos van casi en el
// plano: arriba los codos quedan delante del cuerpo y el bíceps trabaja más.
// Biomecánica (src/iron/__tests__/espalda.test.ts): manos fijas en la barra,
// barbilla por encima arriba, brazos estirados abajo y tronco sin balanceo.

import type { Ejercicio } from '../../tipos';
import { ANCLA_COLGADO, BARRA_ALTA, colgado, ENCUADRE_COLGADO, ESCENARIO_BARRA_ALTA, piernasColgado, poseColgado } from './_colgado';
import type { Absolutos } from './_pose';

const ABAJO: Absolutos = { tronco: 93, cabeza: 108, ...piernasColgado(93), brazo: 85, antebrazo: 87 };
const MEDIO = colgado(99, 103, { x: -7, y: BARRA_ALTA.y - 22 }, 0.95, 0.97);
const ARRIBA = colgado(106, 114, { x: -11, y: BARRA_ALTA.y - 6 }, 0.92, 0.97);

export const dominadaSupina: Ejercicio = {
  id: 'dominada-supina',
  nombre: 'iron-espalda:ejercicios.dominada-supina.nombre',
  grupo: 'espalda',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['barra_fija'],
  musculos: {
    principales: ['dorsal', 'biceps'],
    secundarios: ['espalda_alta', 'antebrazo', 'deltoides_posterior', 'abdomen'],
  },
  sustitutos: ['jalon-supino', 'dominada', 'dominada-negativa'],
  vista: 'lateral',
  ancla: ANCLA_COLGADO,
  poses: [
    poseColgado(0, ABAJO, 0.97, 0.97),
    poseColgado(500, ABAJO, 0.97, 0.97),
    poseColgado(1150, MEDIO, 0.95, 0.97),
    poseColgado(1700, ARRIBA, 0.92, 0.97),
    poseColgado(2100, ARRIBA, 0.92, 0.97),
    poseColgado(3000, MEDIO, 0.95, 0.97),
  ],
  cicloMs: 4100,
  esfuerzo: [{ desde: 500, hasta: 1700 }],
  msFicha: 1900,
  escenario: ESCENARIO_BARRA_ALTA,
  encuadre: ENCUADRE_COLGADO,
  cues: [
    'iron-espalda:ejercicios.dominada-supina.cues.agarre',
    'iron-espalda:ejercicios.dominada-supina.cues.pecho',
    'iron-espalda:ejercicios.dominada-supina.cues.bajada',
  ],
  errores: [
    'iron-espalda:ejercicios.dominada-supina.errores.patada',
    'iron-espalda:ejercicios.dominada-supina.errores.medio',
  ],
};

// NIVL · IRON · Dominada neutra (palmas enfrentadas, en asas paralelas).
//
// El agarre más amable para hombros y codos. Brazos casi en el plano, un poco
// menos que en la supina. Mismas reglas que la dominada
// (src/iron/__tests__/espalda.test.ts).

import type { Ejercicio } from '../../tipos';
import { ANCLA_COLGADO, BARRA_ALTA, colgado, ENCUADRE_COLGADO, ESCENARIO_BARRA_ALTA, piernasColgado, poseColgado } from './_colgado';
import type { Absolutos } from './_pose';

const ABAJO: Absolutos = { tronco: 92, cabeza: 108, ...piernasColgado(92), brazo: 85, antebrazo: 87 };
const MEDIO = colgado(98, 102, { x: -5.5, y: BARRA_ALTA.y - 21.5 }, 0.92);
const ARRIBA = colgado(105, 113, { x: -9, y: BARRA_ALTA.y - 5.5 }, 0.86);

export const dominadaNeutra: Ejercicio = {
  id: 'dominada-neutra',
  nombre: 'iron-espalda:ejercicios.dominada-neutra.nombre',
  grupo: 'espalda',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['barra_fija'],
  musculos: {
    principales: ['dorsal'],
    secundarios: ['biceps', 'espalda_alta', 'antebrazo', 'deltoides_posterior', 'abdomen'],
  },
  sustitutos: ['jalon-neutro', 'dominada', 'dominada-supina'],
  vista: 'lateral',
  ancla: ANCLA_COLGADO,
  poses: [
    poseColgado(0, ABAJO, 0.95),
    poseColgado(500, ABAJO, 0.95),
    poseColgado(1150, MEDIO, 0.92),
    poseColgado(1700, ARRIBA, 0.86),
    poseColgado(2100, ARRIBA, 0.86),
    poseColgado(3000, MEDIO, 0.92),
  ],
  cicloMs: 4100,
  esfuerzo: [{ desde: 500, hasta: 1700 }],
  msFicha: 1900,
  escenario: ESCENARIO_BARRA_ALTA,
  encuadre: ENCUADRE_COLGADO,
  cues: [
    'iron-espalda:ejercicios.dominada-neutra.cues.agarre',
    'iron-espalda:ejercicios.dominada-neutra.cues.codos',
    'iron-espalda:ejercicios.dominada-neutra.cues.bajada',
  ],
  errores: [
    'iron-espalda:ejercicios.dominada-neutra.errores.hombros',
    'iron-espalda:ejercicios.dominada-neutra.errores.balanceo',
  ],
};

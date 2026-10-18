// NIVL · IRON · Dominada (agarre prono, algo más ancho que los hombros), vista lateral.
//
// Biomecánica (comprobada en src/iron/__tests__/espalda.test.ts):
// · Las manos no se mueven de la barra: el ancla es el puño cercano.
// · Abajo, brazos estirados por encima de la cabeza (colgado activo).
// · Arriba, la barbilla pasa la barra y la cabeza queda detrás de ella.
// · El antebrazo sigue casi vertical bajo la barra: tira el codo hacia abajo.
// · Tronco algo inclinado atrás, sin balanceo (como mucho 20°).
// El agarre ancho saca el brazo del plano: se ve corto arriba (escorzo).

import type { Ejercicio } from '../../tipos';
import { ANCLA_COLGADO, BARRA_ALTA, colgado, ENCUADRE_COLGADO, ESCENARIO_BARRA_ALTA, piernasColgado, poseColgado } from './_colgado';
import type { Absolutos } from './_pose';

// Abajo la cabeza mira un poco arriba y queda detrás del brazo: se ve la cara.
const ABAJO: Absolutos = { tronco: 92, cabeza: 108, ...piernasColgado(92), brazo: 86, antebrazo: 88 };
const MEDIO = colgado(97, 100, { x: -3.2, y: BARRA_ALTA.y - 21 }, 0.84);
const ARRIBA = colgado(104, 112, { x: -5, y: BARRA_ALTA.y - 5 }, 0.74);

export const dominada: Ejercicio = {
  id: 'dominada',
  nombre: 'iron-espalda:ejercicios.dominada.nombre',
  grupo: 'espalda',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['barra_fija'],
  musculos: {
    principales: ['dorsal'],
    secundarios: ['espalda_alta', 'biceps', 'deltoides_posterior', 'antebrazo', 'abdomen'],
  },
  sustitutos: ['jalon-pecho', 'dominada-negativa', 'remo-invertido'],
  vista: 'lateral',
  ancla: ANCLA_COLGADO,
  poses: [
    poseColgado(0, ABAJO, 0.92),
    poseColgado(500, ABAJO, 0.92),
    poseColgado(1150, MEDIO, 0.84),
    poseColgado(1700, ARRIBA, 0.74),
    poseColgado(2100, ARRIBA, 0.74),
    poseColgado(3000, MEDIO, 0.84),
  ],
  cicloMs: 4100,
  esfuerzo: [{ desde: 500, hasta: 1700 }],
  msFicha: 1900,
  escenario: ESCENARIO_BARRA_ALTA,
  encuadre: ENCUADRE_COLGADO,
  cues: [
    'iron-espalda:ejercicios.dominada.cues.hombros',
    'iron-espalda:ejercicios.dominada.cues.codos',
    'iron-espalda:ejercicios.dominada.cues.bajada',
  ],
  errores: [
    'iron-espalda:ejercicios.dominada.errores.balanceo',
    'iron-espalda:ejercicios.dominada.errores.medio',
    'iron-espalda:ejercicios.dominada.errores.cuello',
  ],
};

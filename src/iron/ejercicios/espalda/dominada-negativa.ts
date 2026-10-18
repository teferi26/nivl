// NIVL · IRON · Dominada negativa (solo la bajada, lenta).
//
// La progresión para quien aún no hace una dominada: se empieza arriba (con
// un salto o subido a un cajón) y se baja en 3 a 5 segundos. El esfuerzo es
// la bajada (excéntrica): en esa fase brilla el dorsal. La subida rápida del
// dibujo es el salto para volver a empezar.

import type { Ejercicio } from '../../tipos';
import { ANCLA_COLGADO, BARRA_ALTA, colgado, ENCUADRE_COLGADO, ESCENARIO_BARRA_ALTA, piernasColgado, poseColgado } from './_colgado';
import type { Absolutos } from './_pose';

const ARRIBA = colgado(104, 112, { x: -5, y: BARRA_ALTA.y - 5 }, 0.74);
const MEDIO = colgado(97, 100, { x: -3.2, y: BARRA_ALTA.y - 21 }, 0.84);
const ABAJO: Absolutos = { tronco: 92, cabeza: 108, ...piernasColgado(92), brazo: 86, antebrazo: 88 };

export const dominadaNegativa: Ejercicio = {
  id: 'dominada-negativa',
  nombre: 'iron-espalda:ejercicios.dominada-negativa.nombre',
  grupo: 'espalda',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['barra_fija'],
  musculos: {
    principales: ['dorsal'],
    secundarios: ['espalda_alta', 'biceps', 'antebrazo', 'deltoides_posterior', 'abdomen'],
  },
  sustitutos: ['remo-invertido', 'jalon-pecho', 'dominada-escapular'],
  vista: 'lateral',
  ancla: ANCLA_COLGADO,
  poses: [
    poseColgado(0, ARRIBA, 0.74),
    poseColgado(700, ARRIBA, 0.74),
    poseColgado(2900, MEDIO, 0.84),
    poseColgado(4700, ABAJO, 0.92),
    poseColgado(5300, ABAJO, 0.92),
    poseColgado(5800, MEDIO, 0.84),
  ],
  cicloMs: 6400,
  esfuerzo: [{ desde: 700, hasta: 4700 }],
  msFicha: 2900,
  escenario: ESCENARIO_BARRA_ALTA,
  encuadre: ENCUADRE_COLGADO,
  cues: [
    'iron-espalda:ejercicios.dominada-negativa.cues.arriba',
    'iron-espalda:ejercicios.dominada-negativa.cues.lento',
    'iron-espalda:ejercicios.dominada-negativa.cues.abajo',
  ],
  errores: [
    'iron-espalda:ejercicios.dominada-negativa.errores.caer',
    'iron-espalda:ejercicios.dominada-negativa.errores.hombros',
  ],
};

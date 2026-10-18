// NIVL · IRON · Dominada escapular (colgado, solo los hombros).
//
// Colgado con los brazos estirados, se bajan los hombros lejos de las orejas
// y el cuerpo sube unos centímetros sin doblar los codos. El motor no tiene
// escápula: el descenso del hombro se dibuja acortando el brazo (escorzo),
// que es lo que se ve: el cuerpo sube con los brazos rectos.

import type { Ejercicio } from '../../tipos';
import { ANCLA_COLGADO, ENCUADRE_COLGADO, ESCENARIO_BARRA_ALTA, piernasColgado, poseColgado } from './_colgado';
import type { Absolutos } from './_pose';

const SUELTO: Absolutos = { tronco: 91, cabeza: 104, ...piernasColgado(91), brazo: 87, antebrazo: 88 };
const ACTIVO: Absolutos = { tronco: 96, cabeza: 106, ...piernasColgado(96), brazo: 85, antebrazo: 87 };

export const dominadaEscapular: Ejercicio = {
  id: 'dominada-escapular',
  nombre: 'iron-espalda:ejercicios.dominada-escapular.nombre',
  grupo: 'espalda',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['barra_fija'],
  musculos: {
    principales: ['dorsal', 'espalda_alta'],
    secundarios: ['trapecio', 'antebrazo', 'abdomen'],
  },
  sustitutos: ['dominada-negativa', 'remo-invertido'],
  vista: 'lateral',
  ancla: ANCLA_COLGADO,
  poses: [
    poseColgado(0, SUELTO, 0.99, 0.97),
    poseColgado(500, SUELTO, 0.99, 0.97),
    poseColgado(1200, ACTIVO, 0.8, 0.97),
    poseColgado(1900, ACTIVO, 0.8, 0.97),
  ],
  cicloMs: 2900,
  esfuerzo: [{ desde: 500, hasta: 1200 }],
  msFicha: 1500,
  escenario: ESCENARIO_BARRA_ALTA,
  encuadre: ENCUADRE_COLGADO,
  cues: [
    'iron-espalda:ejercicios.dominada-escapular.cues.brazos',
    'iron-espalda:ejercicios.dominada-escapular.cues.hombros',
    'iron-espalda:ejercicios.dominada-escapular.cues.pausa',
  ],
  errores: [
    'iron-espalda:ejercicios.dominada-escapular.errores.codos',
    'iron-espalda:ejercicios.dominada-escapular.errores.balanceo',
  ],
};

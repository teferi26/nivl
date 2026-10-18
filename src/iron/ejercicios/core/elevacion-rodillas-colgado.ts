// NIVL · IRON · Elevación de rodillas colgado de la barra fija, vista lateral.
//
// Ronda 2 (barra fija del equipo espalda). Colgado con los brazos estirados
// (el ancla es el puño en la barra, como en las dominadas), se suben las
// rodillas dobladas por encima de la cadera enrollando un poco la pelvis y
// se bajan despacio, sin balanceo.
// Biomecánica (src/iron/__tests__/ronda2.test.ts): las manos no se mueven de
// la barra, los brazos siguen estirados, la cadera pasa de ≤ 10° a ≥ 85° de
// flexión, el tronco se inclina como mucho 12° y los pies no tocan el suelo.

import type { Ejercicio } from '../../tipos';
import { ANCLA_COLGADO, ESCENARIO_BARRA_ALTA, poseColgado } from '../espalda/_colgado';
import type { Absolutos } from '../espalda/_pose';

const BRAZOS = { brazo: 86, antebrazo: 88 } as const;
// Abajo las rodillas algo dobladas y los pies atrás: con la barra a 118 los pies no tocan el suelo.
const ABAJO: Absolutos = { tronco: 92, cabeza: 100, muslo: -82, pierna: -145, pie: -60, ...BRAZOS };
const MEDIO: Absolutos = { tronco: 95, cabeza: 100, muslo: -40, pierna: -120, pie: -35, ...BRAZOS };
const ARRIBA: Absolutos = { tronco: 100, cabeza: 102, muslo: 8, pierna: -80, pie: -20, ...BRAZOS };

export const elevacionRodillasColgado: Ejercicio = {
  id: 'elevacion-rodillas-colgado',
  nombre: 'iron-core:ejercicios.elevacion-rodillas-colgado.nombre',
  grupo: 'core',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['barra_fija'],
  musculos: {
    principales: ['abdomen'],
    secundarios: ['psoas', 'oblicuos', 'antebrazo', 'dorsal'],
  },
  sustitutos: ['elevaciones-piernas', 'crunch-inverso', 'rodillas-arriba'],
  vista: 'lateral',
  ancla: ANCLA_COLGADO,
  poses: [
    poseColgado(0, ABAJO, 0.92),
    poseColgado(400, ABAJO, 0.92),
    poseColgado(1000, MEDIO, 0.92),
    poseColgado(1500, ARRIBA, 0.92),
    poseColgado(1800, ARRIBA, 0.92),
    poseColgado(2900, MEDIO, 0.92),
  ],
  cicloMs: 3800,
  esfuerzo: [{ desde: 400, hasta: 1500 }],
  msFicha: 1650,
  escenario: ESCENARIO_BARRA_ALTA,
  encuadre: { x: -36, y: -4, ancho: 88, alto: 144 },
  cues: [
    'iron-core:ejercicios.elevacion-rodillas-colgado.cues.agarre',
    'iron-core:ejercicios.elevacion-rodillas-colgado.cues.pelvis',
    'iron-core:ejercicios.elevacion-rodillas-colgado.cues.balanceo',
  ],
  errores: [
    'iron-core:ejercicios.elevacion-rodillas-colgado.errores.balanceo',
    'iron-core:ejercicios.elevacion-rodillas-colgado.errores.caer',
  ],
};

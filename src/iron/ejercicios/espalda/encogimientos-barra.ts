// NIVL · IRON · Encogimientos con barra, de pie.
//
// Los hombros suben hacia las orejas y bajan, con los brazos rectos. El
// motor no tiene escápula: la subida del hombro se dibuja alargando el
// tronco un 7 % (escorzo de 0,93 a 1), que sube hombros, brazos y barra.
// Biomecánica (src/iron/__tests__/espalda.test.ts): codos rectos, piernas y
// cadera quietas y la barra sube en vertical.

import type { Ejercicio } from '../../tipos';
import { ANCLA_DE_PIE, pose, type Absolutos } from './_pose';

const DE_PIE: Absolutos = { tronco: 89, cabeza: 89, muslo: -89, pierna: -91, pie: 0, brazo: -83, antebrazo: -83 };
const ABAJO = pose(0, DE_PIE, { escorzo: { tronco: 0.93 } });
const ARRIBA = (ms: number) => pose(ms, DE_PIE, { escorzo: { tronco: 1 } });

export const encogimientosBarra: Ejercicio = {
  id: 'encogimientos-barra',
  nombre: 'iron-espalda:ejercicios.encogimientos-barra.nombre',
  grupo: 'espalda',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['barra'],
  musculos: {
    principales: ['trapecio'],
    secundarios: ['espalda_alta', 'antebrazo'],
  },
  sustitutos: ['encogimientos-mancuerna', 'peso-muerto'],
  vista: 'lateral',
  ancla: ANCLA_DE_PIE,
  poses: [ABAJO, { ...ABAJO, ms: 400 }, ARRIBA(1000), ARRIBA(1600)],
  cicloMs: 2700,
  esfuerzo: [{ desde: 400, hasta: 1000 }],
  msFicha: 1300,
  carga: { tipo: 'barra', en: 'agarre', disco: 10, eje: { x: 15, y: 0 } },
  encuadre: { x: -30, y: -4, ancho: 72, alto: 112 },
  cues: [
    'iron-espalda:ejercicios.encogimientos-barra.cues.vertical',
    'iron-espalda:ejercicios.encogimientos-barra.cues.brazos',
    'iron-espalda:ejercicios.encogimientos-barra.cues.pausa',
  ],
  errores: [
    'iron-espalda:ejercicios.encogimientos-barra.errores.rodar',
    'iron-espalda:ejercicios.encogimientos-barra.errores.codos',
  ],
};

// NIVL · IRON · Hombro · Encogimientos de trapecio con mancuernas, de pie.
//
// Vista FRONTAL POR DETRÁS (`cara: 'post'`): el trapecio superior se ve
// entero en la espalda alta y el cuello.
// El motor no tiene articulación en la cintura escapular: la elevación de
// los hombros se dibuja alargando el tronco (escorzo 0,92 → 1) y acortando a
// la vez el cuello (cabeza 1 → 0,8), de modo que la cabeza no se mueve y
// hombros, brazos y mancuernas suben unos 2,4 (≈ 4 cm).
// Biomecánica (src/iron/__tests__/hombro.test.ts):
// · Los hombros suben en vertical hacia las orejas; la cabeza queda quieta.
// · Brazos estirados y colgando (codo ≤ 5°): no hay remo ni giro.
// · Pausa arriba y bajada controlada.

import type { Ejercicio, Pose } from '../../tipos';
import { ANCLA_PIE_FRONTAL, conBrazos, PIERNAS_PIE_FRONTAL } from './comun';

export function poseEncogimiento(ms: number, arriba: boolean, hombro: number): Pose {
  return {
    ms,
    cuello: 0,
    cerca: conBrazos(PIERNAS_PIE_FRONTAL, hombro, 2),
    escorzo: arriba ? { tronco: 1, cabeza: 0.8 } : { tronco: 0.92, cabeza: 1 },
  };
}

export const encogimientosMancuerna: Ejercicio = {
  id: 'encogimientos-mancuerna',
  nombre: 'iron-hombro:ejercicios.encogimientos-mancuerna.nombre',
  grupo: 'espalda',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['mancuerna'],
  musculos: {
    principales: ['trapecio'],
    secundarios: ['espalda_alta', 'antebrazo'],
  },
  sustitutos: ['encogimientos-barra'],
  vista: 'frontal',
  cara: 'post',
  ancla: ANCLA_PIE_FRONTAL,
  poses: [
    poseEncogimiento(0, false, 6),
    poseEncogimiento(300, false, 6),
    poseEncogimiento(900, true, 6),
    poseEncogimiento(1600, true, 6),
  ],
  cicloMs: 2900,
  esfuerzo: [{ desde: 300, hasta: 900 }],
  msFicha: 1200,
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'lado', lados: ['cerca', 'lejos'] },
  encuadre: { x: -46, y: -4, ancho: 92, alto: 108 },
  cues: [
    'iron-hombro:ejercicios.encogimientos-mancuerna.cues.vertical',
    'iron-hombro:ejercicios.encogimientos-mancuerna.cues.pausa',
    'iron-hombro:ejercicios.encogimientos-mancuerna.cues.brazos',
  ],
  errores: [
    'iron-hombro:ejercicios.encogimientos-mancuerna.errores.circulos',
    'iron-hombro:ejercicios.encogimientos-mancuerna.errores.cabeza',
  ],
};

// NIVL · IRON · Hombro · Rotación externa con banda, codo pegado al costado.
//
// Vista FRONTAL POR DETRÁS (`cara: 'post'`): así se ve el manguito rotador
// (infraespinoso y redondo menor, sobre la escápula). Un brazo (el de la
// izquierda de la pantalla); la banda anclada al otro lado, a la altura del
// codo, pasa por delante del cuerpo (se tapa donde la tapa el tronco).
// El antebrazo gira en horizontal: de perfil sería un punto, así que el
// escorzo dice cuánto se ve (seno del giro) y el codo da el sentido:
// -90 = hacia dentro, +90 = hacia fuera.
// Biomecánica (src/iron/__tests__/hombro.test.ts):
// · El codo no se separa del costado (hombro ≤ 10°) ni se mueve.
// · El antebrazo se queda horizontal, a la altura del codo, todo el giro.
// · Recorrido de unos 30° hacia dentro a unos 65° hacia fuera.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';
import { ANCLA_PIE_FRONTAL, PIERNAS_PIE_FRONTAL } from './comun';

const LIBRE: Extremidades = { ...PIERNAS_PIE_FRONTAL, hombro: 6, codo: 8 };

/** Un paso del giro: `codo` ±90 (sentido) y `ve` (seno del ángulo de giro). */
export function poseRotacion(ms: number, codo: number, ve: number): Pose {
  return {
    ms,
    cuello: 0,
    cerca: { ...PIERNAS_PIE_FRONTAL, hombro: 8, codo },
    lejos: LIBRE,
    escorzo: { antebrazo_c: ve },
  };
}

export const DENTRO = [-90, 0.5] as const;
export const CASI_DENTRO = [-90, 0.2] as const;
export const CASI_FUERA = [90, 0.2] as const;
export const MEDIO_FUERA = [90, 0.6] as const;
export const FUERA = [90, 0.91] as const;

export const rotacionExternaBanda: Ejercicio = {
  id: 'rotacion-externa-banda',
  nombre: 'iron-hombro:ejercicios.rotacion-externa-banda.nombre',
  grupo: 'hombro',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['banda'],
  musculos: {
    principales: ['manguito_rotador'],
    secundarios: ['deltoides_posterior', 'espalda_alta'],
  },
  sustitutos: ['rotacion-externa-90-banda', 'face-pull-banda'],
  vista: 'frontal',
  cara: 'post',
  ancla: ANCLA_PIE_FRONTAL,
  poses: [
    poseRotacion(0, ...DENTRO),
    poseRotacion(300, ...DENTRO),
    poseRotacion(550, ...CASI_DENTRO),
    poseRotacion(750, ...CASI_FUERA),
    poseRotacion(1000, ...MEDIO_FUERA),
    poseRotacion(1300, ...FUERA),
    poseRotacion(1600, ...FUERA),
    poseRotacion(2000, ...MEDIO_FUERA),
    poseRotacion(2300, ...CASI_FUERA),
    poseRotacion(2550, ...CASI_DENTRO),
  ],
  cicloMs: 3100,
  esfuerzo: [{ desde: 300, hasta: 1300 }],
  msFicha: 1450,
  carga: { tipo: 'banda', en: 'agarre', lados: ['cerca'], anclaje: { x: 42, y: 64.4 }, oculta: [-60, 18] },
  encuadre: { x: -48, y: -4, ancho: 96, alto: 108 },
  cues: [
    'iron-hombro:ejercicios.rotacion-externa-banda.cues.codo',
    'iron-hombro:ejercicios.rotacion-externa-banda.cues.lento',
    'iron-hombro:ejercicios.rotacion-externa-banda.cues.ligera',
  ],
  errores: [
    'iron-hombro:ejercicios.rotacion-externa-banda.errores.codo',
    'iron-hombro:ejercicios.rotacion-externa-banda.errores.tronco',
  ],
};

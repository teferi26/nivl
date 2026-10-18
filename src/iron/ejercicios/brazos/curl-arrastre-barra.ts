// NIVL · IRON · Curl de arrastre con barra, de pie, vista lateral.
//
// La barra sube pegada al cuerpo: los codos van hacia atrás mientras se
// flexionan (extensión de hombro), así el bíceps trabaja con el hombro atrás.
// Biomecánica (comprobada en src/iron/__tests__/brazos.test.ts): la barra no
// se separa del torso en todo el recorrido y el codo acaba por detrás del
// tronco.

import type { Ejercicio, Extremidades } from '../../tipos';
import { ANCLA_DE_PIE, DE_PIE, pose, textos } from './comun';

const ABAJO: Extremidades = { ...DE_PIE, hombro: 9, codo: 4 };
const MEDIO: Extremidades = { ...DE_PIE, hombro: -14, codo: 62 };
const ARRIBA: Extremidades = { ...DE_PIE, hombro: -34, codo: 112 };
const T = textos('curl-arrastre-barra', ['pegada', 'codos', 'bajada'], ['separar', 'hombros']);

export const curlArrastreBarra: Ejercicio = {
  id: 'curl-arrastre-barra',
  nombre: T.nombre,
  grupo: 'brazo',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['barra'],
  musculos: { principales: ['biceps'], secundarios: ['braquial', 'antebrazo', 'deltoides_posterior'] },
  sustitutos: ['curl-barra', 'curl-barra-z'],
  vista: 'lateral',
  ancla: ANCLA_DE_PIE,
  poses: [pose(0, ABAJO), pose(400, ABAJO), pose(1000, MEDIO), pose(1600, ARRIBA), pose(1900, ARRIBA), pose(2900, MEDIO)],
  cicloMs: 3900,
  esfuerzo: [{ desde: 400, hasta: 1600 }],
  msFicha: 1000,
  carga: { tipo: 'barra', en: 'agarre', disco: 7, eje: { x: 9, y: -5 } },
  encuadre: { x: -42, y: -4, ancho: 84, alto: 112 },
  cues: T.cues,
  errores: T.errores,
};

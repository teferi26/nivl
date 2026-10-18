// NIVL · IRON · Curl de bíceps con barra Z, de pie, vista lateral.
//
// Igual que el curl con barra, pero las ondas de la barra Z dejan la muñeca
// en semisupinación: más cómodo para muñecas y codos, algo más de braquial.
// Biomecánica (comprobada en src/iron/__tests__/brazos.test.ts): codos junto
// al costado (hombro ≤ 20°), recorrido completo y tronco quieto.

import type { Ejercicio, Extremidades } from '../../tipos';
import { ANCLA_DE_PIE, DE_PIE, pose, textos } from './comun';

const ABAJO: Extremidades = { ...DE_PIE, hombro: 9, codo: 5 };
const ARRIBA: Extremidades = { ...DE_PIE, hombro: 16, codo: 134 };
const T = textos('curl-barra-z', ['agarre', 'codos', 'bajada'], ['balanceo', 'medioRecorrido']);

export const curlBarraZ: Ejercicio = {
  id: 'curl-barra-z',
  nombre: T.nombre,
  grupo: 'brazo',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['barra_z'],
  musculos: { principales: ['biceps'], secundarios: ['braquial', 'braquiorradial', 'antebrazo'] },
  sustitutos: ['curl-barra', 'curl-biceps-mancuerna', 'curl-sentado-mancuerna'],
  vista: 'lateral',
  ancla: ANCLA_DE_PIE,
  poses: [pose(0, ABAJO), pose(400, ABAJO), pose(1600, ARRIBA), pose(1900, ARRIBA)],
  cicloMs: 3900,
  esfuerzo: [{ desde: 400, hasta: 1600 }],
  msFicha: 1100,
  carga: { tipo: 'barra', en: 'agarre', forma: 'z', disco: 7, eje: { x: 9, y: -5 } },
  encuadre: { x: -42, y: -4, ancho: 84, alto: 112 },
  cues: T.cues,
  errores: T.errores,
};

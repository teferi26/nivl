// NIVL · IRON · Curl martillo con mancuernas, de pie, vista lateral.
//
// Agarre neutro (palmas mirándose): la mancuerna se ve a lo largo. Trabaja
// sobre todo el braquiorradial y el braquial; el bíceps ayuda.
// Biomecánica (comprobada en src/iron/__tests__/brazos.test.ts): codos junto
// al costado (hombro ≤ 15°), recorrido completo, tronco quieto.

import type { Ejercicio, Extremidades } from '../../tipos';
import { ANCLA_DE_PIE, DE_PIE, pose, textos } from './comun';

const ABAJO: Extremidades = { ...DE_PIE, hombro: 0, codo: 6 };
const ARRIBA: Extremidades = { ...DE_PIE, hombro: 12, codo: 132 };
const T = textos('curl-martillo', ['agarre', 'codos', 'bajada'], ['balanceo', 'giro']);

export const curlMartillo: Ejercicio = {
  id: 'curl-martillo',
  nombre: T.nombre,
  grupo: 'brazo',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['mancuerna'],
  musculos: { principales: ['braquiorradial', 'braquial'], secundarios: ['biceps', 'antebrazo'] },
  sustitutos: ['curl-inverso-barra-z', 'curl-biceps-mancuerna'],
  vista: 'lateral',
  ancla: ANCLA_DE_PIE,
  poses: [pose(0, ABAJO), pose(400, ABAJO), pose(1600, ARRIBA), pose(1900, ARRIBA)],
  cicloMs: 3900,
  esfuerzo: [{ desde: 400, hasta: 1600 }],
  msFicha: 1050,
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'lado', lados: ['cerca', 'lejos'] },
  encuadre: { x: -42, y: -4, ancho: 84, alto: 112 },
  cues: T.cues,
  errores: T.errores,
};

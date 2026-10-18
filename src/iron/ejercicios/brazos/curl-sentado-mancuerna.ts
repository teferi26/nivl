// NIVL · IRON · Curl de bíceps con mancuernas, sentado en el banco, vista lateral.
//
// Sentado, el tronco no puede ayudar con las piernas ni con un balanceo: es
// el curl más estricto con mancuernas. Espalda recta, pies planos.
// Biomecánica (comprobada en src/iron/__tests__/brazos.test.ts): tronco
// vertical y quieto, codos junto al costado (hombro ≤ 15°), recorrido completo.

import type { Ejercicio, Extremidades } from '../../tipos';
import { anclaSentado, BANCO_SENTADO, pose, sentado, textos } from './comun';

const ABAJO: Extremidades = { ...sentado(90), hombro: 2, codo: 10 };
const ARRIBA: Extremidades = { ...sentado(90), hombro: 12, codo: 138 };
const T = textos('curl-sentado-mancuerna', ['espalda', 'codos', 'bajada'], ['inclinarse', 'medioRecorrido']);

export const curlSentadoMancuerna: Ejercicio = {
  id: 'curl-sentado-mancuerna',
  nombre: T.nombre,
  grupo: 'brazo',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['mancuerna', 'banco'],
  musculos: { principales: ['biceps'], secundarios: ['braquial', 'antebrazo'] },
  sustitutos: ['curl-biceps-mancuerna', 'curl-concentrado', 'curl-barra'],
  vista: 'lateral',
  ancla: anclaSentado(90),
  poses: [pose(0, ABAJO), pose(400, ABAJO), pose(1600, ARRIBA), pose(1900, ARRIBA)],
  cicloMs: 3900,
  esfuerzo: [{ desde: 400, hasta: 1600 }],
  msFicha: 1100,
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'punta', lados: ['cerca', 'lejos'] },
  escenario: [BANCO_SENTADO],
  encuadre: { x: -40, y: -4, ancho: 84, alto: 80 },
  cues: T.cues,
  errores: T.errores,
};

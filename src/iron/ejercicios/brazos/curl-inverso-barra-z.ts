// NIVL · IRON · Curl inverso con barra Z, de pie, vista lateral.
//
// Agarre en pronación (palmas hacia abajo): el bíceps queda en desventaja y
// el trabajo pasa al braquiorradial y al braquial. Algo menos de recorrido
// arriba que el curl normal y menos peso.
// Biomecánica (comprobada en src/iron/__tests__/brazos.test.ts): codos junto
// al costado (hombro ≤ 15°), tronco quieto.

import type { Ejercicio, Extremidades } from '../../tipos';
import { ANCLA_DE_PIE, DE_PIE, pose, textos } from './comun';

const ABAJO: Extremidades = { ...DE_PIE, hombro: 9, codo: 5 };
const ARRIBA: Extremidades = { ...DE_PIE, hombro: 14, codo: 124 };
const T = textos('curl-inverso-barra-z', ['agarre', 'munecas', 'codos'], ['balanceo', 'munecasCaidas']);

export const curlInversoBarraZ: Ejercicio = {
  id: 'curl-inverso-barra-z',
  nombre: T.nombre,
  grupo: 'brazo',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['barra_z'],
  musculos: { principales: ['braquiorradial', 'braquial'], secundarios: ['biceps', 'antebrazo'] },
  sustitutos: ['curl-martillo', 'curl-barra-z'],
  vista: 'lateral',
  ancla: ANCLA_DE_PIE,
  poses: [pose(0, ABAJO), pose(400, ABAJO), pose(1600, ARRIBA), pose(1900, ARRIBA)],
  cicloMs: 4000,
  esfuerzo: [{ desde: 400, hasta: 1600 }],
  msFicha: 1050,
  carga: { tipo: 'barra', en: 'agarre', forma: 'z', disco: 6, eje: { x: 9, y: -5 } },
  encuadre: { x: -42, y: -4, ancho: 84, alto: 112 },
  cues: T.cues,
  errores: T.errores,
};

// NIVL · IRON · Curl de bíceps con barra, de pie, vista lateral.
//
// Biomecánica (comprobada en src/iron/__tests__/brazos.test.ts):
// · Agarre en supinación al ancho de los hombros; la barra sale de delante
//   de los muslos (el brazo apenas adelantado) y sube en arco hasta los hombros.
// · Codos junto al costado: el hombro solo se adelanta un poco arriba (≤ 20°).
// · Tronco y piernas quietos; bajada más lenta que la subida.
// Cámara en 3/4: el disco cercano queda delante y por debajo de la barra.

import type { Ejercicio, Extremidades } from '../../tipos';
import { ANCLA_DE_PIE, DE_PIE, pose, textos } from './comun';

const ABAJO: Extremidades = { ...DE_PIE, hombro: 9, codo: 4 };
const ARRIBA: Extremidades = { ...DE_PIE, hombro: 17, codo: 136 };
const T = textos('curl-barra', ['agarre', 'codos', 'bajada'], ['balanceo', 'codosDelante', 'munecas']);

export const curlBarra: Ejercicio = {
  id: 'curl-barra',
  nombre: T.nombre,
  grupo: 'brazo',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['barra'],
  musculos: { principales: ['biceps'], secundarios: ['braquial', 'braquiorradial', 'antebrazo', 'deltoides_anterior'] },
  sustitutos: ['curl-barra-z', 'curl-biceps-mancuerna', 'curl-sentado-mancuerna'],
  vista: 'lateral',
  ancla: ANCLA_DE_PIE,
  poses: [pose(0, ABAJO), pose(400, ABAJO), pose(1600, ARRIBA), pose(1900, ARRIBA)],
  cicloMs: 3900,
  esfuerzo: [{ desde: 400, hasta: 1600 }],
  msFicha: 1100,
  carga: { tipo: 'barra', en: 'agarre', disco: 7, eje: { x: 9, y: -5 } },
  encuadre: { x: -42, y: -4, ancho: 84, alto: 112 },
  cues: T.cues,
  errores: T.errores,
};

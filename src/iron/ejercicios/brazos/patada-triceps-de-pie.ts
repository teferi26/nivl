// NIVL · IRON · Patada de tríceps de pie, con las dos manos, vista lateral.
//
// Sin banco (vale en casa con dos garrafas): rodillas sueltas, cadera atrás y
// tronco inclinado unos 50° con la espalda recta. Los brazos pegados al
// costado con el codo algo por encima de la espalda; solo se mueven los
// antebrazos, de colgar a quedar en línea con el brazo.
// Biomecánica (comprobada en src/iron/__tests__/brazos.test.ts): pies planos,
// tronco quieto, el brazo no se mueve (±3°).

import type { Ejercicio, Extremidades } from '../../tipos';
import { ANCLA_DE_PIE, pose, textos } from './comun';

// Pie plano, pierna a -105° y muslo a -80°: el tronco queda a 40° del suelo.
const PIERNAS = { tobillo: 15, rodilla: 25, cadera: 60 } as const;
// hombro -20: el brazo a 200° (tronco a 40°), un poco por encima de la espalda.
const ABAJO: Extremidades = { ...PIERNAS, hombro: -20, codo: 70 };
const MEDIO: Extremidades = { ...PIERNAS, hombro: -20, codo: 35 };
const ARRIBA: Extremidades = { ...PIERNAS, hombro: -20, codo: 2 };
const T = textos('patada-triceps-de-pie', ['postura', 'codo', 'arriba'], ['espalda', 'balanceo']);

export const patadaTricepsDePie: Ejercicio = {
  id: 'patada-triceps-de-pie',
  nombre: T.nombre,
  grupo: 'brazo',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['mancuerna'],
  musculos: { principales: ['triceps'], secundarios: ['deltoides_posterior', 'lumbares', 'isquiotibiales'] },
  sustitutos: ['patada-triceps', 'extension-triceps-cabeza-mancuerna', 'flexiones-diamante'],
  vista: 'lateral',
  ancla: ANCLA_DE_PIE,
  poses: [pose(0, ABAJO), pose(400, ABAJO), pose(900, MEDIO), pose(1400, ARRIBA), pose(1800, ARRIBA), pose(2600, MEDIO)],
  cicloMs: 3400,
  esfuerzo: [{ desde: 400, hasta: 1400 }],
  msFicha: 1600,
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'lado', lados: ['cerca', 'lejos'] },
  encuadre: { x: -52, y: -4, ancho: 96, alto: 94 },
  cues: T.cues,
  errores: T.errores,
};

// NIVL · IRON · Press francés con mancuernas, tumbado en el banco.
//
// Como el press francés con barra Z, con una mancuerna en cada mano y agarre
// neutro (palmas mirándose): las mancuernas bajan a los lados de la cabeza.
// Biomecánica (comprobada en src/iron/__tests__/brazos.test.ts): el brazo no
// se mueve y solo se doblan los codos.

import type { Ejercicio, Extremidades } from '../../tipos';
import { ANCLA_TUMBADO, BANCO_TUMBADO, pose, TUMBADO, textos } from './comun';

// Como con la barra Z, pero abajo algo menos de codo: las mancuernas, a lo
// largo, quedan por encima de la cabeza sin tocarla.
const ARRIBA: Extremidades = { ...TUMBADO, hombro: 96.5, codo: 6 };
const MEDIO: Extremidades = { ...TUMBADO, hombro: 96.5, codo: 55 };
const ABAJO: Extremidades = { ...TUMBADO, hombro: 96.5, codo: 98 };

const T = textos('press-frances-mancuerna', ['brazos', 'codos', 'bajada'], ['codosAbiertos', 'brazosMovidos']);

export const pressFrancesMancuerna: Ejercicio = {
  id: 'press-frances-mancuerna',
  nombre: T.nombre,
  grupo: 'brazo',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['mancuerna', 'banco'],
  musculos: { principales: ['triceps'], secundarios: ['antebrazo'] },
  sustitutos: ['press-frances-barra-z', 'press-frances-suelo-mancuerna', 'extension-triceps-cabeza-mancuerna'],
  vista: 'lateral',
  ancla: ANCLA_TUMBADO,
  poses: [pose(0, ARRIBA), pose(400, ARRIBA), pose(1300, MEDIO), pose(2200, ABAJO), pose(2450, ABAJO), pose(3100, MEDIO)],
  cicloMs: 3800,
  esfuerzo: [{ desde: 2450, hasta: 3800 }],
  msFicha: 3100,
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'lado', lados: ['cerca'] },
  escenario: [BANCO_TUMBADO],
  encuadre: { x: -70, y: -4, ancho: 108, alto: 90 },
  cues: T.cues,
  errores: T.errores,
};

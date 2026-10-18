// NIVL · IRON · Extensión de muñeca con mancuernas (curl de muñeca inverso), sentado.
//
// La misma postura que el curl de muñeca, pero con las palmas hacia abajo:
// trabajan los extensores, la cara de atrás del antebrazo. Poco peso.
// Biomecánica (comprobada en src/iron/__tests__/brazos.test.ts): antebrazo
// horizontal y quieto sobre el muslo, solo se mueve la muñeca.

import type { Ejercicio, Extremidades } from '../../tipos';
import { anclaSentado, BANCO_SENTADO, pose, sentado, textos } from './comun';

const TRONCO = 55.4;
const BRAZOS: Extremidades = { ...sentado(TRONCO), hombro: 15.5, codo: 109.1 };
const T = textos('extension-muneca-mancuerna', ['apoyo', 'peso', 'control'], ['antebrazo', 'dedos']);

export const extensionMunecaMancuerna: Ejercicio = {
  id: 'extension-muneca-mancuerna',
  nombre: T.nombre,
  grupo: 'brazo',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['mancuerna', 'banco'],
  musculos: { principales: ['antebrazo'], secundarios: ['braquiorradial'] },
  sustitutos: ['curl-muneca-barra', 'curl-inverso-barra-z'],
  vista: 'lateral',
  ancla: anclaSentado(TRONCO),
  // Palmas abajo: la mano sube al extender (el mismo giro que en el curl).
  poses: [
    pose(0, BRAZOS, { muneca: -50 }),
    pose(300, BRAZOS, { muneca: -50 }),
    pose(1100, BRAZOS, { muneca: 55 }),
    pose(1400, BRAZOS, { muneca: 55 }),
  ],
  cicloMs: 2700,
  esfuerzo: [{ desde: 300, hasta: 1100 }],
  msFicha: 1250,
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'punta', lados: ['cerca', 'lejos'] },
  escenario: [BANCO_SENTADO],
  encuadre: { x: -36, y: -4, ancho: 84, alto: 80 },
  cues: T.cues,
  errores: T.errores,
};

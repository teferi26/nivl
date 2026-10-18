// NIVL · IRON · Extensión de tríceps sobre la cabeza con una mancuerna, de pie.
//
// Una mancuerna sujeta con las dos manos por el disco de arriba. Brazos junto
// a la cabeza, codos hacia el techo y quietos; la mancuerna baja por detrás
// de la cabeza doblando los codos y sube estirándolos. Con el brazo arriba
// la porción larga del tríceps trabaja estirada.
// Biomecánica (comprobada en src/iron/__tests__/brazos.test.ts): el brazo
// queda casi vertical (hombro de 160 a 180°) y quieto (±3°); abajo la
// mancuerna queda detrás de la cabeza; tronco recto.
// En la vista lateral el brazo cercano pasa por la parte de atrás de la
// cabeza: la barbilla un poco hacia delante deja la cara a la vista.

import type { Ejercicio, Extremidades } from '../../tipos';
import { ANCLA_DE_PIE, DE_PIE, pose, textos } from './comun';

const ARRIBA: Extremidades = { ...DE_PIE, hombro: 180, codo: 6 };
const MEDIO: Extremidades = { ...DE_PIE, hombro: 180, codo: 70 };
const ABAJO: Extremidades = { ...DE_PIE, hombro: 180, codo: 135 };
const T = textos('extension-triceps-cabeza-mancuerna', ['codos', 'tronco', 'bajada'], ['codosAbiertos', 'arquear']);

export const extensionTricepsCabezaMancuerna: Ejercicio = {
  id: 'extension-triceps-cabeza-mancuerna',
  nombre: T.nombre,
  grupo: 'brazo',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['mancuerna'],
  musculos: { principales: ['triceps'], secundarios: ['abdomen'] },
  sustitutos: ['extension-triceps-cabeza-barra-z', 'press-frances-mancuerna', 'patada-triceps'],
  vista: 'lateral',
  ancla: ANCLA_DE_PIE,
  poses: [
    pose(0, ARRIBA, { cuello: 26 }),
    pose(400, ARRIBA, { cuello: 26 }),
    pose(1300, MEDIO, { cuello: 26 }),
    pose(2200, ABAJO, { cuello: 26 }),
    pose(2450, ABAJO, { cuello: 26 }),
    pose(3100, MEDIO, { cuello: 26 }),
  ],
  cicloMs: 3800,
  esfuerzo: [{ desde: 2450, hasta: 3800 }],
  msFicha: 3100,
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'punta', lados: ['cerca'] },
  encuadre: { x: -46, y: -4, ancho: 92, alto: 140 },
  cues: T.cues,
  errores: T.errores,
};

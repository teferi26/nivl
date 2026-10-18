// NIVL · IRON · Extensión de tríceps sobre la cabeza con barra Z, de pie.
//
// La barra Z con agarre cerrado en las ondas; codos hacia el techo y quietos.
// La barra baja por detrás de la cabeza y sube estirando los codos.
// Biomecánica (comprobada en src/iron/__tests__/brazos.test.ts): el brazo
// queda casi vertical y quieto, abajo la barra detrás de la cabeza, el disco
// (cámara en 3/4, hacia atrás) no tapa la cabeza.

import type { Ejercicio, Extremidades } from '../../tipos';
import { ANCLA_DE_PIE, DE_PIE, pose, textos } from './comun';

const ARRIBA: Extremidades = { ...DE_PIE, hombro: 180, codo: 6 };
const MEDIO: Extremidades = { ...DE_PIE, hombro: 180, codo: 70 };
const ABAJO: Extremidades = { ...DE_PIE, hombro: 180, codo: 130 };
const T = textos('extension-triceps-cabeza-barra-z', ['agarre', 'codos', 'tronco'], ['codosAbiertos', 'arquear']);

export const extensionTricepsCabezaBarraZ: Ejercicio = {
  id: 'extension-triceps-cabeza-barra-z',
  nombre: T.nombre,
  grupo: 'brazo',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['barra_z'],
  musculos: { principales: ['triceps'], secundarios: ['abdomen'] },
  sustitutos: ['extension-triceps-cabeza-mancuerna', 'press-frances-barra-z'],
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
  carga: { tipo: 'barra', en: 'agarre', forma: 'z', disco: 6, eje: { x: -11, y: 5 } },
  encuadre: { x: -46, y: -4, ancho: 92, alto: 140 },
  cues: T.cues,
  errores: T.errores,
};

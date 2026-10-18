// NIVL · IRON · Press francés con barra Z, tumbado en el banco (cabeza a la izquierda).
//
// Brazos casi verticales, un poco inclinados hacia la cabeza, y QUIETOS: solo
// se doblan los codos y la barra baja en arco hasta pasar por encima de la
// frente; luego se extienden los codos sin bloquear de golpe.
// Biomecánica (comprobada en src/iron/__tests__/brazos.test.ts):
// · El brazo no se mueve (±3°) y queda inclinado hacia la cabeza (95 a 110°).
// · Abajo la barra pasa por encima de la cabeza, sin tocarla.
// · Glúteos, espalda y cabeza en el banco; pies planos.

import type { Ejercicio, Extremidades } from '../../tipos';
import { ANCLA_TUMBADO, BANCO_TUMBADO, pose, TUMBADO, textos } from './comun';

// hombro 96,5 = brazo a 100° en el mundo (tronco a 183,5°).
const ARRIBA: Extremidades = { ...TUMBADO, hombro: 96.5, codo: 6 };
const MEDIO: Extremidades = { ...TUMBADO, hombro: 96.5, codo: 58 };
const ABAJO: Extremidades = { ...TUMBADO, hombro: 96.5, codo: 112 };
const T = textos('press-frances-barra-z', ['brazos', 'codos', 'bajada'], ['codosAbiertos', 'brazosMovidos']);

export const pressFrancesBarraZ: Ejercicio = {
  id: 'press-frances-barra-z',
  nombre: T.nombre,
  grupo: 'brazo',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['barra_z', 'banco'],
  musculos: { principales: ['triceps'], secundarios: ['antebrazo'] },
  sustitutos: ['press-frances-mancuerna', 'extension-triceps-cabeza-barra-z', 'press-cerrado-barra'],
  vista: 'lateral',
  ancla: ANCLA_TUMBADO,
  poses: [pose(0, ARRIBA), pose(400, ARRIBA), pose(1300, MEDIO), pose(2200, ABAJO), pose(2450, ABAJO), pose(3100, MEDIO)],
  cicloMs: 3800,
  esfuerzo: [{ desde: 2450, hasta: 3800 }],
  msFicha: 3100,
  carga: { tipo: 'barra', en: 'agarre', forma: 'z', disco: 7, eje: { x: 5, y: 9 } },
  escenario: [BANCO_TUMBADO],
  encuadre: { x: -70, y: -4, ancho: 108, alto: 90 },
  cues: T.cues,
  errores: T.errores,
};

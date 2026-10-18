// NIVL · IRON · Curl de muñeca por detrás de la espalda con barra, de pie.
//
// La barra detrás de los glúteos, agarre al ancho de los hombros con las
// palmas hacia atrás y los brazos estirados. Solo se mueven las muñecas: la
// barra sube hacia atrás al flexionarlas. Sin apoyo y con mucha carga posible.
// Biomecánica (comprobada en src/iron/__tests__/brazos.test.ts): brazos
// estirados y quietos detrás del cuerpo; la barra no toca los glúteos.

import type { Ejercicio, Extremidades } from '../../tipos';
import { ANCLA_DE_PIE, DE_PIE, pose, textos } from './comun';

const BRAZOS: Extremidades = { ...DE_PIE, hombro: -20, codo: 2 };
const T = textos('curl-muneca-espalda-barra', ['agarre', 'brazos', 'control'], ['codos', 'rebote']);

export const curlMunecaEspaldaBarra: Ejercicio = {
  id: 'curl-muneca-espalda-barra',
  nombre: T.nombre,
  grupo: 'brazo',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['barra'],
  musculos: { principales: ['antebrazo'], secundarios: ['trapecio'] },
  sustitutos: ['curl-muneca-barra', 'paseo-granjero'],
  vista: 'lateral',
  ancla: ANCLA_DE_PIE,
  // Palmas hacia atrás: la flexión de muñeca lleva la mano hacia atrás (negativo).
  poses: [
    pose(0, BRAZOS, { muneca: 10 }),
    pose(300, BRAZOS, { muneca: 10 }),
    pose(1100, BRAZOS, { muneca: -55 }),
    pose(1400, BRAZOS, { muneca: -55 }),
  ],
  cicloMs: 2700,
  esfuerzo: [{ desde: 300, hasta: 1100 }],
  msFicha: 1250,
  carga: { tipo: 'barra', en: 'agarre', disco: 7, eje: { x: -12, y: -3 } },
  encuadre: { x: -48, y: -4, ancho: 90, alto: 112 },
  cues: T.cues,
  errores: T.errores,
};

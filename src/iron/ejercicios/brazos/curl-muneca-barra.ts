// NIVL · IRON · Curl de muñeca con barra, sentado, vista lateral.
//
// Sentado, tronco inclinado y los antebrazos apoyados a lo largo de los
// muslos con las palmas hacia arriba; las muñecas sobresalen de las rodillas.
// Solo se mueve la muñeca: baja la barra en extensión y la sube en flexión.
// Los ángulos del brazo están despejados para que el codo quede sobre el
// muslo y el antebrazo horizontal (ver docs/iron/F2-brazos.md).
// Biomecánica (comprobada en src/iron/__tests__/brazos.test.ts): antebrazo
// horizontal y quieto, muñeca por delante de la rodilla, recorrido de muñeca.

import type { Ejercicio, Extremidades } from '../../tipos';
import { anclaSentado, BANCO_SENTADO, pose, sentado, textos } from './comun';

const TRONCO = 55.4;
const BRAZOS: Extremidades = { ...sentado(TRONCO), hombro: 15.5, codo: 109.1 };
const T = textos('curl-muneca-barra', ['apoyo', 'recorrido', 'control'], ['antebrazo', 'rebote']);

export const curlMunecaBarra: Ejercicio = {
  id: 'curl-muneca-barra',
  nombre: T.nombre,
  grupo: 'brazo',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['barra', 'banco'],
  musculos: { principales: ['antebrazo'], secundarios: [] },
  sustitutos: ['extension-muneca-mancuerna', 'curl-muneca-espalda-barra'],
  vista: 'lateral',
  ancla: anclaSentado(TRONCO),
  poses: [
    pose(0, BRAZOS, { muneca: -60 }),
    pose(300, BRAZOS, { muneca: -60 }),
    pose(1100, BRAZOS, { muneca: 65 }),
    pose(1400, BRAZOS, { muneca: 65 }),
  ],
  cicloMs: 2600,
  esfuerzo: [{ desde: 300, hasta: 1100 }],
  msFicha: 1250,
  carga: { tipo: 'barra', en: 'agarre', disco: 6, eje: { x: 9, y: -5 } },
  escenario: [BANCO_SENTADO],
  encuadre: { x: -36, y: -4, ancho: 84, alto: 76 },
  cues: T.cues,
  errores: T.errores,
};

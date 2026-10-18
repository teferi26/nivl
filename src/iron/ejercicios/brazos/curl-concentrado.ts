// NIVL · IRON · Curl concentrado con mancuerna, sentado, vista lateral.
//
// Sentado en el extremo del banco, tronco inclinado hacia delante y el codo
// del brazo que trabaja apoyado en la cara interna del muslo: el brazo cuelga
// vertical y no se mueve; solo se dobla el codo. La otra mano, en la rodilla.
// Biomecánica (comprobada en src/iron/__tests__/brazos.test.ts): el brazo
// queda vertical (±8°) y el codo quieto sobre el muslo en todo el recorrido.

import type { Ejercicio, Extremidades } from '../../tipos';
import { anclaSentado, BANCO_SENTADO, pose, sentado, textos } from './comun';

const TRONCO = 60;
// Brazo vertical: hombro = 270 - 180 - tronco.
const ABAJO: Extremidades = { ...sentado(TRONCO), hombro: 30, codo: 10 };
const ARRIBA: Extremidades = { ...sentado(TRONCO), hombro: 30, codo: 132 };
// La otra mano descansa sobre su rodilla.
const APOYO: Extremidades = { ...sentado(TRONCO), hombro: 38, codo: 58 };
const T = textos('curl-concentrado', ['codo', 'arriba', 'bajada'], ['hombro', 'tronco']);

export const curlConcentrado: Ejercicio = {
  id: 'curl-concentrado',
  nombre: T.nombre,
  grupo: 'brazo',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['mancuerna', 'banco'],
  musculos: { principales: ['biceps'], secundarios: ['braquial', 'antebrazo'] },
  sustitutos: ['curl-sentado-mancuerna', 'curl-biceps-mancuerna'],
  vista: 'lateral',
  ancla: anclaSentado(TRONCO),
  poses: [
    pose(0, ABAJO, { lejos: APOYO }),
    pose(400, ABAJO, { lejos: APOYO }),
    pose(1500, ARRIBA, { lejos: APOYO }),
    pose(1900, ARRIBA, { lejos: APOYO }),
  ],
  cicloMs: 3900,
  esfuerzo: [{ desde: 400, hasta: 1500 }],
  msFicha: 950,
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'punta', lados: ['cerca'] },
  escenario: [BANCO_SENTADO],
  encuadre: { x: -36, y: -4, ancho: 80, alto: 76 },
  cues: T.cues,
  errores: T.errores,
};

// NIVL · IRON · Curl femoral tumbado en máquina, vista lateral (cabeza a la derecha).
//
// Boca abajo en el banco, las rodillas justo fuera del borde y alineadas con
// el eje de la máquina; el rodillo apoya detrás de los tobillos. Se lleva el
// talón hacia el glúteo sin despegar la cadera.
// Biomecánica (comprobada en src/iron/__tests__/pierna.test.ts):
// · Cadera y tronco quietos en el banco (el ancla es la cadera): ni se levanta
//   ni atraviesa el tablero.
// · La rodilla coincide con el eje de la palanca (±0,5).
// · Recorrido de casi estirada (≤ 8°) a unos 115°.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const BASE = { cadera: -4, tobillo: 0, hombro: 81.6, codo: 96.4 } as const;

const ABAJO: Extremidades = { ...BASE, rodilla: 4 };
const MEDIO: Extremidades = { ...BASE, rodilla: 60 };
const ARRIBA: Extremidades = { ...BASE, rodilla: 115 };

const pose = (ms: number, cerca: Extremidades): Pose => ({ ms, cerca, cuello: 0 });

export const curlFemoralTumbado: Ejercicio = {
  id: 'curl-femoral-tumbado',
  nombre: 'iron-pierna:ejercicios.curl-femoral-tumbado.nombre',
  grupo: 'pierna',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['maquina'],
  musculos: {
    principales: ['isquiotibiales'],
    secundarios: ['gemelos'],
  },
  sustitutos: ['curl-nordico', 'peso-muerto-rumano', 'peso-muerto-rumano-mancuerna'],
  vista: 'lateral',
  // Tumbado boca abajo: el tronco hacia +x (la cabeza a la derecha) con el pecho hacia el banco.
  ancla: { punto: 'cadera', x: 0, y: 32.8, segmento: 'tronco', angulo: 4 },
  poses: [pose(0, ABAJO), pose(300, ABAJO), pose(800, MEDIO), pose(1300, ARRIBA), pose(1650, ARRIBA), pose(2550, MEDIO)],
  cicloMs: 3400,
  esfuerzo: [{ desde: 300, hasta: 1300 }],
  msFicha: 1450,
  carga: { tipo: 'palanca', eje: { x: -24.5, y: 32.8 }, cara: 'post' },
  escenario: [{ tipo: 'curl_femoral', x: -22, ancho: 64, alto: 26, capa: 'fondo' }],
  encuadre: { x: -58, y: -4, ancho: 116, alto: 72 },
  cues: [
    'iron-pierna:ejercicios.curl-femoral-tumbado.cues.cadera',
    'iron-pierna:ejercicios.curl-femoral-tumbado.cues.eje',
    'iron-pierna:ejercicios.curl-femoral-tumbado.cues.bajada',
  ],
  errores: [
    'iron-pierna:ejercicios.curl-femoral-tumbado.errores.cadera',
    'iron-pierna:ejercicios.curl-femoral-tumbado.errores.rebote',
  ],
};

// NIVL · IRON · Elevación de gemelos sentado con mancuerna, vista lateral.
//
// Sentado en un banco, la mancuerna sobre la rodilla y la parte delantera
// del pie en un escalón. Con la rodilla doblada el gemelo trabaja poco: el
// que hace el trabajo es el sóleo.
// Biomecánica (comprobada en src/iron/__tests__/pierna.test.ts):
// · La cadera no se mueve del banco (es el ancla) y la rodilla queda a unos 90-105°.
// · La planta bajo los dedos no se mueve del escalón (±0,6): el pie gira sobre
//   ella del talón abajo (+15°) a la punta (-40°); la rodilla sube con el talón.
// · La mancuerna va sobre la rodilla todo el recorrido.
// Las poses están despejadas para que la punta del pie no se mueva.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const ABAJO: Extremidades = { cadera: 97.1, rodilla: 93.6, tobillo: 16.6, hombro: 13.2, codo: 70.3 };
const MEDIO: Extremidades = { cadera: 108.1, rodilla: 100.4, tobillo: -9.7, hombro: 10.1, codo: 88.1 };
const ARRIBA: Extremidades = { cadera: 116.4, rodilla: 99.4, tobillo: -40.9, hombro: 8.5, codo: 100.5 };

const pose = (ms: number, cerca: Extremidades): Pose => ({ ms, cerca, cuello: 10 });

export const gemelosSentado: Ejercicio = {
  id: 'gemelos-sentado',
  nombre: 'iron-pierna:ejercicios.gemelos-sentado.nombre',
  grupo: 'pierna',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['mancuerna', 'banco', 'cajon'],
  musculos: {
    principales: ['soleo'],
    secundarios: ['gemelos'],
  },
  sustitutos: ['gemelos-de-pie'],
  vista: 'lateral',
  ancla: { punto: 'cadera', x: 0, y: 33, segmento: 'tronco', angulo: 84 },
  poses: [pose(0, ABAJO), pose(400, ABAJO), pose(800, MEDIO), pose(1200, ARRIBA), pose(1700, ARRIBA), pose(2400, MEDIO)],
  cicloMs: 3100,
  esfuerzo: [{ desde: 400, hasta: 1200 }],
  msFicha: 1450,
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'punta', lados: ['cerca'] },
  escenario: [
    { tipo: 'banco', x: -26, ancho: 42, alto: 26, capa: 'fondo' },
    { tipo: 'cajon', x: 32.5, ancho: 20, alto: 8, capa: 'fondo' },
  ],
  encuadre: { x: -30, y: -4, ancho: 86, alto: 92 },
  cues: [
    'iron-pierna:ejercicios.gemelos-sentado.cues.rango',
    'iron-pierna:ejercicios.gemelos-sentado.cues.pausa',
    'iron-pierna:ejercicios.gemelos-sentado.cues.peso',
  ],
  errores: [
    'iron-pierna:ejercicios.gemelos-sentado.errores.rebote',
    'iron-pierna:ejercicios.gemelos-sentado.errores.manos',
  ],
};

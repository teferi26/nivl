// NIVL · IRON · Elevación de gemelos de pie en un escalón, con mancuernas, vista lateral.
//
// La parte delantera del pie en el borde del cajón y el talón en el aire: se
// baja el talón por debajo del escalón (estiramiento) y se sube hasta la
// punta de los pies, con las rodillas estiradas.
// Biomecánica (comprobada en src/iron/__tests__/pierna.test.ts):
// · El cuerpo sube y baja en bloque: rodilla y cadera quietas (≤ 4°) y el
//   tronco vertical; solo se mueve el tobillo, de +15° a -30°.
// · La planta bajo los dedos no se mueve del borde del cajón (±1,6 en x, ±0,6 en y):
//   el pie gira sobre ella.
// · El talón baja por debajo del borde del cajón y sube por encima.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const QUIETO = { cadera: 0, rodilla: 2, hombro: 0, codo: 0 } as const;

const ABAJO: Extremidades = { ...QUIETO, tobillo: 15 };
const MEDIO: Extremidades = { ...QUIETO, tobillo: -8 };
const ARRIBA: Extremidades = { ...QUIETO, tobillo: -30 };

// El ancla es el extremo del pie: el ángulo del pie es el del tobillo (la pierna va vertical).
const pose = (ms: number, cerca: Extremidades): Pose => ({ ms, cerca, cuello: 0, angulo: cerca.tobillo });

export const gemelosDePie: Ejercicio = {
  id: 'gemelos-de-pie',
  nombre: 'iron-pierna:ejercicios.gemelos-de-pie.nombre',
  grupo: 'pierna',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['mancuerna', 'cajon'],
  musculos: {
    principales: ['gemelos'],
    secundarios: ['soleo'],
  },
  sustitutos: ['gemelos-sentado'],
  vista: 'lateral',
  ancla: { punto: 'punta_c', x: 0.5, y: 14, segmento: 'pie_c', angulo: 15 },
  poses: [pose(0, ABAJO), pose(500, ABAJO), pose(900, MEDIO), pose(1300, ARRIBA), pose(1800, ARRIBA), pose(2500, MEDIO)],
  cicloMs: 3200,
  esfuerzo: [{ desde: 500, hasta: 1300 }],
  msFicha: 1550,
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'punta', lados: ['cerca', 'lejos'] },
  escenario: [{ tipo: 'cajon', x: -6, ancho: 30, alto: 10, capa: 'fondo' }],
  encuadre: { x: -46, y: -4, ancho: 92, alto: 128 },
  cues: [
    'iron-pierna:ejercicios.gemelos-de-pie.cues.rango',
    'iron-pierna:ejercicios.gemelos-de-pie.cues.pausa',
    'iron-pierna:ejercicios.gemelos-de-pie.cues.rodillas',
  ],
  errores: [
    'iron-pierna:ejercicios.gemelos-de-pie.errores.rebote',
    'iron-pierna:ejercicios.gemelos-de-pie.errores.medio',
  ],
};

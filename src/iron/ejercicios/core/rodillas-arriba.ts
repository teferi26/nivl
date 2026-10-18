// NIVL · IRON · Rodillas arriba (skipping en el sitio), vista lateral.
//
// Carrera en el sitio subiendo cada rodilla a la altura de la cadera, con
// el brazo contrario delante y apoyando la parte delantera del pie.
// Biomecánica (comprobada en src/iron/__tests__/core.test.ts):
// · La rodilla que sube llega a la altura de la cadera (muslo horizontal).
// · Brazo contrario a la pierna: rodilla de cerca arriba, brazo de lejos delante.
// · Apoyo en la parte delantera del pie; tronco erguido (≥ 80°).
// · Entre apoyos hay una fase en el aire (la cadera sube un poco).
// El ancla es la cadera y se mueve (`punto`).

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const DELANTE = { hombro: 50, codo: 90 } as const;
const ATRAS = { hombro: -35, codo: 90 } as const;
const CRUCE = { hombro: 7, codo: 90 } as const;
const SUBE = { cadera: 90, rodilla: 95, tobillo: -20 } as const;
/** Apoyo en la parte delantera del pie (talón un poco levantado), despejado por IK. */
const APOYA = { cadera: 15.8, rodilla: 25.3, tobillo: -13.6 } as const;
const BAJA = { cadera: 30, rodilla: 35, tobillo: -25 } as const;
const VIENE = { cadera: 35, rodilla: 50, tobillo: -20 } as const;

const pose = (ms: number, y: number, cerca: Extremidades, lejos: Extremidades): Pose => ({
  ms,
  punto: { x: 0, y },
  cuello: 0,
  cerca,
  lejos,
});

export const rodillasArriba: Ejercicio = {
  id: 'rodillas-arriba',
  nombre: 'iron-core:ejercicios.rodillas-arriba.nombre',
  grupo: 'cardio',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['peso_corporal'],
  musculos: {
    principales: ['cuadriceps', 'gemelos'],
    secundarios: ['abdomen', 'gluteo', 'isquiotibiales'],
  },
  sustitutos: ['talones-gluteo', 'comba', 'saltos-tijera'],
  vista: 'lateral',
  ancla: { punto: 'cadera', x: 0, y: 56.5, segmento: 'tronco', angulo: 88 },
  poses: [
    pose(0, 56.5, { ...SUBE, ...ATRAS }, { ...APOYA, ...DELANTE }),
    pose(375, 58, { ...BAJA, ...CRUCE }, { ...VIENE, ...CRUCE }),
    pose(750, 56.5, { ...APOYA, ...DELANTE }, { ...SUBE, ...ATRAS }),
    pose(1125, 58, { ...VIENE, ...CRUCE }, { ...BAJA, ...CRUCE }),
  ],
  cicloMs: 1500,
  esfuerzo: [
    { desde: 375, hasta: 750 },
    { desde: 1125, hasta: 1500 },
  ],
  msFicha: 0,
  encuadre: { x: -40, y: -4, ancho: 88, alto: 112 },
  cues: [
    'iron-core:ejercicios.rodillas-arriba.cues.altura',
    'iron-core:ejercicios.rodillas-arriba.cues.brazos',
    'iron-core:ejercicios.rodillas-arriba.cues.pisada',
  ],
  errores: [
    'iron-core:ejercicios.rodillas-arriba.errores.atras',
    'iron-core:ejercicios.rodillas-arriba.errores.talones',
  ],
};

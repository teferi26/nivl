// NIVL · IRON · Talones al glúteo, vista lateral.
//
// Carrera en el sitio llevando cada talón hacia el glúteo, con el muslo
// casi vertical y los brazos acompañando.
// Biomecánica (comprobada en src/iron/__tests__/core.test.ts):
// · El talón que sube llega cerca del glúteo (rodilla ≥ 130°).
// · El muslo de esa pierna se queda casi vertical (cadera entre -10 y 15°):
//   no se adelanta la rodilla.
// · Apoyo en la parte delantera del pie; tronco erguido.
// El ancla es la cadera y se mueve (`punto`).

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const DELANTE = { hombro: 50, codo: 90 } as const;
const ATRAS = { hombro: -35, codo: 90 } as const;
const CRUCE = { hombro: 7, codo: 90 } as const;
const TALON = { cadera: -5, rodilla: 135, tobillo: -30 } as const;
/** Apoyo en la parte delantera del pie (talón un poco levantado), despejado por IK. */
const APOYA = { cadera: 17.8, rodilla: 25.3, tobillo: -13.6 } as const;
const BAJA = { cadera: 12, rodilla: 45, tobillo: -12 } as const;
const VIENE = { cadera: 14, rodilla: 70, tobillo: -10 } as const;

const pose = (ms: number, y: number, cerca: Extremidades, lejos: Extremidades): Pose => ({
  ms,
  punto: { x: 0, y },
  cuello: 0,
  cerca,
  lejos,
});

export const talonesGluteo: Ejercicio = {
  id: 'talones-gluteo',
  nombre: 'iron-core:ejercicios.talones-gluteo.nombre',
  grupo: 'cardio',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['peso_corporal'],
  musculos: {
    principales: ['isquiotibiales', 'gemelos'],
    secundarios: ['cuadriceps', 'gluteo', 'abdomen'],
  },
  sustitutos: ['rodillas-arriba', 'comba', 'saltos-tijera'],
  vista: 'lateral',
  ancla: { punto: 'cadera', x: 0, y: 56.5, segmento: 'tronco', angulo: 86 },
  poses: [
    pose(0, 56.5, { ...TALON, ...ATRAS }, { ...APOYA, ...DELANTE }),
    pose(375, 58, { ...BAJA, ...CRUCE }, { ...VIENE, ...CRUCE }),
    pose(750, 56.5, { ...APOYA, ...DELANTE }, { ...TALON, ...ATRAS }),
    pose(1125, 58, { ...VIENE, ...CRUCE }, { ...BAJA, ...CRUCE }),
  ],
  cicloMs: 1500,
  esfuerzo: [
    { desde: 375, hasta: 750 },
    { desde: 1125, hasta: 1500 },
  ],
  msFicha: 0,
  encuadre: { x: -44, y: -4, ancho: 88, alto: 112 },
  cues: [
    'iron-core:ejercicios.talones-gluteo.cues.talon',
    'iron-core:ejercicios.talones-gluteo.cues.muslo',
    'iron-core:ejercicios.talones-gluteo.cues.pisada',
  ],
  errores: [
    'iron-core:ejercicios.talones-gluteo.errores.rodilla',
    'iron-core:ejercicios.talones-gluteo.errores.inclinarse',
  ],
};

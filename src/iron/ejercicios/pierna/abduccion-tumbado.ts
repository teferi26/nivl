// NIVL · IRON · Abducción de cadera tumbado de lado, vista frontal. En casa.
//
// Tumbado sobre un costado, con la cabeza apoyada en el brazo de abajo y la
// pierna de abajo estirada, la de arriba sube recta unos 40° sin girar la
// cadera (la punta del pie mira al frente) y baja despacio. Trabaja el glúteo
// medio, el abductor principal de la cadera.
// Vista frontal girada: el tronco va tumbado (cabeza a la izquierda) y la
// abducción de la pierna de arriba (la lejana) la sube.
// Biomecánica (comprobada en src/iron/__tests__/pierna.test.ts):
// · La pierna de abajo y el tronco no se mueven (la cadera es el ancla).
// · La pierna de arriba sube recta (rodilla 0) hasta 35 a 45° de abducción.
// · Nada atraviesa el suelo.

import type { Ejercicio, Pose } from '../../tipos';

const ABAJO_C = { cadera: -5.5, rodilla: 0, tobillo: 0, hombro: 174.5, codo: 0 } as const;
const BRAZO_ARRIBA = { hombro: -80, codo: 40 } as const;

const pose = (ms: number, abduccion: number): Pose => ({
  ms,
  cuello: -8,
  cerca: ABAJO_C,
  lejos: { cadera: abduccion, rodilla: 0, tobillo: 0, ...BRAZO_ARRIBA },
  escorzo: { brazo_l: 0.8, antebrazo_l: 0.8 },
});

export const abduccionTumbado: Ejercicio = {
  id: 'abduccion-tumbado',
  nombre: 'iron-pierna:ejercicios.abduccion-tumbado.nombre',
  grupo: 'pierna',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['peso_corporal'],
  musculos: {
    principales: ['gluteo_medio'],
    secundarios: ['gluteo', 'oblicuos'],
  },
  sustitutos: ['abduccion-maquina'],
  vista: 'frontal',
  ancla: { punto: 'cadera', x: 0, y: 15.5, segmento: 'tronco', angulo: 174.5 },
  poses: [pose(0, 0), pose(300, 0), pose(800, 22), pose(1200, 40), pose(1600, 40), pose(2300, 22)],
  cicloMs: 3000,
  esfuerzo: [{ desde: 300, hasta: 1200 }],
  msFicha: 1400,
  encuadre: { x: -58, y: -4, ancho: 120, alto: 64 },
  cues: [
    'iron-pierna:ejercicios.abduccion-tumbado.cues.recta',
    'iron-pierna:ejercicios.abduccion-tumbado.cues.punta',
    'iron-pierna:ejercicios.abduccion-tumbado.cues.lento',
  ],
  errores: [
    'iron-pierna:ejercicios.abduccion-tumbado.errores.girar',
    'iron-pierna:ejercicios.abduccion-tumbado.errores.alto',
  ],
};

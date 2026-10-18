// NIVL · IRON · Perro boca abajo con pedaleo, vista lateral.
//
// Manos y puntas de los pies en la esterilla y la cadera arriba (V
// invertida), brazos y espalda en línea. Se alterna estirar una rodilla
// llevando ese talón hacia el suelo mientras la otra se dobla.
// Biomecánica (comprobada en src/iron/__tests__/core.test.ts):
// · Manos quietas y brazos en la línea del tronco (ancla en la mano).
// · La cadera es el punto más alto del cuerpo.
// · Las puntas de los pies no se mueven; el talón que baja deja la rodilla
//   casi estirada (≤ 15°) y el otro se levanta con la rodilla doblada.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

// Brazos en la línea del tronco (hombro a 180°); piernas despejadas por IK
// con las puntas de los pies quietas.
const BASE: Extremidades = { cadera: 111.8, rodilla: 39.7, tobillo: 29.9, hombro: 180, codo: 0 };
/** Talón abajo, rodilla casi estirada. */
const ESTIRA: Extremidades = { cadera: 97.9, rodilla: 12.1, tobillo: 28.2, hombro: 180, codo: 0 };
/** Talón arriba, rodilla doblada. */
const DOBLA: Extremidades = { cadera: 123.2, rodilla: 59.6, tobillo: 21.4, hombro: 180, codo: 0 };

const pose = (ms: number, cerca: Extremidades, lejos: Extremidades): Pose => ({ ms, cuello: 35, cerca, lejos });

export const perroBocaAbajo: Ejercicio = {
  id: 'perro-boca-abajo',
  nombre: 'iron-core:ejercicios.perro-boca-abajo.nombre',
  grupo: 'movilidad',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['esterilla'],
  musculos: {
    principales: ['isquiotibiales', 'gemelos'],
    secundarios: ['dorsal', 'deltoides_anterior', 'serrato', 'gluteo'],
  },
  sustitutos: ['bisagra-cadera', 'balanceo-pierna', 'movilidad-tobillo'],
  vista: 'lateral',
  // La mano en la esterilla; el brazo baja hacia ella a -40° (en línea con el tronco).
  ancla: { punto: 'agarre_c', x: 0, y: 3.2, segmento: 'brazo_c', angulo: -40 },
  poses: [pose(0, ESTIRA, DOBLA), pose(700, BASE, BASE), pose(1400, DOBLA, ESTIRA), pose(2100, BASE, BASE)],
  cicloMs: 2800,
  esfuerzo: [
    { desde: 700, hasta: 1400 },
    { desde: 2100, hasta: 2800 },
  ],
  msFicha: 0,
  escenario: [{ tipo: 'esterilla', x: -96, ancho: 104, alto: 0.8, capa: 'fondo' }],
  encuadre: { x: -100, y: -4, ancho: 112, alto: 64 },
  cues: [
    'iron-core:ejercicios.perro-boca-abajo.cues.manos',
    'iron-core:ejercicios.perro-boca-abajo.cues.cadera',
    'iron-core:ejercicios.perro-boca-abajo.cues.talones',
  ],
  errores: [
    'iron-core:ejercicios.perro-boca-abajo.errores.espalda',
    'iron-core:ejercicios.perro-boca-abajo.errores.hombros',
  ],
};

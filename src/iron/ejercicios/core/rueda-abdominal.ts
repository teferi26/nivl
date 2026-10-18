// NIVL · IRON · Rueda abdominal de rodillas, vista lateral.
//
// De rodillas en la esterilla con las manos en la rueda bajo los hombros.
// Se rueda hacia delante estirando cadera y hombros hasta casi alinear el
// cuerpo, sin hundir la zona lumbar, y se vuelve tirando con el abdomen.
// Biomecánica (comprobada en src/iron/__tests__/core.test.ts):
// · Las rodillas no se mueven (ancla en la rodilla) y los dedos de los pies
//   siguen apoyados.
// · La rueda va siempre por el suelo (el agarre a la altura del radio, ±1,5)
//   y avanza y vuelve sin saltos.
// · Brazos estirados todo el recorrido; delante, la cadera sigue un poco
//   flexionada (no se hunde la espalda).
// Las cinco poses de ida están despejadas para que los brazos, rectos,
// lleguen a la rueda en el suelo.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const PIE = { tobillo: 19, codo: 0 } as const;
const P0: Extremidades = { ...PIE, cadera: 77, rodilla: 124, hombro: 68.7 };
const P1: Extremidades = { ...PIE, cadera: 62, rodilla: 104, hombro: 85.3 };
const P2: Extremidades = { ...PIE, cadera: 47, rodilla: 84, hombro: 106.5 };
const P3: Extremidades = { ...PIE, cadera: 32, rodilla: 64, hombro: 128.4 };
const P4: Extremidades = { ...PIE, cadera: 17, rodilla: 44, hombro: 150.6 };

/**
 * `angulo`: el del muslo (de la cadera a la rodilla). El cuello pasa de
 * mirar al suelo (5°) a la línea del tronco con la mirada un poco al frente
 * (-5°) al estirarse: así el brazo de delante no tapa la cara.
 */
const pose = (ms: number, cerca: Extremidades, angulo: number): Pose => ({ ms, cerca, angulo, cuello: 5 - ((285 - angulo) / 80) * 10 });

export const ruedaAbdominal: Ejercicio = {
  id: 'rueda-abdominal',
  nombre: 'iron-core:ejercicios.rueda-abdominal.nombre',
  grupo: 'core',
  nivel: 'avanzado',
  tipo: 'dinamico',
  material: ['rueda', 'esterilla'],
  musculos: {
    principales: ['abdomen'],
    secundarios: ['transverso', 'dorsal', 'serrato', 'deltoides_anterior', 'triceps'],
  },
  sustitutos: ['plancha-alta', 'hollow-hold', 'plancha'],
  vista: 'lateral',
  ancla: { punto: 'rodilla_c', x: 0, y: 4.8, segmento: 'muslo_c', angulo: 285 },
  poses: [
    pose(0, P0, 285),
    pose(300, P0, 285),
    pose(800, P1, 265),
    pose(1300, P2, 245),
    pose(1800, P3, 225),
    pose(2300, P4, 205),
    pose(2700, P4, 205),
    pose(3100, P3, 225),
    pose(3500, P2, 245),
    pose(3900, P1, 265),
  ],
  cicloMs: 4400,
  esfuerzo: [{ desde: 2700, hasta: 4400 }],
  msFicha: 1300,
  carga: { tipo: 'rueda', radio: 5 },
  escenario: [{ tipo: 'esterilla', x: -34, ancho: 128, alto: 0.8, capa: 'fondo' }],
  encuadre: { x: -36, y: -4, ancho: 132, alto: 64 },
  cues: [
    'iron-core:ejercicios.rueda-abdominal.cues.lumbar',
    'iron-core:ejercicios.rueda-abdominal.cues.rango',
    'iron-core:ejercicios.rueda-abdominal.cues.vuelta',
  ],
  errores: [
    'iron-core:ejercicios.rueda-abdominal.errores.hundir',
    'iron-core:ejercicios.rueda-abdominal.errores.cadera',
    'iron-core:ejercicios.rueda-abdominal.errores.rango',
  ],
};

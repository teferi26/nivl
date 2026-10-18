// NIVL · IRON · Prensa de piernas inclinada (45°), vista lateral.
//
// Sentado con la espalda en el respaldo y los pies en la plataforma, se baja
// el carro doblando rodillas y cadera y se empuja hasta casi estirar.
// Biomecánica (comprobada en src/iron/__tests__/pierna.test.ts):
// · La cadera y la espalda no se mueven del asiento (el ancla es la cadera).
// · El pie va plano en la plataforma, que corre por el raíl a 45°: el tobillo
//   se mueve en línea recta con esa inclinación (±0,6).
// · Arriba las rodillas quedan sin bloquear (≥ 10°); abajo, unos 90°, sin
//   que la cadera se despegue (flexión de cadera ≤ 130°).
// Las poses están despejadas para que el tobillo vaya por el raíl.

import { RESPALDO_PRENSA } from '../../material/prensa';
import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const BRAZOS = { hombro: -7, codo: 14.4 } as const;

const ARRIBA: Extremidades = { cadera: 85.3, rodilla: 14.7, tobillo: 2.3, ...BRAZOS };
const MEDIO: Extremidades = { cadera: 110.3, rodilla: 63, tobillo: 25.7, ...BRAZOS };
const ABAJO: Extremidades = { cadera: 124.4, rodilla: 88.9, tobillo: 37.5, ...BRAZOS };

const pose = (ms: number, cerca: Extremidades): Pose => ({ ms, cerca, cuello: 8 });

export const prensa: Ejercicio = {
  id: 'prensa',
  nombre: 'iron-pierna:ejercicios.prensa.nombre',
  grupo: 'pierna',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['maquina'],
  musculos: {
    principales: ['cuadriceps', 'gluteo'],
    secundarios: ['aductores', 'isquiotibiales'],
  },
  sustitutos: ['sentadilla-goblet', 'sentadilla-frontal', 'sentadilla-bulgara'],
  vista: 'lateral',
  ancla: { punto: 'cadera', x: 0, y: 30, segmento: 'tronco', angulo: RESPALDO_PRENSA },
  poses: [pose(0, ARRIBA), pose(400, ARRIBA), pose(1350, MEDIO), pose(2300, ABAJO), pose(2550, ABAJO), pose(3250, MEDIO)],
  cicloMs: 4000,
  esfuerzo: [{ desde: 2550, hasta: 4000 }],
  carga: { tipo: 'prensa', angulo: 45 },
  escenario: [{ tipo: 'prensa', x: -1.8, ancho: 16, alto: 22.4, capa: 'fondo' }],
  encuadre: { x: -48, y: -4, ancho: 112, alto: 104 },
  cues: [
    'iron-pierna:ejercicios.prensa.cues.espalda',
    'iron-pierna:ejercicios.prensa.cues.rodillas',
    'iron-pierna:ejercicios.prensa.cues.profundidad',
    'iron-pierna:ejercicios.prensa.cues.seguros',
  ],
  errores: [
    'iron-pierna:ejercicios.prensa.errores.bloquear',
    'iron-pierna:ejercicios.prensa.errores.despegar',
    'iron-pierna:ejercicios.prensa.errores.talones',
  ],
};

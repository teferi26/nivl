// NIVL · IRON · Zancada estática (split squat), vista lateral. En casa.
//
// Un pie delante y otro detrás, de puntillas, sin moverlos: se baja en
// vertical hasta que la rodilla de atrás casi toca el suelo. Manos en la cadera.
// Biomecánica (comprobada en src/iron/__tests__/pierna.test.ts):
// · Pie de delante plano y quieto; la punta del de atrás no se mueve del
//   suelo (±1,5 en todo el ciclo).
// · Abajo, la rodilla de atrás queda cerca del suelo (por debajo de 12) y
//   bajo la cadera; la de delante no pasa la punta del pie más de 3.
// · Tronco casi vertical (≥ 80°).
// Las poses están despejadas para que los dos pies sigan en su sitio.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const MANOS = { hombro: -39.5, codo: 91 } as const;

const ARRIBA: Extremidades = { cadera: 36.5, rodilla: 27.1, tobillo: -7.4, ...MANOS };
const MEDIO: Extremidades = { cadera: 67.8, rodilla: 73.1, tobillo: 9.3, ...MANOS };
const ABAJO: Extremidades = { cadera: 91.1, rodilla: 97.8, tobillo: 12.8, ...MANOS };

const ARRIBA_L: Extremidades = { cadera: -21.9, rodilla: 25.5, tobillo: 14.4, ...MANOS };
const MEDIO_L: Extremidades = { cadera: 3.3, rodilla: 82.9, tobillo: 33.6, ...MANOS };
const ABAJO_L: Extremidades = { cadera: 12.7, rodilla: 113, tobillo: 42.3, ...MANOS };

const pose = (ms: number, cerca: Extremidades, lejos: Extremidades, cuello: number): Pose => ({ ms, cerca, lejos, cuello });

export const zancadaEstatica: Ejercicio = {
  id: 'zancada-estatica',
  nombre: 'iron-pierna:ejercicios.zancada-estatica.nombre',
  grupo: 'pierna',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['peso_corporal'],
  musculos: {
    principales: ['cuadriceps', 'gluteo'],
    secundarios: ['aductores', 'gluteo_medio', 'psoas'],
  },
  sustitutos: ['zancada-atras-mancuerna', 'sentadilla-bulgara', 'sentadilla-peso-corporal'],
  vista: 'lateral',
  ancla: { punto: 'tobillo_c', x: 0, y: 4, segmento: 'pie_c', angulo: 0 },
  poses: [
    pose(0, ARRIBA, ARRIBA_L, 0),
    pose(400, ARRIBA, ARRIBA_L, 0),
    pose(1200, MEDIO, MEDIO_L, 0),
    pose(2000, ABAJO, ABAJO_L, 0),
    pose(2250, ABAJO, ABAJO_L, 0),
    pose(2950, MEDIO, MEDIO_L, 0),
  ],
  cicloMs: 3600,
  esfuerzo: [{ desde: 2250, hasta: 3600 }],
  encuadre: { x: -62, y: -4, ancho: 100, alto: 104 },
  cues: [
    'iron-pierna:ejercicios.zancada-estatica.cues.vertical',
    'iron-pierna:ejercicios.zancada-estatica.cues.rodilla',
    'iron-pierna:ejercicios.zancada-estatica.cues.empuje',
  ],
  errores: [
    'iron-pierna:ejercicios.zancada-estatica.errores.corta',
    'iron-pierna:ejercicios.zancada-estatica.errores.inclinar',
  ],
};

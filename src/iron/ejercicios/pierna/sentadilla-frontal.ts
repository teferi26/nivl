// NIVL · IRON · Sentadilla frontal con barra, en el rack, vista lateral.
//
// La barra va delante, sobre los deltoides, con los codos altos: el tronco
// queda más vertical que en la sentadilla con la barra a la espalda y el
// cuádriceps hace más trabajo.
// Biomecánica (comprobada en src/iron/__tests__/pierna.test.ts):
// · La barra baja y sube en vertical sobre el medio del pie (±2).
// · Pies planos; abajo la cadera pasa por debajo de la rodilla.
// · Tronco más vertical que en la sentadilla trasera (≥ 60° abajo).
// · Codos altos: el brazo apunta hacia delante (los brazos salen del plano: escorzo).
// El rack queda detrás, con los seguros por debajo del punto más bajo de la barra.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const BRAZOS = { hombro: 100, codo: -165.5 } as const;
const ESCORZO = { brazo_c: 0.75, brazo_l: 0.75, antebrazo_c: 0.31, antebrazo_l: 0.31 } as const;

const ARRIBA: Extremidades = { cadera: 10.9, rodilla: 12.9, tobillo: 3, ...BRAZOS };
const MEDIO: Extremidades = { cadera: 73.3, rodilla: 88, tobillo: 28.7, ...BRAZOS };
const ABAJO: Extremidades = { cadera: 121.2, rodilla: 122.9, tobillo: 25.6, ...BRAZOS };

const pose = (ms: number, cerca: Extremidades, cuello: number): Pose => ({ ms, cerca, cuello, escorzo: ESCORZO });

export const sentadillaFrontal: Ejercicio = {
  id: 'sentadilla-frontal',
  nombre: 'iron-pierna:ejercicios.sentadilla-frontal.nombre',
  grupo: 'pierna',
  nivel: 'avanzado',
  tipo: 'dinamico',
  material: ['barra', 'rack'],
  musculos: {
    principales: ['cuadriceps'],
    secundarios: ['gluteo', 'aductores', 'abdomen', 'espalda_alta'],
  },
  sustitutos: ['sentadilla-goblet', 'sentadilla-barra', 'prensa'],
  vista: 'lateral',
  ancla: { punto: 'tobillo_c', x: 0, y: 4, segmento: 'pie_c', angulo: 0 },
  poses: [
    pose(0, ARRIBA, 0),
    pose(600, ARRIBA, 0),
    pose(1600, MEDIO, -4),
    pose(2600, ABAJO, -8),
    pose(2900, ABAJO, -8),
    pose(3700, MEDIO, -4),
  ],
  cicloMs: 4600,
  esfuerzo: [{ desde: 2900, hasta: 4600 }],
  // Cámara en 3/4: el disco cercano queda delante y abajo, lejos de la cara.
  carga: { tipo: 'barra', en: 'tronco', t: 0.97, dorso: -6.2, disco: 8.5, eje: { x: 14, y: 2 } },
  escenario: [{ tipo: 'rack', x: -30, ancho: 50, alto: 78, capa: 'fondo', seguro: 42 }],
  encuadre: { x: -48, y: -4, ancho: 96, alto: 112 },
  cues: [
    'iron-pierna:ejercicios.sentadilla-frontal.cues.codos',
    'iron-pierna:ejercicios.sentadilla-frontal.cues.pie',
    'iron-pierna:ejercicios.sentadilla-frontal.cues.tronco',
    'iron-pierna:ejercicios.sentadilla-frontal.cues.seguros',
  ],
  errores: [
    'iron-pierna:ejercicios.sentadilla-frontal.errores.codosCaen',
    'iron-pierna:ejercicios.sentadilla-frontal.errores.talones',
    'iron-pierna:ejercicios.sentadilla-frontal.errores.rodillasDentro',
  ],
};

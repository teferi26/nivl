// NIVL · IRON · Sentadilla con barra (barra alta), vista lateral.
//
// Biomecánica (comprobada en src/iron/__tests__/biomecanica.test.ts):
// · La barra baja y sube en vertical sobre el medio del pie (±2 unidades).
// · Profundidad: el pliegue de la cadera acaba por debajo de la rodilla.
// · Pies planos todo el recorrido; las rodillas avanzan sobre la punta.
// · Espalda neutra: el tronco se inclina en bloque y la cabeza sigue al tronco.
// Los ángulos de la cadera de cada pose están despejados para que la barra
// quede sobre el medio del pie; los de los brazos, para que las manos sigan
// en la barra (los brazos salen del plano por el agarre ancho: escorzo).

import type { Ejercicio, Extremidades, Pose } from '../tipos';

const BRAZOS = { hombro: -9.2, codo: -147 } as const;
const ESCORZO = { brazo_c: 0.62, brazo_l: 0.62, antebrazo_c: 0.5, antebrazo_l: 0.5 } as const;

const ARRIBA: Extremidades = { tobillo: 5, rodilla: 4, cadera: 13.5, ...BRAZOS, hombro: -10.8, codo: -144.3 };
const MEDIO: Extremidades = { tobillo: 22, rodilla: 70, cadera: 85, ...BRAZOS };
const ABAJO: Extremidades = { tobillo: 36, rodilla: 135, cadera: 137.5, ...BRAZOS, codo: -147.2 };

const pose = (ms: number, cerca: Extremidades, cuello: number): Pose => ({ ms, cerca, cuello, escorzo: ESCORZO });

export const sentadillaBarra: Ejercicio = {
  id: 'sentadilla-barra',
  nombre: 'iron:ejercicios.sentadilla-barra.nombre',
  grupo: 'pierna',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['barra'],
  musculos: {
    principales: ['cuadriceps', 'gluteo'],
    secundarios: ['aductores', 'isquiotibiales', 'lumbares', 'abdomen', 'gemelos'],
  },
  sustitutos: [],
  vista: 'lateral',
  ancla: { punto: 'tobillo_c', x: 0, y: 4, segmento: 'pie_c', angulo: 0 },
  poses: [
    pose(0, ARRIBA, 0),
    pose(600, ARRIBA, 0),
    pose(1600, MEDIO, -6),
    pose(2600, ABAJO, -10),
    pose(2900, ABAJO, -10),
    pose(3700, MEDIO, -6),
  ],
  cicloMs: 4600,
  esfuerzo: [{ desde: 2900, hasta: 4600 }],
  // Cámara en 3/4 y discos pequeños: ni la barra ni los discos tapan cabeza ni torso.
  carga: { tipo: 'barra', en: 'tronco', t: 1, dorso: 6.6, disco: 8.5, eje: { x: -15, y: 6 } },
  encuadre: { x: -48, y: -4, ancho: 96, alto: 112 },
  cues: [
    'iron:ejercicios.sentadilla-barra.cues.pie',
    'iron:ejercicios.sentadilla-barra.cues.rodillas',
    'iron:ejercicios.sentadilla-barra.cues.profundidad',
    'iron:ejercicios.sentadilla-barra.cues.espalda',
  ],
  errores: [
    'iron:ejercicios.sentadilla-barra.errores.talones',
    'iron:ejercicios.sentadilla-barra.errores.lumbar',
    'iron:ejercicios.sentadilla-barra.errores.rodillasDentro',
  ],
};

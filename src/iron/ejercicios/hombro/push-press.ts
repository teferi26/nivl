// NIVL · IRON · Hombro · Push press con barra, de pie, vista lateral.
//
// Como el press militar, pero arranca con un impulso de piernas: flexión
// corta de rodillas con el tronco vertical (la barra no se adelanta) y
// extensión explosiva que lanza la barra; los brazos terminan el press.
// Biomecánica (src/iron/__tests__/hombro.test.ts):
// · En el impulso el tronco sigue vertical (±4°) y los talones apoyados.
// · Antebrazos verticales bajo la barra y bloqueo sobre el medio del pie.
// · Flexión de rodilla corta (≤ 45°): es un impulso, no una sentadilla.

import type { Ejercicio, Pose } from '../../tipos';
import { PASOS_PRESS, PIERNAS_PIE, posePress } from './press-militar-barra';

// Tronco vertical: rodilla = tobillo + cadera (ver esqueleto.ts).
const IMPULSO = { tobillo: 22, rodilla: 42, cadera: 20 } as const;
const [RACK, P1, P2, P3, P4, P5, P6, ARRIBA] = PASOS_PRESS;

const poses: Pose[] = [
  posePress(0, RACK),
  posePress(250, RACK),
  posePress(650, RACK, IMPULSO),
  posePress(900, P2),
  posePress(1050, P3),
  posePress(1180, P4),
  posePress(1300, P5),
  posePress(1420, P6),
  posePress(1580, ARRIBA),
  posePress(1950, ARRIBA),
  posePress(2250, P5),
  posePress(2500, P3),
  posePress(2750, P1),
  // La barra vuelve a la clavícula amortiguando con las rodillas.
  posePress(2950, RACK, { tobillo: 6, rodilla: 9, cadera: 3 }),
  posePress(3200, RACK, PIERNAS_PIE),
];

export const pushPress: Ejercicio = {
  id: 'push-press',
  nombre: 'iron-hombro:ejercicios.push-press.nombre',
  grupo: 'hombro',
  nivel: 'avanzado',
  tipo: 'dinamico',
  material: ['barra'],
  musculos: {
    principales: ['deltoides_anterior'],
    secundarios: ['triceps', 'deltoides_lateral', 'cuadriceps', 'gluteo', 'trapecio'],
  },
  sustitutos: ['press-militar-barra', 'press-militar-mancuerna'],
  vista: 'lateral',
  ancla: { punto: 'tobillo_c', x: 0, y: 4, segmento: 'pie_c', angulo: 0 },
  poses,
  cicloMs: 3600,
  esfuerzo: [{ desde: 650, hasta: 1580 }],
  msFicha: 1050,
  carga: { tipo: 'barra', en: 'agarre', disco: 8.5, eje: { x: 13, y: -6 } },
  encuadre: { x: -40, y: -4, ancho: 84, alto: 132 },
  cues: [
    'iron-hombro:ejercicios.push-press.cues.impulso',
    'iron-hombro:ejercicios.push-press.cues.tronco',
    'iron-hombro:ejercicios.push-press.cues.bloqueo',
  ],
  errores: [
    'iron-hombro:ejercicios.push-press.errores.sentadilla',
    'iron-hombro:ejercicios.push-press.errores.talones',
    'iron-hombro:ejercicios.push-press.errores.adelante',
  ],
};

// NIVL · IRON · Hombro · Press Arnold con mancuernas, de pie, vista lateral.
//
// Empieza con las mancuernas delante de la cara, palmas hacia ti y codos
// delante del pecho; al subir, los codos se abren hacia fuera y las palmas
// giran hacia delante hasta el bloqueo. El giro hace que el deltoides
// anterior trabaje en todo el recorrido.
// Biomecánica (src/iron/__tests__/hombro.test.ts):
// · Antebrazos verticales (±15°) en todo el recorrido.
// · Abajo, codos delante del tronco (brazo casi en el plano); en medio el
//   brazo sale del plano al abrirse (escorzo); arriba, bloqueo sobre el hombro.
// · Tronco y piernas quietos.

import type { Ejercicio, Pose } from '../../tipos';
import { ANCLA_PIE_LATERAL } from './comun';
import { posePress, type PasoPress } from './press-militar-barra';

// Despejados con el antebrazo vertical y la mano en (10, 88), (9,8, 93), (9,2, 98),
// (8, 103,5), (6,2, 109), (4,6, 114) y (3,7, 119,3).
const PASOS: readonly PasoPress[] = [
  { hombro: 35.4, codo: 144.6, brazo: 0.89, cuello: 0 },
  { hombro: 47.9, codo: 132.1, brazo: 0.68, cuello: -3 },
  { hombro: 68.4, codo: 111.6, brazo: 0.51, cuello: -6 },
  { hombro: 104.9, codo: 75.1, brazo: 0.42, cuello: -6 },
  { hombro: 142.5, codo: 37.5, brazo: 0.51, cuello: -3 },
  { hombro: 161.6, codo: 18.4, brazo: 0.71, cuello: 0 },
  { hombro: 169.6, codo: 10.4, brazo: 0.98, cuello: 0 },
];

const poses: Pose[] = [posePress(0, PASOS[0]), posePress(300, PASOS[0])];
for (let i = 1; i < PASOS.length; i++) poses.push(posePress(300 + i * 200, PASOS[i]));
// Pausa arriba y bajada deshaciendo el giro.
for (let i = PASOS.length - 2; i >= 1; i--) poses.push(posePress(1800 + (PASOS.length - 2 - i) * 330, PASOS[i]));

export const pressArnold: Ejercicio = {
  id: 'press-arnold',
  nombre: 'iron-hombro:ejercicios.press-arnold.nombre',
  grupo: 'hombro',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['mancuerna'],
  musculos: {
    principales: ['deltoides_anterior'],
    secundarios: ['deltoides_lateral', 'triceps', 'trapecio', 'manguito_rotador'],
  },
  sustitutos: ['press-militar-mancuerna', 'press-mancuerna-sentado', 'press-militar-barra'],
  vista: 'lateral',
  ancla: ANCLA_PIE_LATERAL,
  poses,
  cicloMs: 3700,
  esfuerzo: [{ desde: 300, hasta: 1500 }],
  msFicha: 300,
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'punta', lados: ['cerca', 'lejos'] },
  encuadre: { x: -40, y: -4, ancho: 84, alto: 132 },
  cues: [
    'iron-hombro:ejercicios.press-arnold.cues.inicio',
    'iron-hombro:ejercicios.press-arnold.cues.giro',
    'iron-hombro:ejercicios.press-arnold.cues.abdomen',
  ],
  errores: [
    'iron-hombro:ejercicios.press-arnold.errores.arco',
    'iron-hombro:ejercicios.press-arnold.errores.rapido',
  ],
};

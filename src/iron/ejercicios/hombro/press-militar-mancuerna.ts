// NIVL · IRON · Hombro · Press militar con mancuernas, de pie.
//
// Vista FRONTAL: así se ve que los antebrazos van verticales y las
// mancuernas suben por fuera de la cabeza.
// Biomecánica (src/iron/__tests__/hombro.test.ts):
// · Antebrazos verticales todo el recorrido (±12°): codo = 180 - abducción.
// · Abajo, codos algo por delante del tronco (brazo en escorzo) y mancuernas
//   a la altura de las orejas; arriba, brazos casi estirados sin chocar las
//   mancuernas.
// · Las mancuernas nunca pasan por encima de la cabeza (no hay riesgo de
//   golpe) y el tronco no se mueve.

import type { Ejercicio, Pose } from '../../tipos';
import { ANCLA_PIE_FRONTAL, conBrazos, PIERNAS_PIE_FRONTAL } from './comun';

const pose = (ms: number, abduccion: number, brazo: number): Pose => ({
  ms,
  cuello: 0,
  cerca: conBrazos(PIERNAS_PIE_FRONTAL, abduccion, 180 - abduccion),
  escorzo: { brazo_c: brazo, brazo_l: brazo },
});

const ABAJO = 78;
const MEDIO = 118;
const ARRIBA = 160;

export const POSES_PRESS_FRONTAL: readonly Pose[] = [
  pose(0, ABAJO, 0.84),
  pose(300, ABAJO, 0.84),
  pose(800, MEDIO, 0.95),
  pose(1300, ARRIBA, 1),
  pose(1600, ARRIBA, 1),
  pose(2400, MEDIO, 0.95),
];

export const pressMilitarMancuerna: Ejercicio = {
  id: 'press-militar-mancuerna',
  nombre: 'iron-hombro:ejercicios.press-militar-mancuerna.nombre',
  grupo: 'hombro',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['mancuerna'],
  musculos: {
    principales: ['deltoides_anterior'],
    secundarios: ['deltoides_lateral', 'triceps', 'trapecio'],
  },
  sustitutos: ['press-mancuerna-sentado', 'press-militar-barra', 'press-arnold', 'press-banda'],
  vista: 'frontal',
  ancla: ANCLA_PIE_FRONTAL,
  poses: POSES_PRESS_FRONTAL,
  cicloMs: 3400,
  esfuerzo: [{ desde: 300, hasta: 1300 }],
  msFicha: 800,
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'punta', lados: ['cerca', 'lejos'] },
  encuadre: { x: -54, y: -4, ancho: 108, alto: 136 },
  cues: [
    'iron-hombro:ejercicios.press-militar-mancuerna.cues.antebrazos',
    'iron-hombro:ejercicios.press-militar-mancuerna.cues.abdomen',
    'iron-hombro:ejercicios.press-militar-mancuerna.cues.arriba',
  ],
  errores: [
    'iron-hombro:ejercicios.press-militar-mancuerna.errores.arco',
    'iron-hombro:ejercicios.press-militar-mancuerna.errores.corto',
  ],
};

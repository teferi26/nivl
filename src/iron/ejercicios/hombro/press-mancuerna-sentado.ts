// NIVL · IRON · Hombro · Press con mancuernas sentado en un banco plano (sin respaldo).
//
// Sentado y sin respaldo: el tronco no puede ayudar con impulso.
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
import { ANCLA_SENTADO_FRONTAL, BANCO_FRONTAL, conBrazos, ESCORZO_SENTADO_FRONTAL, PIERNAS_SENTADO_FRONTAL } from './comun';

const pose = (ms: number, abduccion: number, brazo: number): Pose => ({
  ms,
  cuello: 0,
  cerca: conBrazos(PIERNAS_SENTADO_FRONTAL, abduccion, 180 - abduccion),
  escorzo: { ...ESCORZO_SENTADO_FRONTAL, brazo_c: brazo, brazo_l: brazo },
});

const ABAJO = 78;
const MEDIO = 118;
const ARRIBA = 160;

export const pressMancuernaSentado: Ejercicio = {
  id: 'press-mancuerna-sentado',
  nombre: 'iron-hombro:ejercicios.press-mancuerna-sentado.nombre',
  grupo: 'hombro',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['mancuerna', 'banco'],
  musculos: {
    principales: ['deltoides_anterior'],
    secundarios: ['deltoides_lateral', 'triceps', 'trapecio'],
  },
  sustitutos: ['press-militar-mancuerna', 'press-militar-barra', 'press-arnold', 'press-banda'],
  vista: 'frontal',
  ancla: ANCLA_SENTADO_FRONTAL,
  poses: [
    pose(0, ABAJO, 0.84),
    pose(300, ABAJO, 0.84),
    pose(800, MEDIO, 0.95),
    pose(1300, ARRIBA, 1),
    pose(1600, ARRIBA, 1),
    pose(2400, MEDIO, 0.95),
  ],
  cicloMs: 3400,
  esfuerzo: [{ desde: 300, hasta: 1300 }],
  msFicha: 800,
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'punta', lados: ['cerca', 'lejos'] },
  escenario: [BANCO_FRONTAL],
  encuadre: { x: -54, y: -4, ancho: 108, alto: 124 },
  cues: [
    'iron-hombro:ejercicios.press-mancuerna-sentado.cues.antebrazos',
    'iron-hombro:ejercicios.press-mancuerna-sentado.cues.abdomen',
    'iron-hombro:ejercicios.press-mancuerna-sentado.cues.arriba',
  ],
  errores: [
    'iron-hombro:ejercicios.press-mancuerna-sentado.errores.arco',
    'iron-hombro:ejercicios.press-mancuerna-sentado.errores.corto',
  ],
};

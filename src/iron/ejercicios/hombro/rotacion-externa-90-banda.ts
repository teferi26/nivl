// NIVL · IRON · Hombro · Rotación externa a 90° con banda («90/90»), vista lateral.
//
// Brazos abiertos a la altura de los hombros y algo por delante (plano de la
// escápula): de perfil apuntan a la cámara y se ven cortos (escorzo 0,75).
// Los antebrazos giran de horizontales hacia delante a verticales, contra
// la banda anclada delante a la altura del pecho.
// Biomecánica (src/iron/__tests__/hombro.test.ts):
// · El codo no se mueve: brazo quieto (mismo ángulo y escorzo) todo el ciclo.
// · El antebrazo va de horizontal (±10°) a vertical (±10°), sin pasar de ahí.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';
import { ANCLA_PIE_LATERAL, conBrazos, PIERNAS_PIE_LATERAL } from './comun';

const BRAZO = 0.75;
const ABAJO: Extremidades = conBrazos(PIERNAS_PIE_LATERAL, 90, 2);
const MEDIO: Extremidades = conBrazos(PIERNAS_PIE_LATERAL, 90, 45);
const ARRIBA: Extremidades = conBrazos(PIERNAS_PIE_LATERAL, 90, 88);

const pose = (ms: number, cerca: Extremidades): Pose => ({ ms, cuello: 0, cerca, escorzo: { brazo_c: BRAZO, brazo_l: BRAZO } });

export const rotacionExterna90Banda: Ejercicio = {
  id: 'rotacion-externa-90-banda',
  nombre: 'iron-hombro:ejercicios.rotacion-externa-90-banda.nombre',
  grupo: 'hombro',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['banda'],
  musculos: {
    principales: ['manguito_rotador'],
    secundarios: ['deltoides_posterior', 'trapecio', 'espalda_alta'],
  },
  sustitutos: ['rotacion-externa-banda', 'face-pull-banda'],
  vista: 'lateral',
  ancla: ANCLA_PIE_LATERAL,
  poses: [pose(0, ABAJO), pose(300, ABAJO), pose(800, MEDIO), pose(1300, ARRIBA), pose(1600, ARRIBA), pose(2300, MEDIO)],
  cicloMs: 3200,
  esfuerzo: [{ desde: 300, hasta: 1300 }],
  msFicha: 1450,
  carga: { tipo: 'banda', en: 'agarre', lados: ['cerca', 'lejos'], anclaje: { x: 46, y: 78 } },
  encuadre: { x: -30, y: -4, ancho: 84, alto: 116 },
  cues: [
    'iron-hombro:ejercicios.rotacion-externa-90-banda.cues.codos',
    'iron-hombro:ejercicios.rotacion-externa-90-banda.cues.giro',
    'iron-hombro:ejercicios.rotacion-externa-90-banda.cues.ligera',
  ],
  errores: [
    'iron-hombro:ejercicios.rotacion-externa-90-banda.errores.codos',
    'iron-hombro:ejercicios.rotacion-externa-90-banda.errores.arco',
  ],
};

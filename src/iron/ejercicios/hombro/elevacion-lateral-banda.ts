// NIVL · IRON · Hombro · Elevación lateral con banda elástica, de pie.
//
// Cada extremo de la banda pisado bajo un pie: la tensión crece al subir,
// justo donde el deltoides lateral está más corto. Opción para casa.
//
// Vista FRONTAL: de perfil el brazo se movería hacia la cámara y no se vería.
// Biomecánica (src/iron/__tests__/hombro.test.ts):
// · Abducción de ~10° (mancuernas junto a los muslos) a ~85° (brazo a la
//   altura del hombro, no más arriba).
// · Codo casi estirado y fijo (≤ 15°): sube el codo, no la mano.
// · Tronco y piernas quietos (sin balanceo); bajada más lenta que la subida.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';
import { ANCLA_PIE_FRONTAL, conBrazos, PIERNAS_PIE_FRONTAL } from './comun';

const ABAJO: Extremidades = conBrazos(PIERNAS_PIE_FRONTAL, 10, 10);
const ARRIBA: Extremidades = conBrazos(PIERNAS_PIE_FRONTAL, 85, 6);

const pose = (ms: number, cerca: Extremidades): Pose => ({ ms, cuello: 0, cerca });

export const elevacionLateralBanda: Ejercicio = {
  id: 'elevacion-lateral-banda',
  nombre: 'iron-hombro:ejercicios.elevacion-lateral-banda.nombre',
  grupo: 'hombro',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['banda'],
  musculos: {
    principales: ['deltoides_lateral'],
    secundarios: ['deltoides_anterior', 'trapecio', 'manguito_rotador'],
  },
  sustitutos: ['elevaciones-laterales', 'elevaciones-laterales-sentado'],
  vista: 'frontal',
  ancla: ANCLA_PIE_FRONTAL,
  poses: [pose(0, ABAJO), pose(300, ABAJO), pose(1300, ARRIBA), pose(1600, ARRIBA)],
  cicloMs: 3800,
  esfuerzo: [{ desde: 300, hasta: 1300 }],
  msFicha: 1450,
  carga: { tipo: 'banda', en: 'agarre', lados: ['cerca', 'lejos'], anclaje: 'pies' },
  encuadre: { x: -62, y: -4, ancho: 124, alto: 112 },
  cues: [
    'iron-hombro:ejercicios.elevacion-lateral-banda.cues.codo',
    'iron-hombro:ejercicios.elevacion-lateral-banda.cues.altura',
    'iron-hombro:ejercicios.elevacion-lateral-banda.cues.banda',
  ],
  errores: [
    'iron-hombro:ejercicios.elevacion-lateral-banda.errores.soltar',
    'iron-hombro:ejercicios.elevacion-lateral-banda.errores.trapecio',
  ],
};

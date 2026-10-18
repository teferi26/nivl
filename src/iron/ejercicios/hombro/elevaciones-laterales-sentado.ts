// NIVL · IRON · Hombro · Elevaciones laterales con mancuernas, sentado en un banco plano.
//
// Sentado se anula el impulso de piernas y cadera: más estricto.
//
// Vista FRONTAL: de perfil el brazo se movería hacia la cámara y no se vería.
// Biomecánica (src/iron/__tests__/hombro.test.ts):
// · Abducción de ~10° (mancuernas junto a los muslos) a ~85° (brazo a la
//   altura del hombro, no más arriba).
// · Codo casi estirado y fijo (≤ 15°): sube el codo, no la mano.
// · Tronco y piernas quietos (sin balanceo); bajada más lenta que la subida.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';
import { ANCLA_SENTADO_FRONTAL, BANCO_FRONTAL, conBrazos, ESCORZO_SENTADO_FRONTAL, PIERNAS_SENTADO_FRONTAL } from './comun';

const ABAJO: Extremidades = conBrazos(PIERNAS_SENTADO_FRONTAL, 12, 10);
const ARRIBA: Extremidades = conBrazos(PIERNAS_SENTADO_FRONTAL, 85, 6);

const pose = (ms: number, cerca: Extremidades): Pose => ({ ms, cuello: 0, cerca, escorzo: ESCORZO_SENTADO_FRONTAL });

export const elevacionesLateralesSentado: Ejercicio = {
  id: 'elevaciones-laterales-sentado',
  nombre: 'iron-hombro:ejercicios.elevaciones-laterales-sentado.nombre',
  grupo: 'hombro',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['mancuerna', 'banco'],
  musculos: {
    principales: ['deltoides_lateral'],
    secundarios: ['deltoides_anterior', 'trapecio', 'manguito_rotador'],
  },
  sustitutos: ['elevaciones-laterales', 'elevacion-lateral-banda'],
  vista: 'frontal',
  ancla: ANCLA_SENTADO_FRONTAL,
  poses: [pose(0, ABAJO), pose(300, ABAJO), pose(1300, ARRIBA), pose(1600, ARRIBA)],
  cicloMs: 3800,
  esfuerzo: [{ desde: 300, hasta: 1300 }],
  msFicha: 1450,
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'lado', lados: ['cerca', 'lejos'] },
  escenario: [BANCO_FRONTAL],
  encuadre: { x: -62, y: -4, ancho: 124, alto: 100 },
  cues: [
    'iron-hombro:ejercicios.elevaciones-laterales-sentado.cues.codo',
    'iron-hombro:ejercicios.elevaciones-laterales-sentado.cues.altura',
    'iron-hombro:ejercicios.elevaciones-laterales-sentado.cues.peso',
  ],
  errores: [
    'iron-hombro:ejercicios.elevaciones-laterales-sentado.errores.alto',
    'iron-hombro:ejercicios.elevaciones-laterales-sentado.errores.trapecio',
  ],
};

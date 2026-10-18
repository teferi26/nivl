// NIVL · IRON · Subida al cajón (step-up) con elevación de rodilla, vista lateral. En casa.
//
// El pie cercano va entero sobre el cajón; se sube empujando con esa pierna
// (no impulsándose con la de atrás) hasta quedar de pie, con la rodilla
// lejana arriba, y se baja controlando hasta apoyar la punta detrás.
// Biomecánica (comprobada en src/iron/__tests__/pierna.test.ts):
// · El pie de apoyo va plano sobre el cajón y no se mueve (es el ancla).
// · Arriba, la pierna de apoyo estirada (rodilla ≤ 8°) y el tronco vertical;
//   la rodilla lejana sube por encima de la cadera menos 6.
// · El pie lejano no atraviesa el suelo ni el cajón.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const ABAJO: Extremidades = { cadera: 100, rodilla: 115.9, tobillo: 28, hombro: 12, codo: 0 };
const MEDIO: Extremidades = { cadera: 64.5, rodilla: 89.8, tobillo: 33.3, hombro: 8, codo: 0 };
const ARRIBA: Extremidades = { cadera: 2, rodilla: 4, tobillo: 4, hombro: 2, codo: 0 };

const ABAJO_L: Extremidades = { cadera: -0.7, rodilla: 42.9, tobillo: 15.7, hombro: 12, codo: 0 };
const MEDIO_L: Extremidades = { cadera: -16, rodilla: 50, tobillo: 0, hombro: 8, codo: 0 };
const PASA_L: Extremidades = { cadera: 45, rodilla: 115, tobillo: 0, hombro: 4, codo: 0 };
const ARRIBA_L: Extremidades = { cadera: 92, rodilla: 92, tobillo: 0, hombro: 2, codo: 0 };
const PASA: Extremidades = { cadera: 30, rodilla: 40, tobillo: 18, hombro: 4, codo: 0 };

const pose = (ms: number, cerca: Extremidades, lejos: Extremidades, cuello: number): Pose => ({ ms, cerca, lejos, cuello });

export const stepUpCajon: Ejercicio = {
  id: 'step-up-cajon',
  nombre: 'iron-pierna:ejercicios.step-up-cajon.nombre',
  grupo: 'pierna',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['cajon'],
  musculos: {
    principales: ['cuadriceps', 'gluteo'],
    secundarios: ['gluteo_medio', 'psoas', 'gemelos'],
  },
  sustitutos: ['sentadilla-bulgara', 'zancada-atras-mancuerna', 'zancada-estatica'],
  vista: 'lateral',
  ancla: { punto: 'tobillo_c', x: 0, y: 26, segmento: 'pie_c', angulo: 0 },
  poses: [
    pose(0, ABAJO, ABAJO_L, -4),
    pose(300, ABAJO, ABAJO_L, -4),
    pose(900, MEDIO, MEDIO_L, -2),
    pose(1150, PASA, PASA_L, -1),
    pose(1400, ARRIBA, ARRIBA_L, 0),
    pose(1800, ARRIBA, ARRIBA_L, 0),
    pose(2100, PASA, PASA_L, -1),
    pose(2450, MEDIO, MEDIO_L, -2),
  ],
  cicloMs: 3200,
  esfuerzo: [{ desde: 300, hasta: 1400 }],
  msFicha: 1600,
  escenario: [{ tipo: 'cajon', x: -9, ancho: 28, alto: 22, capa: 'medio' }],
  encuadre: { x: -52, y: -4, ancho: 100, alto: 132 },
  cues: [
    'iron-pierna:ejercicios.step-up-cajon.cues.pie',
    'iron-pierna:ejercicios.step-up-cajon.cues.empuje',
    'iron-pierna:ejercicios.step-up-cajon.cues.bajada',
  ],
  errores: [
    'iron-pierna:ejercicios.step-up-cajon.errores.impulso',
    'iron-pierna:ejercicios.step-up-cajon.errores.rodilla',
  ],
};

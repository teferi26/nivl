// NIVL · IRON · Extensión de cuádriceps en máquina, vista lateral.
//
// Sentado con la espalda en el respaldo y la rodilla alineada con el eje de
// la máquina; el rodillo apoya delante del tobillo. Se estira la rodilla
// hasta casi bloquear y se baja controlando.
// Biomecánica (comprobada en src/iron/__tests__/pierna.test.ts):
// · Muslo quieto en el asiento: la rodilla coincide con el eje de la palanca (±0,5).
// · Recorrido de unos 95° a casi estirada (rodilla ≤ 8° arriba).
// · El rodillo sigue apoyado en la pierna (va con la espinilla).

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const BASE = { cadera: 80, tobillo: 0, hombro: -2.6, codo: 14.2 } as const;

const ABAJO: Extremidades = { ...BASE, rodilla: 95 };
const MEDIO: Extremidades = { ...BASE, rodilla: 50 };
const ARRIBA: Extremidades = { ...BASE, rodilla: 6 };

const pose = (ms: number, cerca: Extremidades): Pose => ({ ms, cerca, cuello: 0 });

export const extensionCuadriceps: Ejercicio = {
  id: 'extension-cuadriceps',
  nombre: 'iron-pierna:ejercicios.extension-cuadriceps.nombre',
  grupo: 'pierna',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['maquina'],
  musculos: {
    principales: ['cuadriceps'],
    secundarios: ['tibial'],
  },
  sustitutos: ['sentadilla-bulgara', 'prensa', 'sentadilla-goblet'],
  vista: 'lateral',
  ancla: { punto: 'cadera', x: 0, y: 44, segmento: 'tronco', angulo: 100 },
  poses: [pose(0, ABAJO), pose(300, ABAJO), pose(800, MEDIO), pose(1300, ARRIBA), pose(1700, ARRIBA), pose(2600, MEDIO)],
  cicloMs: 3500,
  esfuerzo: [{ desde: 300, hasta: 1300 }],
  msFicha: 1500,
  carga: { tipo: 'palanca', eje: { x: 24.5, y: 44 }, cara: 'ant' },
  escenario: [{ tipo: 'extension', x: -4, ancho: 27, alto: 37, capa: 'fondo' }],
  encuadre: { x: -34, y: -4, ancho: 92, alto: 100 },
  cues: [
    'iron-pierna:ejercicios.extension-cuadriceps.cues.eje',
    'iron-pierna:ejercicios.extension-cuadriceps.cues.arriba',
    'iron-pierna:ejercicios.extension-cuadriceps.cues.bajada',
  ],
  errores: [
    'iron-pierna:ejercicios.extension-cuadriceps.errores.impulso',
    'iron-pierna:ejercicios.extension-cuadriceps.errores.cadera',
  ],
};

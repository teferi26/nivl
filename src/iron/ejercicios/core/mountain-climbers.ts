// NIVL · IRON · Mountain climbers (escaladores), vista lateral.
//
// Desde la plancha alta, las rodillas van al pecho por turnos, con ritmo.
// Biomecánica (comprobada en src/iron/__tests__/core.test.ts):
// · Manos quietas bajo los hombros y tronco quieto (ancla en la mano).
// · La rodilla que sube pasa por debajo del pecho, por delante de la cadera.
// · La pierna de atrás apoya en la punta del pie, estirada.
// · El pie que va y viene no atraviesa el suelo (pose intermedia con la
//   rodilla doblada para que el pie pase por encima).

import type { Ejercicio, Extremidades, Pose } from '../../tipos';
import { PLANCHA_ALTA } from './plancha-alta';

const BRAZOS = { hombro: PLANCHA_ALTA.hombro, codo: 0 } as const;
const ATRAS: Extremidades = PLANCHA_ALTA;
/** Rodilla al pecho. */
const DELANTE: Extremidades = { ...BRAZOS, cadera: 125, rodilla: 135, tobillo: -45 };
/** La pierna que vuelve atrás, con la rodilla doblada (el pie por encima del suelo). */
const VUELVE: Extremidades = { ...BRAZOS, cadera: 45, rodilla: 100, tobillo: -30 };
/** La pierna que viene, rodilla doblada. */
const VIENE: Extremidades = { ...BRAZOS, cadera: 95, rodilla: 130, tobillo: -40 };

const pose = (ms: number, cerca: Extremidades, lejos: Extremidades): Pose => ({ ms, cuello: 0, cerca, lejos });

export const mountainClimbers: Ejercicio = {
  id: 'mountain-climbers',
  nombre: 'iron-core:ejercicios.mountain-climbers.nombre',
  grupo: 'core',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['esterilla'],
  musculos: {
    principales: ['abdomen'],
    secundarios: ['cuadriceps', 'serrato', 'deltoides_anterior', 'transverso', 'gluteo'],
  },
  sustitutos: ['plancha-alta', 'toques-hombro', 'rodillas-arriba'],
  vista: 'lateral',
  ancla: { punto: 'agarre_c', x: 0, y: 3.2, segmento: 'brazo_c', angulo: -90 },
  poses: [
    pose(0, DELANTE, ATRAS),
    pose(400, VUELVE, VIENE),
    pose(800, ATRAS, DELANTE),
    pose(1200, VIENE, VUELVE),
  ],
  cicloMs: 1600,
  esfuerzo: [
    { desde: 400, hasta: 800 },
    { desde: 1200, hasta: 1600 },
  ],
  msFicha: 0,
  escenario: [{ tipo: 'esterilla', x: -96, ancho: 112, alto: 0.8, capa: 'fondo' }],
  encuadre: { x: -100, y: -4, ancho: 124, alto: 60 },
  cues: [
    'iron-core:ejercicios.mountain-climbers.cues.manos',
    'iron-core:ejercicios.mountain-climbers.cues.cadera',
    'iron-core:ejercicios.mountain-climbers.cues.rodilla',
  ],
  errores: [
    'iron-core:ejercicios.mountain-climbers.errores.caderaAlta',
    'iron-core:ejercicios.mountain-climbers.errores.manos',
  ],
};

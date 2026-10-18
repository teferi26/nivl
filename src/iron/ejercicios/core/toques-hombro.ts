// NIVL · IRON · Toques de hombro en plancha alta, vista lateral.
//
// Desde la plancha alta, una mano sube a tocar el hombro contrario y vuelve;
// luego la otra. La cadera no se balancea.
// Biomecánica (comprobada en src/iron/__tests__/core.test.ts):
// · Tronco quieto: el ancla es el hombro y el ángulo del tronco no cambia.
// · Siempre hay una mano en el suelo, bajo el hombro.
// · La mano que toca llega al pecho, a la altura del hombro (el brazo cruza
//   el cuerpo: sale del plano y se dibuja en escorzo).

import type { Ejercicio, Extremidades, Pose, SegmentoId } from '../../tipos';
import { PLANCHA_ALTA } from './plancha-alta';

const TOQUE: Extremidades = { ...PLANCHA_ALTA, hombro: 50.8, codo: 126.2 };
const CRUZA = 0.6;

const pose = (ms: number, cerca: Extremidades, lejos: Extremidades): Pose => {
  const escorzo: Partial<Record<SegmentoId, number>> = {
    brazo_c: cerca === TOQUE ? CRUZA : 1,
    antebrazo_c: cerca === TOQUE ? CRUZA : 1,
    brazo_l: lejos === TOQUE ? CRUZA : 1,
    antebrazo_l: lejos === TOQUE ? CRUZA : 1,
  };
  return { ms, cuello: 0, cerca, lejos, escorzo };
};

export const toquesHombro: Ejercicio = {
  id: 'toques-hombro',
  nombre: 'iron-core:ejercicios.toques-hombro.nombre',
  grupo: 'core',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['esterilla'],
  musculos: {
    principales: ['oblicuos', 'abdomen'],
    secundarios: ['transverso', 'serrato', 'deltoides_anterior', 'triceps'],
  },
  sustitutos: ['plancha-alta', 'bird-dog', 'plancha-lateral'],
  vista: 'lateral',
  // El hombro: queda quieto aunque cambie la mano de apoyo.
  ancla: { punto: 'hombro', x: 0, y: 40.2, segmento: 'tronco', angulo: 20.3 },
  poses: [
    pose(0, PLANCHA_ALTA, PLANCHA_ALTA),
    pose(200, PLANCHA_ALTA, PLANCHA_ALTA),
    pose(700, TOQUE, PLANCHA_ALTA),
    pose(900, TOQUE, PLANCHA_ALTA),
    pose(1400, PLANCHA_ALTA, PLANCHA_ALTA),
    pose(1600, PLANCHA_ALTA, PLANCHA_ALTA),
    pose(2100, PLANCHA_ALTA, TOQUE),
    pose(2300, PLANCHA_ALTA, TOQUE),
  ],
  cicloMs: 2800,
  esfuerzo: [
    { desde: 200, hasta: 900 },
    { desde: 1600, hasta: 2300 },
  ],
  msFicha: 800,
  escenario: [{ tipo: 'esterilla', x: -96, ancho: 112, alto: 0.8, capa: 'fondo' }],
  encuadre: { x: -100, y: -4, ancho: 124, alto: 60 },
  cues: [
    'iron-core:ejercicios.toques-hombro.cues.pies',
    'iron-core:ejercicios.toques-hombro.cues.cadera',
    'iron-core:ejercicios.toques-hombro.cues.lento',
  ],
  errores: [
    'iron-core:ejercicios.toques-hombro.errores.balanceo',
    'iron-core:ejercicios.toques-hombro.errores.caderaAlta',
  ],
};

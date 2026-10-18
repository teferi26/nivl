// NIVL · IRON · Sentadilla al cajón, vista lateral. En casa vale una silla firme.
//
// Se baja sentándose atrás hasta tocar el cajón, con una pausa breve sin
// soltar la tensión, y se sube empujando el suelo. Enseña a llevar la cadera
// atrás y da una profundidad fija.
// Biomecánica (comprobada en src/iron/__tests__/pierna.test.ts):
// · Pies planos; abajo los glúteos tocan el cajón (sin dejarse caer).
// · Espinillas más verticales que en la sentadilla libre.
// · Los hombros quedan sobre el pie como contrapeso de la cadera.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const ARRIBA: Extremidades = { cadera: -1.3, rodilla: 3.2, tobillo: 6.5, hombro: 92, codo: 0 };
const MEDIO: Extremidades = { cadera: 77.7, rodilla: 80, tobillo: 30.3, hombro: 118, codo: 0 };
const ABAJO: Extremidades = { cadera: 121.3, rodilla: 101.3, tobillo: 25, hombro: 135, codo: 0 };

const pose = (ms: number, cerca: Extremidades, cuello: number): Pose => ({ ms, cerca, cuello });

export const sentadillaCajon: Ejercicio = {
  id: 'sentadilla-cajon',
  nombre: 'iron-pierna:ejercicios.sentadilla-cajon.nombre',
  grupo: 'pierna',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['cajon'],
  musculos: {
    principales: ['gluteo', 'cuadriceps'],
    secundarios: ['isquiotibiales', 'aductores', 'lumbares'],
  },
  sustitutos: ['sentadilla-peso-corporal', 'sentadilla-goblet'],
  vista: 'lateral',
  ancla: { punto: 'tobillo_c', x: 0, y: 4, segmento: 'pie_c', angulo: 0 },
  poses: [
    pose(0, ARRIBA, 0),
    pose(500, ARRIBA, 0),
    pose(1400, MEDIO, -8),
    pose(2300, ABAJO, -14),
    pose(2800, ABAJO, -14),
    pose(3500, MEDIO, -8),
  ],
  cicloMs: 4400,
  esfuerzo: [{ desde: 2800, hasta: 4400 }],
  escenario: [{ tipo: 'cajon', x: -30, ancho: 20, alto: 24.5, capa: 'medio' }],
  encuadre: { x: -48, y: -4, ancho: 96, alto: 112 },
  cues: [
    'iron-pierna:ejercicios.sentadilla-cajon.cues.atras',
    'iron-pierna:ejercicios.sentadilla-cajon.cues.tocar',
    'iron-pierna:ejercicios.sentadilla-cajon.cues.subir',
  ],
  errores: [
    'iron-pierna:ejercicios.sentadilla-cajon.errores.caer',
    'iron-pierna:ejercicios.sentadilla-cajon.errores.balanceo',
    'iron-pierna:ejercicios.sentadilla-cajon.errores.rodillas',
  ],
};

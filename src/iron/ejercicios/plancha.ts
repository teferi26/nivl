// NIVL · IRON · Plancha sobre antebrazos, vista lateral.
//
// Isométrico: se aguanta la postura y la animación late en el músculo.
// Biomecánica (comprobada en src/iron/__tests__/biomecanica.test.ts):
// · Codos bajo los hombros (brazo vertical).
// · Hombro, cadera y tobillo en línea recta (ni cadera caída ni en pico).
// · Apoyo en antebrazos y puntas de los pies; cabeza neutra, mirada al suelo.

import type { Ejercicio, Extremidades, Pose } from '../tipos';

const POSTURA: Extremidades = { cadera: 0, rodilla: 0, tobillo: -20, hombro: 82, codo: 88 };

const pose = (ms: number): Pose => ({ ms, cuello: 0, cerca: POSTURA });

export const plancha: Ejercicio = {
  id: 'plancha',
  nombre: 'iron:ejercicios.plancha.nombre',
  grupo: 'core',
  nivel: 'principiante',
  tipo: 'isometrico',
  material: ['peso_corporal'],
  musculos: {
    principales: ['abdomen'],
    secundarios: ['oblicuos', 'gluteo', 'cuadriceps', 'deltoides_anterior'],
  },
  sustitutos: [],
  vista: 'lateral',
  ancla: { punto: 'codo_c', x: 0, y: 3.4, segmento: 'brazo_c', angulo: -90 },
  poses: [pose(0), pose(2000)],
  cicloMs: 4000,
  esfuerzo: [{ desde: 0, hasta: 4000 }],
  encuadre: { x: -96, y: -6, ancho: 124, alto: 52 },
  cues: [
    'iron:ejercicios.plancha.cues.codos',
    'iron:ejercicios.plancha.cues.linea',
    'iron:ejercicios.plancha.cues.abdomen',
  ],
  errores: [
    'iron:ejercicios.plancha.errores.caderaCaida',
    'iron:ejercicios.plancha.errores.caderaAlta',
    'iron:ejercicios.plancha.errores.apnea',
  ],
};

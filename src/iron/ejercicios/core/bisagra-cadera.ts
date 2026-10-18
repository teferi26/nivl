// NIVL · IRON · Bisagra de cadera sin peso (buenos días), vista lateral.
//
// De pie, brazos cruzados sobre el pecho y rodillas sueltas. Se lleva la
// cadera atrás inclinando el tronco recto hasta notar los isquiotibiales y
// se vuelve empujando la cadera adelante.
// Biomecánica (comprobada en src/iron/__tests__/core.test.ts):
// · Pies planos y quietos (ancla en el tobillo).
// · Abajo el tronco queda entre 30 y 50° sobre la horizontal y la cadera,
//   por detrás del tobillo: se mueve la cadera, no la espalda.
// · Rodillas poco dobladas (≤ 20°): no es una sentadilla.

import type { Ejercicio, Pose } from '../../tipos';

const BRAZOS = { hombro: 25, codo: 145 } as const;
const ARRIBA: Omit<Pose, 'ms'> = { angulo: 0, cuello: 0, cerca: { cadera: 6.2, rodilla: 10.1, tobillo: 3.9, ...BRAZOS } };
const ABAJO: Omit<Pose, 'ms'> = { angulo: 0, cuello: 5, cerca: { cadera: 71.8, rodilla: 13.5, tobillo: -6.3, ...BRAZOS } };
const en = (ms: number, p: Omit<Pose, 'ms'>): Pose => ({ ...p, ms });

export const bisagraCadera: Ejercicio = {
  id: 'bisagra-cadera',
  nombre: 'iron-core:ejercicios.bisagra-cadera.nombre',
  grupo: 'movilidad',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['peso_corporal'],
  musculos: {
    principales: ['isquiotibiales'],
    secundarios: ['gluteo', 'lumbares', 'transverso'],
  },
  sustitutos: ['perro-boca-abajo', 'balanceo-pierna', 'flexor-cadera'],
  vista: 'lateral',
  ancla: { punto: 'tobillo_c', x: 0, y: 4, segmento: 'pie_c', angulo: 0 },
  poses: [en(0, ARRIBA), en(300, ARRIBA), en(1500, ABAJO), en(1900, ABAJO)],
  cicloMs: 3200,
  esfuerzo: [{ desde: 1900, hasta: 3200 }],
  msFicha: 1700,
  encuadre: { x: -44, y: -4, ancho: 92, alto: 108 },
  cues: [
    'iron-core:ejercicios.bisagra-cadera.cues.cadera',
    'iron-core:ejercicios.bisagra-cadera.cues.espalda',
    'iron-core:ejercicios.bisagra-cadera.cues.rodillas',
  ],
  errores: [
    'iron-core:ejercicios.bisagra-cadera.errores.redondear',
    'iron-core:ejercicios.bisagra-cadera.errores.sentadilla',
  ],
};

// NIVL · IRON · Estiramiento de flexores de cadera en media rodilla, vista lateral.
//
// La rodilla de cerca (la que estira) en la esterilla y el pie de lejos
// delante. Se empuja la pelvis hacia delante con el glúteo apretado y el
// tronco recto, subiendo los brazos para estirar más; se vuelve despacio.
// Biomecánica (comprobada en src/iron/__tests__/core.test.ts):
// · El pie de delante no se mueve (ancla en su tobillo) y la rodilla de
//   atrás sigue en la esterilla.
// · La cadera de atrás pasa a extensión (≤ -20°) sin pasar de -30°: se
//   avanza la pelvis, no se arquea la zona lumbar (tronco vertical ±5°).
// El psoas aún no está en el mapa muscular (ronda 2): hoy se marca el
// cuádriceps, cuyo recto femoral también se estira.

import type { Ejercicio, Pose } from '../../tipos';

const ATRAS: Omit<Pose, 'ms'> = {
  angulo: 0,
  cuello: 0,
  cerca: { cadera: -14.2, rodilla: 93.8, tobillo: 18, hombro: 20, codo: 100 },
  lejos: { cadera: 91.6, rodilla: 88.1, tobillo: -3.5, hombro: 20, codo: 100 },
};
const DELANTE: Omit<Pose, 'ms'> = {
  angulo: 0,
  cuello: 0,
  cerca: { cadera: -28.7, rodilla: 81.3, tobillo: 18, hombro: 140, codo: 5 },
  lejos: { cadera: 93.6, rodilla: 103.5, tobillo: 7.9, hombro: 140, codo: 5 },
};
const en = (ms: number, p: Omit<Pose, 'ms'>): Pose => ({ ...p, ms });

export const flexorCadera: Ejercicio = {
  id: 'flexor-cadera',
  nombre: 'iron-core:ejercicios.flexor-cadera.nombre',
  grupo: 'movilidad',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['esterilla'],
  musculos: {
    principales: ['cuadriceps'],
    secundarios: ['gluteo', 'abdomen', 'dorsal'],
  },
  sustitutos: ['movilidad-tobillo', 'balanceo-pierna', 'bisagra-cadera'],
  vista: 'lateral',
  // El tobillo del pie de delante (el lejano), plano en la esterilla.
  ancla: { punto: 'tobillo_l', x: 26, y: 4.8, segmento: 'pie_l', angulo: 0 },
  poses: [en(0, ATRAS), en(400, ATRAS), en(1600, DELANTE), en(2600, DELANTE)],
  cicloMs: 3800,
  esfuerzo: [{ desde: 400, hasta: 2600 }],
  msFicha: 2000,
  escenario: [{ tipo: 'esterilla', x: -36, ancho: 84, alto: 0.8, capa: 'fondo' }],
  encuadre: { x: -40, y: -4, ancho: 92, alto: 104 },
  cues: [
    'iron-core:ejercicios.flexor-cadera.cues.gluteo',
    'iron-core:ejercicios.flexor-cadera.cues.tronco',
    'iron-core:ejercicios.flexor-cadera.cues.respira',
  ],
  errores: [
    'iron-core:ejercicios.flexor-cadera.errores.lumbar',
    'iron-core:ejercicios.flexor-cadera.errores.rodilla',
  ],
};

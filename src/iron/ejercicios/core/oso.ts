// NIVL · IRON · Paso del oso (bear crawl), vista lateral.
//
// A cuatro apoyos con las rodillas a un par de dedos del suelo, la espalda
// plana y la cadera a la altura de los hombros. Se avanzan dos pasos con
// mano y pie contrarios a la vez y se vuelve atrás igual (cabe en casa).
// Biomecánica (comprobada en src/iron/__tests__/core.test.ts):
// · Las rodillas no tocan el suelo (siempre por encima) y quedan bajo la cadera.
// · Siempre mano y pie contrarios: si se levanta la mano de cerca, se
//   levanta el pie de lejos; los otros dos apoyan.
// · El tronco no cambia de inclinación (8°) ni de altura: la cadera no sube.
// El ancla es la cadera y avanza (`punto`); cada pose está despejada por IK
// con manos y puntas de los pies en su sitio.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

interface Paso {
  x: number;
  cerca: Extremidades;
  lejos: Extremidades;
}

const K0: Paso = {
  x: 0,
  cerca: { cadera: 82.6, rodilla: 103.8, tobillo: 25.1, hombro: 73.9, codo: 44.1 },
  lejos: { cadera: 82.6, rodilla: 103.8, tobillo: 25.1, hombro: 73.9, codo: 44.1 },
};
/** Mano de cerca y pie de lejos en el aire, a medio paso. */
const K1: Paso = {
  x: 3,
  cerca: { cadera: 75.7, rodilla: 96.5, tobillo: 24.8, hombro: 69.9, codo: 67.2 },
  lejos: { cadera: 85.6, rodilla: 119, tobillo: 37.4, hombro: 66.6, codo: 48.8 },
};
const K2: Paso = {
  x: 6,
  cerca: { cadera: 68.8, rodilla: 88.4, tobillo: 23.6, hombro: 93.4, codo: 23.7 },
  lejos: { cadera: 97.3, rodilla: 116.4, tobillo: 23.1, hombro: 60.3, codo: 51.3 },
};
/** Mano de lejos y pie de cerca en el aire. */
const K3: Paso = {
  x: 9,
  cerca: { cadera: 71.9, rodilla: 104.5, tobillo: 36.6, hombro: 82.5, codo: 36.5 },
  lejos: { cadera: 89.8, rodilla: 110.4, tobillo: 24.6, hombro: 54.5, codo: 76 },
};
const K4: Paso = { ...K0, x: 12 };
// La vuelta atrás: los mismos apoyos en espejo.
const K5: Paso = { x: 9, cerca: K3.lejos, lejos: K3.cerca };
const K6: Paso = { x: 6, cerca: K2.lejos, lejos: K2.cerca };
const K7: Paso = { x: 3, cerca: K1.lejos, lejos: K1.cerca };

const pose = (ms: number, p: Paso): Pose => ({ ms, punto: { x: p.x, y: 31.5 }, cuello: 5, cerca: p.cerca, lejos: p.lejos });

export const oso: Ejercicio = {
  id: 'oso',
  nombre: 'iron-core:ejercicios.oso.nombre',
  grupo: 'cardio',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['peso_corporal'],
  musculos: {
    principales: ['cuadriceps', 'deltoides_anterior'],
    secundarios: ['abdomen', 'transverso', 'serrato', 'triceps', 'gluteo'],
  },
  sustitutos: ['mountain-climbers', 'burpees', 'bird-dog'],
  vista: 'lateral',
  ancla: { punto: 'cadera', x: 0, y: 31.5, segmento: 'tronco', angulo: 8 },
  poses: [
    pose(0, K0),
    pose(450, K1),
    pose(900, K2),
    pose(1350, K3),
    pose(1800, K4),
    pose(2250, K5),
    pose(2700, K6),
    pose(3150, K7),
  ],
  cicloMs: 3600,
  esfuerzo: [
    { desde: 0, hasta: 900 },
    { desde: 1800, hasta: 2700 },
  ],
  msFicha: 0,
  encuadre: { x: -44, y: -4, ancho: 112, alto: 60 },
  cues: [
    'iron-core:ejercicios.oso.cues.rodillas',
    'iron-core:ejercicios.oso.cues.contrarios',
    'iron-core:ejercicios.oso.cues.espalda',
  ],
  errores: [
    'iron-core:ejercicios.oso.errores.cadera',
    'iron-core:ejercicios.oso.errores.mismoLado',
  ],
};

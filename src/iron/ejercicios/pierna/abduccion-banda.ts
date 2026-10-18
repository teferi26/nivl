// NIVL · IRON · Abducción de cadera de pie con banda en las rodillas, vista frontal.
//
// Ronda 2 (banda del equipo hombro). Una minibanda justo por encima de las
// rodillas. De pie sobre la pierna lejana, la cercana se abre hacia el lado
// recta, con la punta mirando al frente, y vuelve despacio contra la banda.
// La pelvis no se inclina ni el tronco se tuerce: el glúteo medio de la
// pierna que se abre hace el trabajo.
// Biomecánica (src/iron/__tests__/ronda2.test.ts): cadera y tronco quietos,
// pie de apoyo plano en el suelo, la pierna que trabaja se abre de ≤ 5° a
// 25 a 35° y no toca el suelo, la banda va de rodilla a rodilla.

import type { Ejercicio, Pose } from '../../tipos';
import { ANCLA_PIE_FRONTAL, PIERNAS_PIE_FRONTAL } from '../hombro/comun';

const BRAZOS = { hombro: 10, codo: 8 } as const;
const APOYO = { ...PIERNAS_PIE_FRONTAL, ...BRAZOS };
const pose = (ms: number, abduccion: number): Pose => ({
  ms,
  cuello: 0,
  // La pierna que se abre, recta y con el pie horizontal (tobillo = -cadera).
  cerca: { cadera: abduccion, rodilla: 0, tobillo: -abduccion, ...BRAZOS },
  lejos: APOYO,
});

export const abduccionBanda: Ejercicio = {
  id: 'abduccion-banda',
  nombre: 'iron-pierna:ejercicios.abduccion-banda.nombre',
  grupo: 'pierna',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['banda'],
  musculos: {
    principales: ['gluteo_medio'],
    secundarios: ['gluteo', 'oblicuos'],
  },
  sustitutos: ['abduccion-tumbado', 'abduccion-maquina'],
  vista: 'frontal',
  ancla: ANCLA_PIE_FRONTAL,
  poses: [pose(0, 4), pose(300, 4), pose(1000, 30), pose(1400, 30), pose(2300, 4)],
  cicloMs: 2800,
  esfuerzo: [{ desde: 300, hasta: 1000 }],
  msFicha: 1200,
  carga: { tipo: 'banda', en: 'rodilla', lados: ['cerca', 'lejos'], anclaje: 'manos' },
  encuadre: { x: -52, y: -4, ancho: 104, alto: 112 },
  cues: [
    'iron-pierna:ejercicios.abduccion-banda.cues.pelvis',
    'iron-pierna:ejercicios.abduccion-banda.cues.punta',
    'iron-pierna:ejercicios.abduccion-banda.cues.vuelta',
  ],
  errores: [
    'iron-pierna:ejercicios.abduccion-banda.errores.inclinar',
    'iron-pierna:ejercicios.abduccion-banda.errores.rotar',
  ],
};

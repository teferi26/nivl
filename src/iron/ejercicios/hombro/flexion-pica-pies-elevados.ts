// NIVL · IRON · Hombro · Flexión en pica con los pies en un banco, vista lateral.
//
// Más difícil que en el suelo: la cadera queda más alta y el empuje es más
// vertical, con más peso sobre los hombros. Paso previo al pino.
// Biomecánica (src/iron/__tests__/hombro.test.ts): manos quietas, pies en
// el banco, la cabeza baja por delante de las manos sin tocar el suelo.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';
import { cicloPica } from './flexion-pica';

type Paso = readonly [number, number, number, number, number, number, number];
const paso = (ms: number, [angulo, cuello, hombro, codo, cadera, rodilla, tobillo]: Paso): Pose => {
  const cerca: Extremidades = { hombro, codo, cadera, rodilla, tobillo };
  return { ms, cuello, cerca, angulo };
};

// De arriba abajo: [ángulo del antebrazo, cuello, hombro, codo, cadera, rodilla, tobillo].
// Manos en (0, 2,4); pies sobre el banco apoyados en la parte delantera (tobillo en -55, 37).
const BAJADA: readonly Paso[] = [
  [-101.9, 0, 111.9, 8.4, 80.6, 24.8, 16.4],
  [-78.2, -2, 96.6, 53.8, 84.4, 23.2, 17.3],
  [-64.3, -5, 94.7, 76.8, 88.8, 20.8, 17.8],
  [-58.5, -8, 94.2, 86.3, 90, 19.4, 18.4],
  [-52.6, -10, 94.8, 95, 91.2, 17.4, 18.7],
  [-45.5, -12, 98.2, 103.1, 92.7, 13.9, 18],
  [-36, -15, 105.6, 110.8, 94.7, 8.7, 16.5],
];

export const flexionPicaPiesElevados: Ejercicio = {
  id: 'flexion-pica-pies-elevados',
  nombre: 'iron-hombro:ejercicios.flexion-pica-pies-elevados.nombre',
  grupo: 'hombro',
  nivel: 'avanzado',
  tipo: 'dinamico',
  material: ['peso_corporal', 'banco'],
  musculos: {
    principales: ['deltoides_anterior'],
    secundarios: ['triceps', 'deltoides_lateral', 'trapecio', 'abdomen'],
  },
  sustitutos: ['flexion-pica', 'press-militar-mancuerna'],
  vista: 'lateral',
  ancla: { punto: 'agarre_c', x: 0, y: 2.4, segmento: 'antebrazo_c', angulo: BAJADA[0][0] },
  poses: cicloPica(BAJADA, paso),
  cicloMs: 3200,
  esfuerzo: [{ desde: 1900, hasta: 3200 }],
  msFicha: 1000,
  escenario: [{ tipo: 'banco', x: -76, ancho: 34, alto: 24.6, capa: 'fondo' }],
  encuadre: { x: -80, y: -4, ancho: 106, alto: 74 },
  cues: [
    'iron-hombro:ejercicios.flexion-pica-pies-elevados.cues.banco',
    'iron-hombro:ejercicios.flexion-pica-pies-elevados.cues.cabeza',
    'iron-hombro:ejercicios.flexion-pica-pies-elevados.cues.progresion',
  ],
  errores: [
    'iron-hombro:ejercicios.flexion-pica-pies-elevados.errores.cadera',
    'iron-hombro:ejercicios.flexion-pica-pies-elevados.errores.golpe',
  ],
};

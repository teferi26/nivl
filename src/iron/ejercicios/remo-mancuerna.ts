// NIVL · IRON · Remo a una mano con mancuerna, vista lateral.
//
// Rodilla y mano del lado lejano apoyadas en el banco; el pie cercano en el
// suelo, un poco atrás, con la rodilla suelta. Tronco casi paralelo al suelo
// (20°) y espalda neutra: no gira ni se arquea durante el tirón.
// Biomecánica (comprobada en src/iron/__tests__/biomecanica.test.ts):
// · El antebrazo cuelga vertical todo el recorrido (±15°): tira el codo.
// · El codo sube hacia la cadera y pasa la línea de la espalda arriba.
// · El tronco no se mueve (el ancla fija la cadera y el ángulo).

import type { Ejercicio, Extremidades, Pose } from '../tipos';

const APOYO: Extremidades = { cadera: 65, rodilla: 81, tobillo: -45, hombro: 62.3, codo: 24.3 };
const PIERNA = { cadera: 69, rodilla: 17, tobillo: 18 } as const;

const ABAJO: Extremidades = { ...PIERNA, hombro: 70, codo: 5 };
const MEDIO: Extremidades = { ...PIERNA, hombro: 22, codo: 52 };
const ARRIBA: Extremidades = { ...PIERNA, hombro: -35, codo: 105 };

const pose = (ms: number, cerca: Extremidades): Pose => ({ ms, cuello: 0, cerca, lejos: APOYO });

export const remoMancuerna: Ejercicio = {
  id: 'remo-mancuerna',
  nombre: 'iron:ejercicios.remo-mancuerna.nombre',
  grupo: 'espalda',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['mancuerna', 'banco'],
  musculos: {
    principales: ['dorsal'],
    secundarios: ['espalda_alta', 'trapecio', 'deltoides_posterior', 'biceps', 'antebrazo'],
  },
  sustitutos: [],
  vista: 'lateral',
  ancla: { punto: 'cadera', x: 0, y: 51.8, segmento: 'tronco', angulo: 20 },
  poses: [pose(0, ABAJO), pose(600, ABAJO), pose(1100, MEDIO), pose(1600, ARRIBA), pose(2000, ARRIBA), pose(2900, MEDIO)],
  cicloMs: 3700,
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'lado', lados: ['cerca'] },
  escenario: [{ tipo: 'banco', x: -27, ancho: 69, alto: 23.6, capa: 'fondo' }],
  encuadre: { x: -46, y: -4, ancho: 104, alto: 84 },
  cues: [
    'iron:ejercicios.remo-mancuerna.cues.apoyo',
    'iron:ejercicios.remo-mancuerna.cues.codo',
    'iron:ejercicios.remo-mancuerna.cues.tronco',
  ],
  errores: [
    'iron:ejercicios.remo-mancuerna.errores.giro',
    'iron:ejercicios.remo-mancuerna.errores.biceps',
    'iron:ejercicios.remo-mancuerna.errores.cuello',
  ],
};

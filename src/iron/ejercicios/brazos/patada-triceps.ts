// NIVL · IRON · Patada de tríceps con mancuerna, apoyado en el banco, vista lateral.
//
// La misma postura que el remo con mancuerna (rodilla y mano del otro lado en
// el banco, tronco casi paralelo al suelo). El brazo se queda pegado al
// costado con el codo un poco por encima de la espalda; solo se mueve el
// antebrazo: de colgar vertical a quedar en línea con el brazo.
// Biomecánica (comprobada en src/iron/__tests__/brazos.test.ts): el brazo no
// se mueve (±3°) y el codo queda por encima de la línea de la espalda; arriba
// el antebrazo en línea con el brazo; tronco quieto.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';
import { textos } from './comun';

// Apoyo y pierna como el remo con mancuerna (src/iron/ejercicios/remo-mancuerna.ts).
const APOYO: Extremidades = { cadera: 65, rodilla: 81, tobillo: -45, hombro: 62.3, codo: 24.3 };
const PIERNA = { cadera: 69, rodilla: 17, tobillo: 18 } as const;
// hombro -15: el brazo a 185° en el mundo (tronco a 20°), algo por encima de la espalda.
const ABAJO: Extremidades = { ...PIERNA, hombro: -15, codo: 85 };
const MEDIO: Extremidades = { ...PIERNA, hombro: -15, codo: 42 };
const ARRIBA: Extremidades = { ...PIERNA, hombro: -15, codo: 2 };

const pose = (ms: number, cerca: Extremidades): Pose => ({ ms, cuello: 0, cerca, lejos: APOYO });
const T = textos('patada-triceps', ['apoyo', 'codo', 'arriba'], ['balanceo', 'codoCae']);

export const patadaTriceps: Ejercicio = {
  id: 'patada-triceps',
  nombre: T.nombre,
  grupo: 'brazo',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['mancuerna', 'banco'],
  musculos: { principales: ['triceps'], secundarios: ['deltoides_posterior'] },
  sustitutos: ['patada-triceps-de-pie', 'extension-triceps-cabeza-mancuerna', 'press-frances-mancuerna'],
  vista: 'lateral',
  ancla: { punto: 'cadera', x: 0, y: 51.8, segmento: 'tronco', angulo: 20 },
  poses: [pose(0, ABAJO), pose(400, ABAJO), pose(900, MEDIO), pose(1400, ARRIBA), pose(1800, ARRIBA), pose(2600, MEDIO)],
  cicloMs: 3400,
  esfuerzo: [{ desde: 400, hasta: 1400 }],
  msFicha: 1600,
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'lado', lados: ['cerca'] },
  escenario: [{ tipo: 'banco', x: -27, ancho: 69, alto: 23.6, capa: 'fondo' }],
  encuadre: { x: -52, y: -4, ancho: 108, alto: 84 },
  cues: T.cues,
  errores: T.errores,
};

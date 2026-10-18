// NIVL · IRON · Flexiones diamante (manos juntas), vista lateral. En casa.
//
// Manos juntas bajo el pecho (pulgares e índices forman un diamante), codos
// pegados que van hacia atrás, cuerpo recto de los talones a la cabeza.
// Los ángulos están despejados para que las manos no se muevan del suelo y
// el cuerpo gire sobre las puntas de los pies (ver docs/iron/F2-brazos.md).
// Biomecánica (comprobada en src/iron/__tests__/brazos.test.ts): manos fijas
// en el suelo, cadera en la línea hombro y tobillo, abajo el pecho cerca del
// suelo.

import type { Ejercicio, Pose } from '../../tipos';
import { textos } from './comun';

interface Paso {
  angulo: number;
  hombro: number;
  codo: number;
}
const ARRIBA: Paso = { angulo: -55.2, hombro: 66.9, codo: 2 };
const P1: Paso = { angulo: -57.2, hombro: 47.7, codo: 40 };
const P2: Paso = { angulo: -62.8, hombro: 26.1, codo: 80 };
const P3: Paso = { angulo: -70.6, hombro: 1.9, codo: 115 };
const ABAJO: Paso = { angulo: -76.6, hombro: -21.9, codo: 135 };

const pose = (ms: number, p: Paso): Pose => ({
  ms,
  cuello: 0,
  angulo: p.angulo,
  cerca: { hombro: p.hombro, codo: p.codo, cadera: 0, rodilla: 0, tobillo: 15 },
});
const T = textos('flexiones-diamante', ['manos', 'cuerpo', 'codos'], ['cadera', 'codosAbiertos', 'medioRecorrido']);

export const flexionesDiamante: Ejercicio = {
  id: 'flexiones-diamante',
  nombre: T.nombre,
  grupo: 'brazo',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['peso_corporal'],
  musculos: { principales: ['triceps'], secundarios: ['pectoral', 'deltoides_anterior', 'abdomen'] },
  sustitutos: ['flexiones-diamante-rodillas', 'fondos-banco', 'press-cerrado-barra'],
  vista: 'lateral',
  // Las puntas de los pies en el suelo: el cuerpo gira sobre ellas.
  ancla: { punto: 'punta_c', x: 0, y: 2.6, segmento: 'pie_c', angulo: -55.2 },
  poses: [
    pose(0, ARRIBA),
    pose(300, ARRIBA),
    pose(700, P1),
    pose(1100, P2),
    pose(1500, P3),
    pose(1900, ABAJO),
    pose(2100, ABAJO),
    pose(2400, P3),
    pose(2700, P2),
    pose(3000, P1),
  ],
  cicloMs: 3400,
  esfuerzo: [{ desde: 2100, hasta: 3400 }],
  msFicha: 2700,
  encuadre: { x: -8, y: -4, ancho: 104, alto: 60 },
  cues: T.cues,
  errores: T.errores,
};

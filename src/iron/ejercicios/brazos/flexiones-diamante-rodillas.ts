// NIVL · IRON · Flexiones diamante de rodillas, vista lateral. En casa, para empezar.
//
// Igual que las flexiones diamante, con las rodillas en el suelo y los pies
// en el aire: el cuerpo va recto de las rodillas a la cabeza.
// Ángulos despejados para que las manos no se muevan del suelo y el cuerpo
// gire sobre las rodillas.
// Biomecánica (comprobada en src/iron/__tests__/brazos.test.ts): manos fijas
// en el suelo, cadera en la línea hombro y rodilla, codos pegados.

import type { Ejercicio, Pose } from '../../tipos';
import { textos } from './comun';

interface Paso {
  rodilla: number;
  hombro: number;
  codo: number;
}
const ARRIBA: Paso = { rodilla: 59.9, hombro: 55.6, codo: 2 };
const P1: Paso = { rodilla: 57.1, hombro: 37.1, codo: 40 };
const P2: Paso = { rodilla: 49.1, hombro: 17.6, codo: 80 };
const P3: Paso = { rodilla: 38.4, hombro: -2.6, codo: 115 };
const ABAJO: Paso = { rodilla: 30.8, hombro: -20.4, codo: 135 };

const pose = (ms: number, p: Paso): Pose => ({
  ms,
  cuello: 0,
  cerca: { hombro: p.hombro, codo: p.codo, cadera: 0, rodilla: p.rodilla, tobillo: -45 },
});
const T = textos('flexiones-diamante-rodillas', ['manos', 'cuerpo', 'codos'], ['cadera', 'codosAbiertos']);

export const flexionesDiamanteRodillas: Ejercicio = {
  id: 'flexiones-diamante-rodillas',
  nombre: T.nombre,
  grupo: 'brazo',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['peso_corporal'],
  musculos: { principales: ['triceps'], secundarios: ['pectoral', 'deltoides_anterior', 'abdomen'] },
  sustitutos: ['flexiones-diamante', 'fondos-banco'],
  vista: 'lateral',
  // La rodilla en el suelo y la pierna casi plana, con el pie en el aire.
  ancla: { punto: 'rodilla_c', x: 0, y: 4, segmento: 'pierna_c', angulo: 160 },
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
  encuadre: { x: -40, y: -4, ancho: 112, alto: 64 },
  cues: T.cues,
  errores: T.errores,
};

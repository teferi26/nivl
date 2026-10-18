// NIVL · IRON · Fondos en banco (de tríceps), rodillas dobladas, vista lateral.
//
// Manos en el borde del banco, detrás de la cadera, dedos hacia delante;
// talones en el suelo con las rodillas dobladas (la versión fácil). Se baja
// doblando los codos hasta que el brazo queda casi paralelo al suelo, con la
// espalda cerca del banco, y se sube estirándolos. Vale una silla firme.
// Los ángulos están despejados para que la mano no se mueva del borde, el
// talón no se mueva del suelo y la cadera no toque el banco (ver
// docs/iron/F2-brazos.md); la extensión del hombro no pasa de 60°.
// Biomecánica (comprobada en src/iron/__tests__/brazos.test.ts): mano fija en
// el borde, talón fijo en el suelo, cadera por delante del banco.

import type { Ejercicio, Pose } from '../../tipos';
import { textos } from './comun';

interface Paso {
  angulo: number;
  hombro: number;
  codo: number;
  cadera: number;
  rodilla: number;
  tobillo: number;
}
const ARRIBA: Paso = { angulo: -106, hombro: -32.7, codo: 4, cadera: 65.7, rodilla: 52.7, tobillo: 36.4 };
const MEDIO: Paso = { angulo: -98, hombro: -46.4, codo: 40, cadera: 89.6, rodilla: 57.1, tobillo: 31.1 };
const ABAJO: Paso = { angulo: -92, hombro: -59, codo: 65, cadera: 103.7, rodilla: 58.8, tobillo: 25.1 };

const pose = (ms: number, p: Paso): Pose => ({
  ms,
  cuello: 0,
  angulo: p.angulo,
  cerca: { hombro: p.hombro, codo: p.codo, cadera: p.cadera, rodilla: p.rodilla, tobillo: p.tobillo },
});
const T = textos('fondos-banco', ['manos', 'espalda', 'profundidad'], ['hombros', 'lejos']);

export const fondosBanco: Ejercicio = {
  id: 'fondos-banco',
  nombre: T.nombre,
  grupo: 'brazo',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['banco', 'peso_corporal'],
  musculos: { principales: ['triceps'], secundarios: ['deltoides_anterior', 'pectoral'] },
  sustitutos: ['fondos-banco-pies-elevados', 'flexiones-diamante', 'press-cerrado-barra'],
  vista: 'lateral',
  // El puño en el borde del banco; el antebrazo casi vertical.
  ancla: { punto: 'agarre_c', x: -10, y: 27, segmento: 'antebrazo_c', angulo: -106 },
  poses: [pose(0, ARRIBA), pose(300, ARRIBA), pose(1100, MEDIO), pose(1900, ABAJO), pose(2150, ABAJO), pose(2800, MEDIO)],
  cicloMs: 3500,
  esfuerzo: [{ desde: 2150, hasta: 3500 }],
  msFicha: 2800,
  escenario: [{ tipo: 'banco', x: -60, ancho: 51.5, alto: 24.6, capa: 'fondo' }],
  encuadre: { x: -44, y: -4, ancho: 100, alto: 84 },
  cues: T.cues,
  errores: T.errores,
};

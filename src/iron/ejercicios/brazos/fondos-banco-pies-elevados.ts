// NIVL · IRON · Fondos entre dos bancos (pies elevados), vista lateral.
//
// La versión difícil de los fondos en banco: los talones sobre otro banco
// delante, a la altura de las manos, así se levanta más peso del cuerpo.
// Mismo gesto: bajar doblando los codos con la espalda cerca del banco y
// subir estirándolos. Ángulos despejados como en `fondos-banco`.
// Biomecánica (comprobada en src/iron/__tests__/brazos.test.ts): mano fija en
// el borde, talón fijo en el otro banco, cadera por delante del banco.

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
const ARRIBA: Paso = { angulo: -106, hombro: -30.7, codo: 4, cadera: 110.5, rodilla: 67.2, tobillo: 16 };
const MEDIO: Paso = { angulo: -98, hombro: -43.2, codo: 36, cadera: 123, rodilla: 58.1, tobillo: 5.9 };
const ABAJO: Paso = { angulo: -92, hombro: -59.8, codo: 66, cadera: 132, rodilla: 46.4, tobillo: -7.4 };

const pose = (ms: number, p: Paso): Pose => ({
  ms,
  cuello: 0,
  angulo: p.angulo,
  cerca: { hombro: p.hombro, codo: p.codo, cadera: p.cadera, rodilla: p.rodilla, tobillo: p.tobillo },
});
const T = textos('fondos-banco-pies-elevados', ['manos', 'espalda', 'profundidad'], ['hombros', 'rebote']);

export const fondosBancoPiesElevados: Ejercicio = {
  id: 'fondos-banco-pies-elevados',
  nombre: T.nombre,
  grupo: 'brazo',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['banco', 'peso_corporal'],
  musculos: { principales: ['triceps'], secundarios: ['deltoides_anterior', 'pectoral'] },
  sustitutos: ['fondos-banco', 'press-cerrado-barra', 'flexiones-diamante'],
  vista: 'lateral',
  ancla: { punto: 'agarre_c', x: -10, y: 27, segmento: 'antebrazo_c', angulo: -106 },
  poses: [pose(0, ARRIBA), pose(300, ARRIBA), pose(1100, MEDIO), pose(1900, ABAJO), pose(2150, ABAJO), pose(2800, MEDIO)],
  cicloMs: 3500,
  esfuerzo: [{ desde: 2150, hasta: 3500 }],
  msFicha: 2800,
  escenario: [
    { tipo: 'banco', x: -60, ancho: 51.5, alto: 24.6, capa: 'fondo' },
    { tipo: 'banco', x: 38, ancho: 40, alto: 24.6, capa: 'fondo' },
  ],
  encuadre: { x: -44, y: -4, ancho: 128, alto: 90 },
  cues: T.cues,
  errores: T.errores,
};

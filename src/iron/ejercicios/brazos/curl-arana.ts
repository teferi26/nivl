// NIVL · IRON · Curl araña (spider curl) con mancuernas, boca abajo en banco inclinado.
//
// Ronda 2 (banco inclinado del equipo pecho, puesto al revés como en el remo
// con apoyo de pecho). El pecho apoyado en el respaldo a 45° y los brazos
// colgando verticales por delante del borde: el bíceps trabaja sobre todo
// arriba, donde el curl de pie descansa. Solo se mueve el antebrazo.
// Biomecánica (src/iron/__tests__/ronda2.test.ts): brazo vertical y quieto
// (±3°), codo de ≤ 8° a ≥ 120°, tronco quieto sobre el respaldo, pies planos.

import { dir } from '../../esqueleto';
import type { Ejercicio } from '../../tipos';
import { ANCLA_DE_PIE, bisagra, pose, type Absolutos } from '../espalda/_pose';
import { textos } from './comun';

const r1 = (v: number) => Math.round(v * 10) / 10;
const INCLINACION = 45;
const APOYO_PECHO = 7;
const ALTO = 24.6;
const B = bisagra({ tronco: INCLINACION, brazo: -90, mano: { x: 28, y: 36 } });
const con = (codo: number): Absolutos => ({ ...B.abs, brazo: -90, antebrazo: -90 + codo });
const n = dir(INCLINACION - 90);
const P0 = { x: B.cadera.x + n.x * APOYO_PECHO, y: B.cadera.y + n.y * APOYO_PECHO };
const BISAGRA_X = P0.x - (P0.y - ALTO) / Math.tan((INCLINACION * Math.PI) / 180);
const T = textos('curl-arana', ['pecho', 'brazos', 'arriba'], ['balanceo', 'codosAtras']);

export const curlArana: Ejercicio = {
  id: 'curl-arana',
  nombre: T.nombre,
  grupo: 'brazo',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['mancuerna', 'banco_inclinado'],
  musculos: { principales: ['biceps'], secundarios: ['braquial', 'braquiorradial', 'antebrazo'] },
  sustitutos: ['curl-concentrado', 'curl-inclinado-mancuerna', 'curl-biceps-mancuerna'],
  vista: 'lateral',
  ancla: ANCLA_DE_PIE,
  poses: [pose(0, con(5)), pose(400, con(5)), pose(1000, con(70)), pose(1500, con(125)), pose(1900, con(125)), pose(2900, con(70))],
  cicloMs: 3900,
  esfuerzo: [{ desde: 400, hasta: 1500 }],
  msFicha: 1000,
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'punta', lados: ['cerca', 'lejos'] },
  escenario: [
    { tipo: 'banco_inclinado', x: r1(BISAGRA_X), alto: ALTO, angulo: INCLINACION, respaldo: 44, asiento: 8, espejo: true, capa: 'medio' },
  ],
  encuadre: { x: -30, y: -4, ancho: 86, alto: 92 },
  cues: T.cues,
  errores: T.errores,
};

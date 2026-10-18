// NIVL · IRON · Curl inclinado con mancuernas, sentado en banco inclinado.
//
// Ronda 2 (banco inclinado del equipo pecho). Respaldo a 55°, espalda y
// cabeza apoyadas, brazos colgando verticales por detrás de la línea del
// tronco: el bíceps empieza estirado. Solo se mueve el antebrazo; el brazo
// no se adelanta.
// Biomecánica (src/iron/__tests__/ronda2.test.ts): brazo vertical y quieto
// (±3°), codo de ≤ 8° a ≥ 110°, espalda en el respaldo, pies planos.

import { dir, LARGO } from '../../esqueleto';
import type { Ejercicio } from '../../tipos';
import { bisagra, cuelloApoyado, extremidades, piernasAlSuelo, type Absolutos } from '../pecho/_geometria';
import { textos } from './comun';

const r1 = (v: number) => Math.round(v * 10) / 10;
/** Inclinación del respaldo sobre la horizontal. */
export const RESPALDO_CURL = 55;
const ALTO = 24.6;
const CADERA = { x: 0, y: ALTO + 8.6 };
const TRONCO = 180 - RESPALDO_CURL;
const PIERNAS = piernasAlSuelo(CADERA, { x: 28, y: 4 });
const BISAGRA = bisagra({ cadera: CADERA, tronco: TRONCO }, ALTO);
const BRAZO = -90;
const con = (codo: number): Absolutos => ({ tronco: TRONCO, ...PIERNAS, brazo: BRAZO, antebrazo: BRAZO + codo });
const CUELLO = cuelloApoyado();
const p = (ms: number, codo: number) => ({ ms, cuello: CUELLO, cerca: extremidades(con(codo)) });
const T = textos('curl-inclinado-mancuerna', ['espalda', 'codos', 'bajada'], ['hombros', 'corto']);
/** Dónde está el hombro (para el encuadre y los tests). */
export const HOMBRO_CURL_INCLINADO = { x: CADERA.x + dir(TRONCO).x * LARGO.tronco, y: CADERA.y + dir(TRONCO).y * LARGO.tronco };

export const curlInclinadoMancuerna: Ejercicio = {
  id: 'curl-inclinado-mancuerna',
  nombre: T.nombre,
  grupo: 'brazo',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['mancuerna', 'banco_inclinado'],
  musculos: { principales: ['biceps'], secundarios: ['braquial', 'braquiorradial', 'antebrazo'] },
  sustitutos: ['curl-sentado-mancuerna', 'curl-biceps-mancuerna', 'curl-concentrado'],
  vista: 'lateral',
  ancla: { punto: 'cadera', x: CADERA.x, y: CADERA.y, segmento: 'tronco', angulo: TRONCO },
  poses: [p(0, 5), p(400, 5), p(1100, 70), p(1700, 116), p(2000, 116), p(3000, 70)],
  cicloMs: 4100,
  esfuerzo: [{ desde: 400, hasta: 1700 }],
  msFicha: 1100,
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'punta', lados: ['cerca', 'lejos'] },
  escenario: [{ tipo: 'banco_inclinado', x: r1(BISAGRA.x), alto: ALTO, angulo: RESPALDO_CURL, respaldo: 56, asiento: 22, capa: 'medio' }],
  encuadre: { x: -46, y: -4, ancho: 90, alto: 100 },
  cues: T.cues,
  errores: T.errores,
};

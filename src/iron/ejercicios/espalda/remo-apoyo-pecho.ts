// NIVL · IRON · Remo con mancuernas con el pecho apoyado en un banco inclinado.
//
// Ronda 2 (banco inclinado del equipo pecho, puesto al revés: el respaldo
// sube hacia la cabeza). Pecho apoyado en el respaldo a 35°, piernas a los
// lados del banco y pies en el suelo. Al no tener que sujetar el tronco, la
// espalda baja descansa y el tirón es solo de espalda: codos atrás y pegados,
// el pecho no se despega.
// Biomecánica (src/iron/__tests__/ronda2.test.ts): el tronco no se mueve y
// queda sobre el respaldo, abajo el brazo cuelga vertical, arriba el codo
// pasa la línea de la espalda, pies planos.

import { dir } from '../../esqueleto';
import type { Ejercicio } from '../../tipos';
import { ANCLA_DE_PIE, bisagra, brazoHasta, pose, sobreTronco } from './_pose';

const r1 = (v: number) => Math.round(v * 10) / 10;
/** Inclinación del respaldo (y del tronco, apoyado en él). */
export const INCLINACION_APOYO = 35;
/** Del eje del tronco a la cara del respaldo (el grosor del pecho y el abdomen). */
export const APOYO_PECHO = 7;
const ALTO = 24.6;

const B = bisagra({ tronco: INCLINACION_APOYO, brazo: -90, mano: { x: 34, y: 30 } });
const FIN = sobreTronco(B.cadera, INCLINACION_APOYO, 0.45, 6.4);
const MITAD = { x: (34 + FIN.x) / 2 + 1, y: (30 + FIN.y) / 2 };
const ABAJO = B.abs;
const MEDIO = { ...B.abs, ...brazoHasta(B.hombro, MITAD, true) };
const ARRIBA = { ...B.abs, ...brazoHasta(B.hombro, FIN, true) };

// La cara del respaldo: paralela al tronco, a APOYO_PECHO por la cara del pecho.
const n = dir(INCLINACION_APOYO - 90);
const P0 = { x: B.cadera.x + n.x * APOYO_PECHO, y: B.cadera.y + n.y * APOYO_PECHO };
const BISAGRA_X = P0.x - (P0.y - ALTO) / Math.tan((INCLINACION_APOYO * Math.PI) / 180);

export const remoApoyoPecho: Ejercicio = {
  id: 'remo-apoyo-pecho',
  nombre: 'iron-espalda:ejercicios.remo-apoyo-pecho.nombre',
  grupo: 'espalda',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['mancuerna', 'banco_inclinado'],
  musculos: {
    principales: ['dorsal', 'espalda_alta'],
    secundarios: ['trapecio', 'deltoides_posterior', 'biceps'],
  },
  sustitutos: ['remo-mancuernas', 'remo-maquina', 'remo-mancuerna'],
  vista: 'lateral',
  ancla: ANCLA_DE_PIE,
  poses: [pose(0, ABAJO), pose(400, ABAJO), pose(850, MEDIO), pose(1300, ARRIBA), pose(1650, ARRIBA), pose(2500, MEDIO)],
  cicloMs: 3400,
  esfuerzo: [{ desde: 400, hasta: 1300 }],
  msFicha: 200,
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'lado', lados: ['cerca', 'lejos'] },
  escenario: [
    { tipo: 'banco_inclinado', x: r1(BISAGRA_X), alto: ALTO, angulo: INCLINACION_APOYO, respaldo: 54, asiento: 8, espejo: true, capa: 'medio' },
  ],
  encuadre: { x: -28, y: -4, ancho: 90, alto: 86 },
  cues: [
    'iron-espalda:ejercicios.remo-apoyo-pecho.cues.pecho',
    'iron-espalda:ejercicios.remo-apoyo-pecho.cues.codos',
    'iron-espalda:ejercicios.remo-apoyo-pecho.cues.bajada',
  ],
  errores: [
    'iron-espalda:ejercicios.remo-apoyo-pecho.errores.despegar',
    'iron-espalda:ejercicios.remo-apoyo-pecho.errores.encoger',
  ],
};

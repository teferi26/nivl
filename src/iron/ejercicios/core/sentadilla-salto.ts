// NIVL · IRON · Sentadilla con salto, vista lateral.
//
// De pie, se baja a sentadilla con los brazos atrás y se salta extendiendo
// cadera, rodillas y tobillos con los brazos arriba; se aterriza suave, de
// puntas a talones y con las rodillas dobladas.
// Biomecánica (comprobada en src/iron/__tests__/core.test.ts):
// · Mientras el pie apoya, el tobillo no se mueve y el pie sigue plano (el
//   ancla es el tobillo; en el despegue y el aterrizaje, las puntas).
// · Abajo, la cadera baja hasta cerca de la altura de las rodillas.
// · En el aire, piernas casi estiradas, pies en punta y por encima del suelo.
// · Aterrizaje con las rodillas dobladas (≥ 40°), nunca rígidas.
// `punto` es dónde está el tobillo y `angulo`, el del pie: así el salto
// mueve todo el cuerpo y el pie apoyado no resbala.

import type { Ejercicio, Pose } from '../../tipos';

type Instante = Omit<Pose, 'ms'>;

const PLANO = { x: 0, y: 4 } as const;
/** Talón arriba y puntas en el suelo (despegue y aterrizaje). */
const PUNTAS_P = { x: 6.3, y: 11.3 } as const;

const DE_PIE: Instante = { punto: PLANO, angulo: 0, cuello: 0, cerca: { cadera: 0, rodilla: 0, tobillo: 0, hombro: 5, codo: 10 } };
const ABAJO: Instante = {
  punto: PLANO,
  angulo: 0,
  cuello: -10,
  cerca: { cadera: 120.4, rodilla: 109.8, tobillo: 27.4, hombro: -40, codo: 10 },
};
const PUNTAS: Instante = {
  punto: PUNTAS_P,
  angulo: -45,
  cuello: 0,
  cerca: { cadera: 30.9, rodilla: 41.5, tobillo: -28.4, hombro: 90, codo: 10 },
};
const AIRE: Instante = {
  punto: { x: 3, y: 19.6 },
  angulo: -55,
  cuello: 0,
  cerca: { cadera: 15.8, rodilla: 16.5, tobillo: -50, hombro: 140, codo: 10 },
};
const TOCA: Instante = {
  punto: PUNTAS_P,
  angulo: -45,
  cuello: 0,
  cerca: { cadera: 38, rodilla: 46.5, tobillo: -28.5, hombro: 80, codo: 15 },
};
const ATERRIZA: Instante = {
  punto: PLANO,
  angulo: 0,
  cuello: -5,
  cerca: { cadera: 53.1, rodilla: 60.6, tobillo: 23.5, hombro: 45, codo: 15 },
};

const en = (ms: number, p: Instante): Pose => ({ ms, ...p });

/**
 * El pie girando sobre la punta (despegue y aterrizaje): con el pie a `phi`
 * grados, el tobillo va donde deja la punta de la planta en (12, 0); los
 * ángulos del cuerpo, a medio camino entre `a` (pie plano) y `b` (puntas).
 */
function sobrePunta(phi: number, a: Instante, b: Instante): Instante {
  const r = (phi * Math.PI) / 180;
  const u = phi / -45;
  const mezcla = (x: number, y: number) => Math.round((x + (y - x) * u) * 10) / 10;
  return {
    punto: { x: Math.round((12 - 12 * Math.cos(r) - 4 * Math.sin(r)) * 100) / 100, y: Math.round((-12 * Math.sin(r) + 4 * Math.cos(r)) * 100) / 100 },
    angulo: phi,
    cuello: mezcla(a.cuello, b.cuello),
    cerca: {
      cadera: mezcla(a.cerca.cadera, b.cerca.cadera),
      rodilla: mezcla(a.cerca.rodilla, b.cerca.rodilla),
      tobillo: mezcla(a.cerca.tobillo, b.cerca.tobillo),
      hombro: mezcla(a.cerca.hombro, b.cerca.hombro),
      codo: mezcla(a.cerca.codo, b.cerca.codo),
    },
  };
}

export const sentadillaSalto: Ejercicio = {
  id: 'sentadilla-salto',
  nombre: 'iron-core:ejercicios.sentadilla-salto.nombre',
  grupo: 'cardio',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['peso_corporal'],
  musculos: {
    principales: ['cuadriceps', 'gluteo'],
    secundarios: ['gemelos', 'isquiotibiales', 'abdomen'],
  },
  sustitutos: ['burpees', 'saltos-tijera', 'rodillas-arriba'],
  vista: 'lateral',
  ancla: { punto: 'tobillo_c', x: 0, y: 4, segmento: 'pie_c', angulo: 0 },
  poses: [
    en(0, DE_PIE),
    en(300, DE_PIE),
    en(1000, ABAJO),
    en(1060, sobrePunta(-11, ABAJO, PUNTAS)),
    en(1120, sobrePunta(-22, ABAJO, PUNTAS)),
    en(1180, sobrePunta(-33, ABAJO, PUNTAS)),
    en(1250, PUNTAS),
    en(1450, AIRE),
    en(1650, TOCA),
    en(1710, sobrePunta(-33, ATERRIZA, TOCA)),
    en(1770, sobrePunta(-22, ATERRIZA, TOCA)),
    en(1830, sobrePunta(-11, ATERRIZA, TOCA)),
    en(1900, ATERRIZA),
    en(2300, DE_PIE),
  ],
  cicloMs: 2600,
  esfuerzo: [{ desde: 1000, hasta: 1450 }],
  msFicha: 1000,
  encuadre: { x: -48, y: -4, ancho: 100, alto: 138 },
  cues: [
    'iron-core:ejercicios.sentadilla-salto.cues.bajar',
    'iron-core:ejercicios.sentadilla-salto.cues.saltar',
    'iron-core:ejercicios.sentadilla-salto.cues.aterrizar',
  ],
  errores: [
    'iron-core:ejercicios.sentadilla-salto.errores.rodillas',
    'iron-core:ejercicios.sentadilla-salto.errores.rigido',
  ],
};

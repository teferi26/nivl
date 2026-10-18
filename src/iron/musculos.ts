// NIVL · IRON · Mapa muscular propio.
//
// Cada músculo es una o varias capas que van pegadas a un segmento del
// maniquí: se mueven con él y se iluminan (principal en el acento de IRON,
// secundarios más suaves). Dos juegos de formas:
// · LATERAL: la vista de perfil de la animación (cara anterior o posterior
//   del segmento, o el medio).
// · FRONTAL: el mapa de cuerpo entero (delante y detrás) y las animaciones de
//   vista frontal. `centro` va de -1 a 1 sobre el ancho del segmento; con
//   `par` se dibuja también en espejo (pectorales, dorsales...).
// Formas dibujadas por nosotros; ninguna sale de otra app ni de un atlas.

import type { GrupoMuscular, MusculoId } from './tipos';

export type BaseSegmento = 'tronco' | 'cabeza' | 'muslo' | 'pierna' | 'brazo' | 'antebrazo';

export interface FormaLateral {
  seg: BaseSegmento;
  t0: number;
  t1: number;
  cara: 'ant' | 'post' | 'medio';
  /** Fracción del grosor del segmento que ocupa (0 a 1). */
  ancho: number;
  /** Dónde está el vientre más grueso, de 0 (t0) a 1 (t1). Por defecto, en el medio. */
  pico?: number;
}

export interface FormaFrontal {
  /** En qué mapa se ve: delante o detrás. */
  cara: 'ant' | 'post';
  seg: BaseSegmento;
  t0: number;
  t1: number;
  /** Desplazamiento lateral sobre el radio del segmento: + hacia fuera del cuerpo. */
  centro: number;
  ancho: number;
  /** Solo en el tronco y la cabeza: dibujarlo también al otro lado. */
  par?: boolean;
  pico?: number;
}

export const MUSCULOS: readonly MusculoId[] = [
  'pectoral',
  'deltoides_anterior',
  'deltoides_lateral',
  'deltoides_posterior',
  'biceps',
  'triceps',
  'antebrazo',
  'dorsal',
  'trapecio',
  'espalda_alta',
  'lumbares',
  'abdomen',
  'oblicuos',
  'gluteo',
  'cuadriceps',
  'isquiotibiales',
  'aductores',
  'gemelos',
  'tibial',
  // brazos
  'braquial',
  'braquiorradial',
  // pierna
  'soleo',
  'gluteo_medio',
  'psoas',
  // core
  'transverso',
  'serrato',
  'cuello',
  // hombro
  'manguito_rotador',
];

export const GRUPO_DE_MUSCULO: Readonly<Record<MusculoId, GrupoMuscular>> = {
  pectoral: 'pecho',
  deltoides_anterior: 'hombro',
  deltoides_lateral: 'hombro',
  deltoides_posterior: 'hombro',
  biceps: 'brazo',
  triceps: 'brazo',
  antebrazo: 'brazo',
  dorsal: 'espalda',
  trapecio: 'espalda',
  espalda_alta: 'espalda',
  lumbares: 'espalda',
  abdomen: 'core',
  oblicuos: 'core',
  gluteo: 'pierna',
  cuadriceps: 'pierna',
  isquiotibiales: 'pierna',
  aductores: 'pierna',
  gemelos: 'pierna',
  tibial: 'pierna',
  // brazos
  braquial: 'brazo',
  braquiorradial: 'brazo',
  // pierna
  soleo: 'pierna',
  gluteo_medio: 'pierna',
  psoas: 'pierna',
  // core: el cuello no tiene grupo propio; va con el core (estabilidad de cabeza y tronco).
  transverso: 'core',
  serrato: 'core',
  cuello: 'core',
  // hombro
  manguito_rotador: 'hombro',
};

export const GRUPOS: readonly GrupoMuscular[] = ['pecho', 'espalda', 'hombro', 'brazo', 'pierna', 'core', 'cardio', 'movilidad'];

// Todas las piezas juntas cubren la silueta: el maniquí se lee musculado
// aunque el ejercicio no trabaje ese músculo (va en gris oscuro).
export const FORMAS_LATERAL: Readonly<Record<MusculoId, readonly FormaLateral[]>> = {
  pectoral: [{ seg: 'tronco', t0: 0.6, t1: 0.97, cara: 'ant', ancho: 0.86, pico: 0.5 }],
  deltoides_anterior: [{ seg: 'brazo', t0: -0.12, t1: 0.42, cara: 'ant', ancho: 0.92, pico: 0.3 }],
  deltoides_lateral: [{ seg: 'brazo', t0: -0.15, t1: 0.4, cara: 'medio', ancho: 0.8, pico: 0.3 }],
  deltoides_posterior: [{ seg: 'brazo', t0: -0.12, t1: 0.42, cara: 'post', ancho: 0.92, pico: 0.3 }],
  biceps: [{ seg: 'brazo', t0: 0.34, t1: 0.97, cara: 'ant', ancho: 0.9, pico: 0.55 }],
  triceps: [{ seg: 'brazo', t0: 0.14, t1: 0.95, cara: 'post', ancho: 0.9, pico: 0.38 }],
  antebrazo: [
    { seg: 'antebrazo', t0: 0.0, t1: 0.82, cara: 'ant', ancho: 0.86, pico: 0.28 },
    { seg: 'antebrazo', t0: 0.0, t1: 0.82, cara: 'post', ancho: 0.86, pico: 0.28 },
  ],
  dorsal: [{ seg: 'tronco', t0: 0.28, t1: 0.82, cara: 'post', ancho: 0.9, pico: 0.68 }],
  trapecio: [
    { seg: 'tronco', t0: 0.8, t1: 1.08, cara: 'post', ancho: 0.86, pico: 0.6 },
    { seg: 'cabeza', t0: 0, t1: 0.42, cara: 'post', ancho: 1, pico: 0.3 },
  ],
  espalda_alta: [{ seg: 'tronco', t0: 0.58, t1: 0.88, cara: 'post', ancho: 0.58 }],
  lumbares: [{ seg: 'tronco', t0: 0.04, t1: 0.42, cara: 'post', ancho: 0.55 }],
  abdomen: [{ seg: 'tronco', t0: 0.04, t1: 0.62, cara: 'ant', ancho: 0.72 }],
  oblicuos: [{ seg: 'tronco', t0: 0.1, t1: 0.6, cara: 'medio', ancho: 0.55 }],
  gluteo: [
    { seg: 'tronco', t0: -0.12, t1: 0.24, cara: 'post', ancho: 0.95, pico: 0.42 },
    { seg: 'muslo', t0: -0.06, t1: 0.28, cara: 'post', ancho: 0.95, pico: 0.3 },
  ],
  cuadriceps: [{ seg: 'muslo', t0: 0.03, t1: 0.97, cara: 'ant', ancho: 0.92, pico: 0.55 }],
  isquiotibiales: [{ seg: 'muslo', t0: 0.24, t1: 0.96, cara: 'post', ancho: 0.86, pico: 0.42 }],
  aductores: [{ seg: 'muslo', t0: 0.05, t1: 0.55, cara: 'medio', ancho: 0.5 }],
  gemelos: [{ seg: 'pierna', t0: 0.03, t1: 0.64, cara: 'post', ancho: 0.95, pico: 0.35 }],
  tibial: [{ seg: 'pierna', t0: 0.05, t1: 0.82, cara: 'ant', ancho: 0.62, pico: 0.3 }],
  // brazos
  // Braquial: bajo el bíceps, asoma entre bíceps y tríceps en la mitad distal del brazo.
  braquial: [{ seg: 'brazo', t0: 0.46, t1: 1.0, cara: 'medio', ancho: 0.62, pico: 0.62 }],
  // Braquiorradial: el borde del antebrazo del lado del pulgar, grueso junto al codo.
  braquiorradial: [{ seg: 'antebrazo', t0: -0.08, t1: 0.66, cara: 'ant', ancho: 0.5, pico: 0.24 }],
  // pierna
  // Sóleo: asoma bajo el gemelo, por detrás de la mitad baja de la pierna.
  soleo: [{ seg: 'pierna', t0: 0.42, t1: 0.9, cara: 'post', ancho: 0.78, pico: 0.4 }],
  // Glúteo medio: el lado de la pelvis, encima del glúteo mayor.
  gluteo_medio: [{ seg: 'tronco', t0: -0.02, t1: 0.27, cara: 'medio', ancho: 0.78, pico: 0.55 }],
  // Psoas (flexores de cadera): el pliegue de la ingle, del tronco al muslo.
  psoas: [
    { seg: 'tronco', t0: -0.04, t1: 0.16, cara: 'ant', ancho: 0.5, pico: 0.6 },
    { seg: 'muslo', t0: -0.02, t1: 0.2, cara: 'ant', ancho: 0.46, pico: 0.3 },
  ],
  // core: el transverso asoma bajo el oblicuo; el serrato, en las costillas bajo la axila; el cuello, el esternocleidomastoideo.
  transverso: [{ seg: 'tronco', t0: 0.02, t1: 0.34, cara: 'medio', ancho: 0.5, pico: 0.4 }],
  serrato: [{ seg: 'tronco', t0: 0.54, t1: 0.8, cara: 'medio', ancho: 0.55, pico: 0.55 }],
  cuello: [{ seg: 'cabeza', t0: -0.02, t1: 0.5, cara: 'ant', ancho: 0.8, pico: 0.4 }],
  // hombro: infraespinoso y redondo menor, sobre la escápula (lo que se ve del manguito).
  manguito_rotador: [{ seg: 'tronco', t0: 0.66, t1: 0.92, cara: 'post', ancho: 0.44, pico: 0.55 }],
};

const SEIS: readonly (readonly [number, number])[] = [
  [0.08, 0.25],
  [0.26, 0.43],
  [0.44, 0.61],
];

export const FORMAS_FRONTAL: Readonly<Record<MusculoId, readonly FormaFrontal[]>> = {
  pectoral: [{ cara: 'ant', seg: 'tronco', t0: 0.64, t1: 0.97, centro: 0.47, ancho: 0.54, par: true, pico: 0.55 }],
  deltoides_anterior: [{ cara: 'ant', seg: 'brazo', t0: -0.1, t1: 0.38, centro: -0.08, ancho: 0.92, pico: 0.3 }],
  deltoides_lateral: [
    { cara: 'ant', seg: 'brazo', t0: -0.1, t1: 0.36, centro: 0.72, ancho: 0.46, pico: 0.3 },
    { cara: 'post', seg: 'brazo', t0: -0.1, t1: 0.36, centro: 0.72, ancho: 0.46, pico: 0.3 },
  ],
  deltoides_posterior: [{ cara: 'post', seg: 'brazo', t0: -0.1, t1: 0.38, centro: -0.08, ancho: 0.92, pico: 0.3 }],
  biceps: [{ cara: 'ant', seg: 'brazo', t0: 0.34, t1: 0.95, centro: 0, ancho: 0.82, pico: 0.55 }],
  triceps: [{ cara: 'post', seg: 'brazo', t0: 0.18, t1: 0.94, centro: 0, ancho: 0.82, pico: 0.4 }],
  antebrazo: [
    { cara: 'ant', seg: 'antebrazo', t0: 0.0, t1: 0.82, centro: 0, ancho: 0.9, pico: 0.28 },
    { cara: 'post', seg: 'antebrazo', t0: 0.0, t1: 0.82, centro: 0, ancho: 0.9, pico: 0.28 },
  ],
  dorsal: [{ cara: 'post', seg: 'tronco', t0: 0.3, t1: 0.82, centro: 0.6, ancho: 0.44, par: true, pico: 0.7 }],
  trapecio: [
    { cara: 'post', seg: 'tronco', t0: 0.64, t1: 1.06, centro: 0, ancho: 0.56, pico: 0.6 },
    { cara: 'post', seg: 'cabeza', t0: 0, t1: 0.38, centro: 0, ancho: 0.95 },
    { cara: 'ant', seg: 'tronco', t0: 0.93, t1: 1.08, centro: 0.52, ancho: 0.34, par: true },
  ],
  espalda_alta: [{ cara: 'post', seg: 'tronco', t0: 0.58, t1: 0.86, centro: 0.3, ancho: 0.26, par: true }],
  lumbares: [{ cara: 'post', seg: 'tronco', t0: 0.04, t1: 0.42, centro: 0.17, ancho: 0.2, par: true }],
  abdomen: SEIS.map(([t0, t1]) => ({ cara: 'ant' as const, seg: 'tronco' as const, t0, t1, centro: 0.19, ancho: 0.34, par: true })),
  oblicuos: [{ cara: 'ant', seg: 'tronco', t0: 0.1, t1: 0.6, centro: 0.7, ancho: 0.3, par: true }],
  gluteo: [{ cara: 'post', seg: 'tronco', t0: -0.24, t1: 0.2, centro: 0.48, ancho: 0.54, par: true, pico: 0.45 }],
  cuadriceps: [{ cara: 'ant', seg: 'muslo', t0: 0.05, t1: 0.95, centro: 0.14, ancho: 0.8, pico: 0.55 }],
  isquiotibiales: [{ cara: 'post', seg: 'muslo', t0: 0.24, t1: 0.95, centro: 0, ancho: 0.76, pico: 0.45 }],
  aductores: [
    { cara: 'ant', seg: 'muslo', t0: 0.03, t1: 0.5, centro: -0.6, ancho: 0.42 },
    { cara: 'post', seg: 'muslo', t0: 0.04, t1: 0.36, centro: -0.62, ancho: 0.34 },
  ],
  gemelos: [
    { cara: 'post', seg: 'pierna', t0: 0.04, t1: 0.58, centro: 0, ancho: 0.88, pico: 0.38 },
    { cara: 'ant', seg: 'pierna', t0: 0.1, t1: 0.5, centro: -0.62, ancho: 0.32 },
  ],
  tibial: [{ cara: 'ant', seg: 'pierna', t0: 0.05, t1: 0.8, centro: 0.26, ancho: 0.5, pico: 0.3 }],
  // brazos
  braquial: [
    { cara: 'ant', seg: 'brazo', t0: 0.5, t1: 0.96, centro: 0.66, ancho: 0.34, pico: 0.6 },
    { cara: 'post', seg: 'brazo', t0: 0.55, t1: 0.95, centro: 0.7, ancho: 0.26, pico: 0.6 },
  ],
  braquiorradial: [
    { cara: 'ant', seg: 'antebrazo', t0: -0.06, t1: 0.6, centro: 0.62, ancho: 0.38, pico: 0.25 },
    { cara: 'post', seg: 'antebrazo', t0: -0.04, t1: 0.5, centro: 0.66, ancho: 0.3, pico: 0.25 },
  ],
  // pierna
  soleo: [
    { cara: 'post', seg: 'pierna', t0: 0.46, t1: 0.86, centro: 0, ancho: 0.72, pico: 0.35 },
    { cara: 'ant', seg: 'pierna', t0: 0.4, t1: 0.78, centro: 0.82, ancho: 0.24 },
  ],
  gluteo_medio: [
    { cara: 'post', seg: 'tronco', t0: 0.0, t1: 0.26, centro: 0.8, ancho: 0.34, par: true, pico: 0.55 },
    { cara: 'ant', seg: 'tronco', t0: -0.06, t1: 0.22, centro: 0.84, ancho: 0.3, par: true, pico: 0.55 },
  ],
  psoas: [
    { cara: 'ant', seg: 'tronco', t0: -0.08, t1: 0.08, centro: 0.4, ancho: 0.22, par: true },
    { cara: 'ant', seg: 'muslo', t0: -0.02, t1: 0.2, centro: -0.3, ancho: 0.4, pico: 0.3 },
  ],
  // core
  transverso: [{ cara: 'ant', seg: 'tronco', t0: 0.0, t1: 0.3, centro: 0.55, ancho: 0.3, par: true, pico: 0.4 }],
  serrato: [{ cara: 'ant', seg: 'tronco', t0: 0.52, t1: 0.76, centro: 0.86, ancho: 0.2, par: true, pico: 0.6 }],
  cuello: [{ cara: 'ant', seg: 'cabeza', t0: 0.0, t1: 0.45, centro: 0.45, ancho: 0.35, par: true }],
  // hombro: por detrás, sobre la escápula, entre el deltoides posterior y el romboides.
  manguito_rotador: [{ cara: 'post', seg: 'tronco', t0: 0.7, t1: 0.92, centro: 0.62, ancho: 0.3, par: true, pico: 0.45 }],
};

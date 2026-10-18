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
};

export const GRUPOS: readonly GrupoMuscular[] = ['pecho', 'espalda', 'hombro', 'brazo', 'pierna', 'core'];

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
};

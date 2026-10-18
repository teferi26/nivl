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
};

export const GRUPOS: readonly GrupoMuscular[] = ['pecho', 'espalda', 'hombro', 'brazo', 'pierna', 'core'];

export const FORMAS_LATERAL: Readonly<Record<MusculoId, readonly FormaLateral[]>> = {
  pectoral: [{ seg: 'tronco', t0: 0.6, t1: 0.94, cara: 'ant', ancho: 0.75 }],
  deltoides_anterior: [{ seg: 'brazo', t0: -0.08, t1: 0.38, cara: 'ant', ancho: 0.6 }],
  deltoides_lateral: [{ seg: 'brazo', t0: -0.1, t1: 0.36, cara: 'medio', ancho: 0.5 }],
  deltoides_posterior: [{ seg: 'brazo', t0: -0.08, t1: 0.38, cara: 'post', ancho: 0.6 }],
  biceps: [{ seg: 'brazo', t0: 0.3, t1: 0.92, cara: 'ant', ancho: 0.62 }],
  triceps: [{ seg: 'brazo', t0: 0.12, t1: 0.9, cara: 'post', ancho: 0.66 }],
  antebrazo: [{ seg: 'antebrazo', t0: 0.02, t1: 0.72, cara: 'medio', ancho: 0.72 }],
  dorsal: [{ seg: 'tronco', t0: 0.34, t1: 0.82, cara: 'post', ancho: 0.72 }],
  trapecio: [
    { seg: 'tronco', t0: 0.84, t1: 1.02, cara: 'post', ancho: 0.8 },
    { seg: 'cabeza', t0: 0, t1: 0.35, cara: 'post', ancho: 0.9 },
  ],
  espalda_alta: [{ seg: 'tronco', t0: 0.6, t1: 0.88, cara: 'post', ancho: 0.55 }],
  lumbares: [{ seg: 'tronco', t0: 0.08, t1: 0.44, cara: 'post', ancho: 0.5 }],
  abdomen: [{ seg: 'tronco', t0: 0.08, t1: 0.6, cara: 'ant', ancho: 0.5 }],
  oblicuos: [{ seg: 'tronco', t0: 0.12, t1: 0.56, cara: 'medio', ancho: 0.42 }],
  gluteo: [
    { seg: 'tronco', t0: -0.04, t1: 0.2, cara: 'post', ancho: 0.8 },
    { seg: 'muslo', t0: -0.05, t1: 0.24, cara: 'post', ancho: 0.8 },
  ],
  cuadriceps: [{ seg: 'muslo', t0: 0.06, t1: 0.92, cara: 'ant', ancho: 0.72 }],
  isquiotibiales: [{ seg: 'muslo', t0: 0.24, t1: 0.92, cara: 'post', ancho: 0.62 }],
  aductores: [{ seg: 'muslo', t0: 0.04, t1: 0.5, cara: 'medio', ancho: 0.5 }],
  gemelos: [{ seg: 'pierna', t0: 0.06, t1: 0.56, cara: 'post', ancho: 0.78 }],
};

export const FORMAS_FRONTAL: Readonly<Record<MusculoId, readonly FormaFrontal[]>> = {
  pectoral: [{ cara: 'ant', seg: 'tronco', t0: 0.64, t1: 0.93, centro: 0.46, ancho: 0.44, par: true }],
  deltoides_anterior: [{ cara: 'ant', seg: 'brazo', t0: -0.08, t1: 0.32, centro: 0, ancho: 0.85 }],
  deltoides_lateral: [
    { cara: 'ant', seg: 'brazo', t0: -0.06, t1: 0.3, centro: 0.72, ancho: 0.32 },
    { cara: 'post', seg: 'brazo', t0: -0.06, t1: 0.3, centro: 0.72, ancho: 0.32 },
  ],
  deltoides_posterior: [{ cara: 'post', seg: 'brazo', t0: -0.08, t1: 0.32, centro: 0, ancho: 0.85 }],
  biceps: [{ cara: 'ant', seg: 'brazo', t0: 0.32, t1: 0.9, centro: 0, ancho: 0.62 }],
  triceps: [{ cara: 'post', seg: 'brazo', t0: 0.25, t1: 0.9, centro: 0, ancho: 0.64 }],
  antebrazo: [
    { cara: 'ant', seg: 'antebrazo', t0: 0.02, t1: 0.7, centro: 0, ancho: 0.7 },
    { cara: 'post', seg: 'antebrazo', t0: 0.02, t1: 0.7, centro: 0, ancho: 0.7 },
  ],
  dorsal: [{ cara: 'post', seg: 'tronco', t0: 0.34, t1: 0.8, centro: 0.6, ancho: 0.36, par: true }],
  trapecio: [
    { cara: 'post', seg: 'tronco', t0: 0.68, t1: 1.03, centro: 0, ancho: 0.5 },
    { cara: 'post', seg: 'cabeza', t0: 0, t1: 0.35, centro: 0, ancho: 0.9 },
    { cara: 'ant', seg: 'tronco', t0: 0.93, t1: 1.04, centro: 0.55, ancho: 0.3, par: true },
  ],
  espalda_alta: [{ cara: 'post', seg: 'tronco', t0: 0.6, t1: 0.86, centro: 0.34, ancho: 0.24, par: true }],
  lumbares: [{ cara: 'post', seg: 'tronco', t0: 0.06, t1: 0.42, centro: 0.17, ancho: 0.16, par: true }],
  abdomen: [{ cara: 'ant', seg: 'tronco', t0: 0.1, t1: 0.62, centro: 0, ancho: 0.3 }],
  oblicuos: [{ cara: 'ant', seg: 'tronco', t0: 0.12, t1: 0.56, centro: 0.7, ancho: 0.2, par: true }],
  gluteo: [{ cara: 'post', seg: 'tronco', t0: -0.22, t1: 0.16, centro: 0.48, ancho: 0.48, par: true }],
  cuadriceps: [{ cara: 'ant', seg: 'muslo', t0: 0.1, t1: 0.9, centro: 0.12, ancho: 0.72 }],
  isquiotibiales: [{ cara: 'post', seg: 'muslo', t0: 0.26, t1: 0.9, centro: 0, ancho: 0.66 }],
  aductores: [
    { cara: 'ant', seg: 'muslo', t0: 0.05, t1: 0.46, centro: -0.58, ancho: 0.38 },
    { cara: 'post', seg: 'muslo', t0: 0.05, t1: 0.34, centro: -0.6, ancho: 0.3 },
  ],
  gemelos: [{ cara: 'post', seg: 'pierna', t0: 0.05, t1: 0.52, centro: 0, ancho: 0.76 }],
};

// NIVL · IRON · Catálogo del grupo HOMBRO (fase 2, equipo hombro).
//
// Un archivo por ejercicio en esta carpeta (comun.ts son piezas compartidas)
// y una línea aquí, de los más usados a los menos. Lo registra
// src/iron/ejercicios/index.ts. Textos: namespace `iron-hombro`
// (src/i18n/es/iron-hombro.json). Lista, ronda 2 y riesgos: docs/iron/F2-hombro.md.

import type { Ejercicio } from '../../tipos';
import { elevacionFrontalBanda } from './elevacion-frontal-banda';
import { elevacionFrontalBarra } from './elevacion-frontal-barra';
import { elevacionLateralBanda } from './elevacion-lateral-banda';
import { elevacionesFrontales } from './elevaciones-frontales';
import { elevacionesLaterales } from './elevaciones-laterales';
import { elevacionesLateralesSentado } from './elevaciones-laterales-sentado';
import { facePullBanda } from './face-pull-banda';
import { flexionPica } from './flexion-pica';
import { flexionPicaPiesElevados } from './flexion-pica-pies-elevados';
import { pajaroMancuerna } from './pajaro-mancuerna';
import { pressArnold } from './press-arnold';
import { pressBanda } from './press-banda';
import { pressMancuernaSentado } from './press-mancuerna-sentado';
import { pressMilitarBarra } from './press-militar-barra';
import { pressMilitarMancuerna } from './press-militar-mancuerna';
import { pushPress } from './push-press';
import { remoMentonBanda } from './remo-menton-banda';
import { remoMentonBarra } from './remo-menton-barra';
import { remoMentonMancuerna } from './remo-menton-mancuerna';
import { rotacionExterna90Banda } from './rotacion-externa-90-banda';
import { rotacionExternaBanda } from './rotacion-externa-banda';
import { rotacionInternaBanda } from './rotacion-interna-banda';
import { tironBanda } from './tiron-banda';

export const EJERCICIOS_HOMBRO: readonly Ejercicio[] = [
  pressMilitarBarra,
  pressMilitarMancuerna,
  elevacionesLaterales,
  pressMancuernaSentado,
  pressArnold,
  elevacionesFrontales,
  pajaroMancuerna,
  facePullBanda,
  remoMentonBarra,
  pushPress,
  elevacionesLateralesSentado,
  remoMentonMancuerna,
  elevacionFrontalBarra,
  flexionPica,
  tironBanda,
  rotacionExternaBanda,
  rotacionInternaBanda,
  rotacionExterna90Banda,
  pressBanda,
  elevacionLateralBanda,
  elevacionFrontalBanda,
  remoMentonBanda,
  flexionPicaPiesElevados,
];

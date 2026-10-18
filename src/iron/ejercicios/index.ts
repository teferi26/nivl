// NIVL · IRON · Catálogo de ejercicios.
//
// Un ejercicio nuevo: su archivo en esta carpeta (ver docs/modos/F1-motor.md,
// «Cómo se añade un ejercicio») y una línea aquí. El test del esquema
// comprueba que el id coincide con el nombre del archivo y que está aquí.

import type { Ejercicio } from '../tipos';
import { curlBicepsMancuerna } from './curl-biceps-mancuerna';
import { plancha } from './plancha';
import { pressBanca } from './press-banca';
import { remoMancuerna } from './remo-mancuerna';
import { sentadillaBarra } from './sentadilla-barra';
// Fase 2: un catálogo por grupo.
import { BRAZOS } from './brazos';

export const EJERCICIOS: readonly Ejercicio[] = [
  sentadillaBarra,
  pressBanca,
  remoMancuerna,
  curlBicepsMancuerna,
  plancha,
  // brazos
  ...BRAZOS,
];

export function ejercicioPorId(id: string): Ejercicio | undefined {
  return EJERCICIOS.find((e) => e.id === id);
}

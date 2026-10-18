// NIVL · IRON · Catálogo de ejercicios.
//
// Un ejercicio nuevo: su archivo en esta carpeta (ver docs/modos/F1-motor.md,
// «Cómo se añade un ejercicio») y una línea aquí; en la fase 2, en la
// carpeta de su grupo y en el index.ts de esa carpeta. El test del esquema
// comprueba que el id coincide con el nombre del archivo y que está aquí.

import type { Ejercicio } from '../tipos';
import { curlBicepsMancuerna } from './curl-biceps-mancuerna';
import { plancha } from './plancha';
import { pressBanca } from './press-banca';
import { remoMancuerna } from './remo-mancuerna';
import { sentadillaBarra } from './sentadilla-barra';
// Fase 2: un catálogo por grupo, cada uno en su carpeta (los 5 del prototipo van primero).
import { EJERCICIOS_CORE } from './core';

export const EJERCICIOS: readonly Ejercicio[] = [
  sentadillaBarra,
  pressBanca,
  remoMancuerna,
  curlBicepsMancuerna,
  plancha,
  ...EJERCICIOS_CORE,
];

export function ejercicioPorId(id: string): Ejercicio | undefined {
  return EJERCICIOS.find((e) => e.id === id);
}

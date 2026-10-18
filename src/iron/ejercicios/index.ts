// NIVL · IRON · Catálogo de ejercicios.
//
// Un ejercicio nuevo: su archivo en esta carpeta (ver docs/modos/F1-motor.md,
// «Cómo se añade un ejercicio») y una línea aquí. El test del esquema
// comprueba que el id coincide con el nombre del archivo y que está aquí.

import type { Ejercicio } from '../tipos';
import { curlBicepsMancuerna } from './curl-biceps-mancuerna';
import { EJERCICIOS_HOMBRO } from './hombro';
import { plancha } from './plancha';
import { pressBanca } from './press-banca';
import { remoMancuerna } from './remo-mancuerna';
import { sentadillaBarra } from './sentadilla-barra';

export const EJERCICIOS: readonly Ejercicio[] = [
  sentadillaBarra,
  pressBanca,
  remoMancuerna,
  curlBicepsMancuerna,
  plancha,
  // hombro
  ...EJERCICIOS_HOMBRO,
];

export function ejercicioPorId(id: string): Ejercicio | undefined {
  return EJERCICIOS.find((e) => e.id === id);
}

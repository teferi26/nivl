// NIVL · IRON · Material (core): la rueda abdominal.
//
// Una rueda con el eje en los puños (las asas salen hacia la cámara y se ven
// como el buje). El ejercicio la mantiene apoyada en el suelo: el centro del
// agarre va a `radio` de altura (comprobado en los tests de biomecánica).

import type { Punto } from '../esqueleto';
import { circuloMat } from './trazo-core';

export function rueda(c: Punto, radio: number): string {
  'worklet';
  // Neumático (anillo con fillRule evenodd), llanta y buje con el asa.
  return circuloMat(c, radio, 28) + circuloMat(c, radio - 1.4, 28) + circuloMat(c, 1.6, 12);
}

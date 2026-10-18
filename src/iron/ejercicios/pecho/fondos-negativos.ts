// NIVL · IRON · Pecho · Fondos negativos, vista lateral.
//
// La progresión hacia el fondo completo: se sube con un salto o un escalón y se
// baja despacio (unos 3,5 s). Trabaja la bajada, que es donde más se progresa.
// Biomecánica comprobada en src/iron/__tests__/biomecanica-pecho.test.ts.

import type { Ejercicio } from '../../tipos';
import { fondos } from './_familias';

export const fondosNegativos: Ejercicio = {
  id: 'fondos-negativos',
  nombre: 'iron-pecho:ejercicios.fondos-negativos.nombre',
  grupo: 'pecho',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['paralelas'],
  musculos: {
    principales: ['pectoral'],
    secundarios: ['triceps', 'deltoides_anterior'],
  },
  sustitutos: ['fondos-paralelas', 'flexiones', 'flexiones-inclinadas'],
  vista: 'lateral',
  ...fondos(true),
  cues: [
    'iron-pecho:ejercicios.fondos-negativos.cues.profundidad',
    'iron-pecho:ejercicios.fondos-negativos.cues.subida',
    'iron-pecho:ejercicios.fondos-negativos.cues.bajada',
  ],
  errores: [
    'iron-pecho:ejercicios.fondos-negativos.errores.caida',
    'iron-pecho:ejercicios.fondos-negativos.errores.profundo',
  ],
};

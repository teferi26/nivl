// NIVL · IRON · Pecho · Fondos en paralelas, vista lateral.
//
// Las manos quedan fijas en la barra. Para el pecho, el tronco se inclina hacia
// delante y baja hasta que el brazo queda paralelo al suelo, con el codo atrás.
// Biomecánica comprobada en src/iron/__tests__/biomecanica-pecho.test.ts.

import type { Ejercicio } from '../../tipos';
import { fondos } from './_familias';

export const fondosParalelas: Ejercicio = {
  id: 'fondos-paralelas',
  nombre: 'iron-pecho:ejercicios.fondos-paralelas.nombre',
  grupo: 'pecho',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['paralelas'],
  musculos: {
    principales: ['pectoral'],
    secundarios: ['triceps', 'deltoides_anterior'],
  },
  sustitutos: ['fondos-negativos', 'press-declinado-mancuerna', 'flexiones-declinadas'],
  vista: 'lateral',
  ...fondos(false),
  cues: [
    'iron-pecho:ejercicios.fondos-paralelas.cues.profundidad',
    'iron-pecho:ejercicios.fondos-paralelas.cues.hombros',
    'iron-pecho:ejercicios.fondos-paralelas.cues.inclinacion',
  ],
  errores: [
    'iron-pecho:ejercicios.fondos-paralelas.errores.hundirse',
    'iron-pecho:ejercicios.fondos-paralelas.errores.profundo',
    'iron-pecho:ejercicios.fondos-paralelas.errores.balanceo',
  ],
};

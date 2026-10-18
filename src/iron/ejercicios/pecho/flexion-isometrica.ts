// NIVL · IRON · Pecho · Flexión isométrica, vista lateral.
//
// Se aguanta la flexión a medio camino de abajo, con los codos a unos 90°.
// Isométrico: el cuerpo no se mueve y la animación late en el músculo.
// Biomecánica comprobada en src/iron/__tests__/biomecanica-pecho.test.ts.

import type { Ejercicio } from '../../tipos';
import { flexion } from './_familias';

export const flexionIsometrica: Ejercicio = {
  id: 'flexion-isometrica',
  nombre: 'iron-pecho:ejercicios.flexion-isometrica.nombre',
  grupo: 'pecho',
  nivel: 'principiante',
  tipo: 'isometrico',
  material: ['peso_corporal'],
  musculos: {
    principales: ['pectoral'],
    secundarios: ['triceps', 'deltoides_anterior', 'abdomen'],
  },
  sustitutos: ['flexiones', 'flexiones-rodillas', 'fondos-negativos'],
  vista: 'lateral',
  ...flexion('isometrica'),
  cues: [
    'iron-pecho:ejercicios.flexion-isometrica.cues.postura',
    'iron-pecho:ejercicios.flexion-isometrica.cues.linea',
    'iron-pecho:ejercicios.flexion-isometrica.cues.respira',
  ],
  errores: [
    'iron-pecho:ejercicios.flexion-isometrica.errores.apnea',
    'iron-pecho:ejercicios.flexion-isometrica.errores.cadera',
  ],
};

// NIVL · IRON · Pecho · Flexiones con rodillas apoyadas, vista lateral.
//
// La progresión de entrada: el cuerpo recto pivota sobre las rodillas, con las
// piernas dobladas hacia arriba. Mueve menos peso que la flexión normal.
// Biomecánica comprobada en src/iron/__tests__/biomecanica-pecho.test.ts.

import type { Ejercicio } from '../../tipos';
import { flexion } from './_familias';

export const flexionesRodillas: Ejercicio = {
  id: 'flexiones-rodillas',
  nombre: 'iron-pecho:ejercicios.flexiones-rodillas.nombre',
  grupo: 'pecho',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['peso_corporal'],
  musculos: {
    principales: ['pectoral'],
    secundarios: ['triceps', 'deltoides_anterior', 'abdomen'],
  },
  sustitutos: ['flexiones-inclinadas', 'flexiones', 'press-suelo-mancuerna'],
  vista: 'lateral',
  ...flexion('rodillas'),
  cues: [
    'iron-pecho:ejercicios.flexiones-rodillas.cues.rodillas',
    'iron-pecho:ejercicios.flexiones-rodillas.cues.linea',
    'iron-pecho:ejercicios.flexiones-rodillas.cues.recorrido',
  ],
  errores: [
    'iron-pecho:ejercicios.flexiones-rodillas.errores.cadera',
    'iron-pecho:ejercicios.flexiones-rodillas.errores.corto',
  ],
};

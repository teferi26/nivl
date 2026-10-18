// NIVL · IRON · Pecho · Flexiones inclinadas, vista lateral.
//
// Manos en el borde de un banco: el cuerpo queda más vertical y carga menos peso.
// Progresión entre la flexión con rodillas y la normal.
// Biomecánica comprobada en src/iron/__tests__/biomecanica-pecho.test.ts.

import type { Ejercicio } from '../../tipos';
import { flexion } from './_familias';

export const flexionesInclinadas: Ejercicio = {
  id: 'flexiones-inclinadas',
  nombre: 'iron-pecho:ejercicios.flexiones-inclinadas.nombre',
  grupo: 'pecho',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['peso_corporal', 'banco'],
  musculos: {
    principales: ['pectoral'],
    secundarios: ['triceps', 'deltoides_anterior', 'abdomen'],
  },
  sustitutos: ['flexiones-rodillas', 'flexiones', 'press-banca-mancuerna'],
  vista: 'lateral',
  ...flexion('inclinada'),
  cues: [
    'iron-pecho:ejercicios.flexiones-inclinadas.cues.apoyo',
    'iron-pecho:ejercicios.flexiones-inclinadas.cues.linea',
    'iron-pecho:ejercicios.flexiones-inclinadas.cues.progresion',
  ],
  errores: [
    'iron-pecho:ejercicios.flexiones-inclinadas.errores.cadera',
    'iron-pecho:ejercicios.flexiones-inclinadas.errores.apoyo',
  ],
};

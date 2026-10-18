// NIVL · IRON · Pecho · Flexiones declinadas, vista lateral.
//
// Pies en el banco y manos en el suelo: el cuerpo baja hacia la cabeza y el
// empuje carga más la parte alta del pecho y el hombro.
// Biomecánica comprobada en src/iron/__tests__/biomecanica-pecho.test.ts.

import type { Ejercicio } from '../../tipos';
import { flexion } from './_familias';

export const flexionesDeclinadas: Ejercicio = {
  id: 'flexiones-declinadas',
  nombre: 'iron-pecho:ejercicios.flexiones-declinadas.nombre',
  grupo: 'pecho',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['peso_corporal', 'banco'],
  musculos: {
    principales: ['pectoral_superior'],
    secundarios: ['pectoral', 'deltoides_anterior', 'triceps', 'abdomen'],
  },
  sustitutos: ['press-inclinado-mancuerna', 'flexiones', 'press-inclinado-barra'],
  vista: 'lateral',
  ...flexion('declinada'),
  cues: [
    'iron-pecho:ejercicios.flexiones-declinadas.cues.apoyo',
    'iron-pecho:ejercicios.flexiones-declinadas.cues.linea',
    'iron-pecho:ejercicios.flexiones-declinadas.cues.cabeza',
  ],
  errores: [
    'iron-pecho:ejercicios.flexiones-declinadas.errores.cadera',
    'iron-pecho:ejercicios.flexiones-declinadas.errores.cabeza',
  ],
};

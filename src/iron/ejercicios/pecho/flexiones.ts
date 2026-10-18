// NIVL · IRON · Pecho · Flexiones, vista lateral.
//
// El cuerpo recto pivota sobre las puntas de los pies y las manos quedan fijas:
// abajo el pecho a un palmo del suelo, arriba los brazos casi estirados.
// Biomecánica comprobada en src/iron/__tests__/biomecanica-pecho.test.ts.

import type { Ejercicio } from '../../tipos';
import { flexion } from './_familias';

export const flexiones: Ejercicio = {
  id: 'flexiones',
  nombre: 'iron-pecho:ejercicios.flexiones.nombre',
  grupo: 'pecho',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['peso_corporal'],
  musculos: {
    principales: ['pectoral'],
    secundarios: ['triceps', 'deltoides_anterior', 'abdomen'],
  },
  sustitutos: ['flexiones-rodillas', 'flexiones-inclinadas', 'press-banca-mancuerna'],
  vista: 'lateral',
  ...flexion('normal'),
  cues: [
    'iron-pecho:ejercicios.flexiones.cues.linea',
    'iron-pecho:ejercicios.flexiones.cues.manos',
    'iron-pecho:ejercicios.flexiones.cues.codos',
    'iron-pecho:ejercicios.flexiones.cues.recorrido',
  ],
  errores: [
    'iron-pecho:ejercicios.flexiones.errores.cadera',
    'iron-pecho:ejercicios.flexiones.errores.cabeza',
    'iron-pecho:ejercicios.flexiones.errores.codos',
  ],
};

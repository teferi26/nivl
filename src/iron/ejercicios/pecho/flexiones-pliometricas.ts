// NIVL · IRON · Pecho · Flexiones pliométricas, vista lateral.
//
// Bajada controlada y empuje explosivo: las manos se despegan del suelo y el
// cuerpo aterriza en la posición de arriba, con los codos sueltos.
// Biomecánica comprobada en src/iron/__tests__/biomecanica-pecho.test.ts.

import type { Ejercicio } from '../../tipos';
import { flexion } from './_familias';

export const flexionesPliometricas: Ejercicio = {
  id: 'flexiones-pliometricas',
  nombre: 'iron-pecho:ejercicios.flexiones-pliometricas.nombre',
  grupo: 'pecho',
  nivel: 'avanzado',
  tipo: 'dinamico',
  material: ['peso_corporal'],
  musculos: {
    principales: ['pectoral'],
    secundarios: ['triceps', 'deltoides_anterior', 'abdomen'],
  },
  sustitutos: ['flexiones', 'flexiones-declinadas', 'fondos-paralelas'],
  vista: 'lateral',
  ...flexion('pliometrica'),
  cues: [
    'iron-pecho:ejercicios.flexiones-pliometricas.cues.base',
    'iron-pecho:ejercicios.flexiones-pliometricas.cues.caida',
    'iron-pecho:ejercicios.flexiones-pliometricas.cues.empuje',
  ],
  errores: [
    'iron-pecho:ejercicios.flexiones-pliometricas.errores.bloqueo',
    'iron-pecho:ejercicios.flexiones-pliometricas.errores.cadera',
    'iron-pecho:ejercicios.flexiones-pliometricas.errores.fatiga',
  ],
};

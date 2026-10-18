// NIVL · IRON · Pecho · Flexiones con manos abiertas, vista lateral.
//
// Manos un palmo más abiertas que en la flexión normal: los brazos salen más
// del plano (se ven más cortos) y el pecho trabaja en más estiramiento.
// Biomecánica comprobada en src/iron/__tests__/biomecanica-pecho.test.ts.

import type { Ejercicio } from '../../tipos';
import { flexion } from './_familias';

export const flexionesAbiertas: Ejercicio = {
  id: 'flexiones-abiertas',
  nombre: 'iron-pecho:ejercicios.flexiones-abiertas.nombre',
  grupo: 'pecho',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['peso_corporal'],
  musculos: {
    principales: ['pectoral'],
    secundarios: ['deltoides_anterior', 'triceps', 'abdomen'],
  },
  sustitutos: ['flexiones', 'aperturas-suelo-mancuerna', 'flexiones-declinadas'],
  vista: 'lateral',
  ...flexion('abierta'),
  cues: [
    'iron-pecho:ejercicios.flexiones-abiertas.cues.hombro',
    'iron-pecho:ejercicios.flexiones-abiertas.cues.manos',
    'iron-pecho:ejercicios.flexiones-abiertas.cues.linea',
  ],
  errores: [
    'iron-pecho:ejercicios.flexiones-abiertas.errores.cruz',
    'iron-pecho:ejercicios.flexiones-abiertas.errores.cadera',
  ],
};

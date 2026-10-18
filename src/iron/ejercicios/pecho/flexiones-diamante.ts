// NIVL · IRON · Pecho · Flexiones diamante, vista lateral.
//
// Manos juntas bajo el esternón (índices y pulgares forman un rombo) y codos
// pegados hacia atrás: el tríceps trabaja tanto como el pecho.
// Biomecánica comprobada en src/iron/__tests__/biomecanica-pecho.test.ts.

import type { Ejercicio } from '../../tipos';
import { flexion } from './_familias';

export const flexionesDiamante: Ejercicio = {
  id: 'flexiones-diamante',
  nombre: 'iron-pecho:ejercicios.flexiones-diamante.nombre',
  grupo: 'pecho',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['peso_corporal'],
  musculos: {
    principales: ['pectoral', 'triceps'],
    secundarios: ['deltoides_anterior', 'abdomen'],
  },
  sustitutos: ['press-banca-cerrado', 'flexiones', 'press-squeeze-mancuerna'],
  vista: 'lateral',
  ...flexion('diamante'),
  cues: [
    'iron-pecho:ejercicios.flexiones-diamante.cues.manos',
    'iron-pecho:ejercicios.flexiones-diamante.cues.codos',
    'iron-pecho:ejercicios.flexiones-diamante.cues.linea',
  ],
  errores: [
    'iron-pecho:ejercicios.flexiones-diamante.errores.codos',
    'iron-pecho:ejercicios.flexiones-diamante.errores.cadera',
    'iron-pecho:ejercicios.flexiones-diamante.errores.munecas',
  ],
};

// NIVL · IRON · Pecho · Aperturas con mancuernas, vista lateral.
//
// Los brazos se abren hacia los lados, fuera del plano de la vista: de perfil
// la mancuerna baja sobre el hombro y el brazo se ve cada vez más corto.
// Biomecánica comprobada en src/iron/__tests__/biomecanica-pecho.test.ts.

import type { Ejercicio } from '../../tipos';
import { aperturas } from './_familias';

export const aperturasMancuerna: Ejercicio = {
  id: 'aperturas-mancuerna',
  nombre: 'iron-pecho:ejercicios.aperturas-mancuerna.nombre',
  grupo: 'pecho',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['mancuerna', 'banco'],
  musculos: {
    principales: ['pectoral'],
    secundarios: ['deltoides_anterior'],
  },
  sustitutos: ['pec-deck', 'aperturas-suelo-mancuerna', 'press-banca-mancuerna'],
  vista: 'lateral',
  ...aperturas('plano'),
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'punta', lados: ['cerca', 'lejos'] },
  cues: [
    'iron-pecho:ejercicios.aperturas-mancuerna.cues.codos',
    'iron-pecho:ejercicios.aperturas-mancuerna.cues.bajada',
    'iron-pecho:ejercicios.aperturas-mancuerna.cues.subida',
  ],
  errores: [
    'iron-pecho:ejercicios.aperturas-mancuerna.errores.press',
    'iron-pecho:ejercicios.aperturas-mancuerna.errores.profundo',
    'iron-pecho:ejercicios.aperturas-mancuerna.errores.peso',
  ],
};

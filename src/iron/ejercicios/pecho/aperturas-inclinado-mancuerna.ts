// NIVL · IRON · Pecho · Aperturas inclinadas con mancuernas, vista lateral.
//
// Aperturas con el respaldo a 30°: el arco carga la parte alta del pecho.
// De perfil, la mancuerna baja sobre el hombro.
// Biomecánica comprobada en src/iron/__tests__/biomecanica-pecho.test.ts.

import type { Ejercicio } from '../../tipos';
import { aperturas } from './_familias';

export const aperturasInclinadoMancuerna: Ejercicio = {
  id: 'aperturas-inclinado-mancuerna',
  nombre: 'iron-pecho:ejercicios.aperturas-inclinado-mancuerna.nombre',
  grupo: 'pecho',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['mancuerna', 'banco_inclinado'],
  musculos: {
    principales: ['pectoral_superior'],
    secundarios: ['pectoral', 'deltoides_anterior'],
  },
  sustitutos: ['aperturas-mancuerna', 'press-inclinado-mancuerna', 'pec-deck'],
  vista: 'lateral',
  ...aperturas('inclinado'),
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'lado', lados: ['cerca', 'lejos'] },
  cues: [
    'iron-pecho:ejercicios.aperturas-inclinado-mancuerna.cues.angulo',
    'iron-pecho:ejercicios.aperturas-inclinado-mancuerna.cues.codos',
    'iron-pecho:ejercicios.aperturas-inclinado-mancuerna.cues.bajada',
    'iron-pecho:ejercicios.aperturas-inclinado-mancuerna.cues.subida',
  ],
  errores: [
    'iron-pecho:ejercicios.aperturas-inclinado-mancuerna.errores.press',
    'iron-pecho:ejercicios.aperturas-inclinado-mancuerna.errores.profundo',
    'iron-pecho:ejercicios.aperturas-inclinado-mancuerna.errores.peso',
  ],
};

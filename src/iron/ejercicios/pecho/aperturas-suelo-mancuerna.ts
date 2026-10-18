// NIVL · IRON · Pecho · Aperturas en el suelo con mancuernas, vista lateral.
//
// Aperturas tumbado en el suelo: el suelo marca el tope (los codos lo rozan),
// así que es la versión más segura para empezar en casa.
// Biomecánica comprobada en src/iron/__tests__/biomecanica-pecho.test.ts.

import type { Ejercicio } from '../../tipos';
import { aperturas } from './_familias';

export const aperturasSueloMancuerna: Ejercicio = {
  id: 'aperturas-suelo-mancuerna',
  nombre: 'iron-pecho:ejercicios.aperturas-suelo-mancuerna.nombre',
  grupo: 'pecho',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['mancuerna'],
  musculos: {
    principales: ['pectoral'],
    secundarios: ['deltoides_anterior'],
  },
  sustitutos: ['aperturas-mancuerna', 'pec-deck', 'press-suelo-mancuerna'],
  vista: 'lateral',
  ...aperturas('suelo'),
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'punta', lados: ['cerca', 'lejos'] },
  cues: [
    'iron-pecho:ejercicios.aperturas-suelo-mancuerna.cues.suelo',
    'iron-pecho:ejercicios.aperturas-suelo-mancuerna.cues.codos',
    'iron-pecho:ejercicios.aperturas-suelo-mancuerna.cues.rodillas',
  ],
  errores: [
    'iron-pecho:ejercicios.aperturas-suelo-mancuerna.errores.press',
    'iron-pecho:ejercicios.aperturas-suelo-mancuerna.errores.rebote',
    'iron-pecho:ejercicios.aperturas-suelo-mancuerna.errores.peso',
  ],
};

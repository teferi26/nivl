// NIVL · IRON · Pecho · Press en el suelo con mancuernas, vista lateral.
//
// Tumbado en el suelo con las rodillas dobladas: las mancuernas bajan hasta que
// los codos tocan el suelo y suben sobre los hombros. Sin banco, en casa.
// Biomecánica comprobada en src/iron/__tests__/biomecanica-pecho.test.ts.

import type { Ejercicio } from '../../tipos';
import { press } from './_familias';

export const pressSueloMancuerna: Ejercicio = {
  id: 'press-suelo-mancuerna',
  nombre: 'iron-pecho:ejercicios.press-suelo-mancuerna.nombre',
  grupo: 'pecho',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['mancuerna'],
  musculos: {
    principales: ['pectoral'],
    secundarios: ['triceps', 'deltoides_anterior'],
  },
  sustitutos: ['press-suelo-barra', 'flexiones', 'press-banca-mancuerna'],
  vista: 'lateral',
  ...press('suelo'),
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'punta', lados: ['cerca', 'lejos'] },
  cues: [
    'iron-pecho:ejercicios.press-suelo-mancuerna.cues.codos',
    'iron-pecho:ejercicios.press-suelo-mancuerna.cues.rodillas',
    'iron-pecho:ejercicios.press-suelo-mancuerna.cues.subida',
  ],
  errores: [
    'iron-pecho:ejercicios.press-suelo-mancuerna.errores.rebote',
    'iron-pecho:ejercicios.press-suelo-mancuerna.errores.codos',
    'iron-pecho:ejercicios.press-suelo-mancuerna.errores.lumbar',
  ],
};

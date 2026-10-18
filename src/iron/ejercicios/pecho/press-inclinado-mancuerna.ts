// NIVL · IRON · Pecho · Press inclinado con mancuernas, vista lateral.
//
// Respaldo a 30°: las mancuernas bajan junto a la parte alta del pecho y suben
// hasta quedar sobre los hombros, con los antebrazos verticales.
// Biomecánica comprobada en src/iron/__tests__/biomecanica-pecho.test.ts.

import type { Ejercicio } from '../../tipos';
import { press } from './_familias';

export const pressInclinadoMancuerna: Ejercicio = {
  id: 'press-inclinado-mancuerna',
  nombre: 'iron-pecho:ejercicios.press-inclinado-mancuerna.nombre',
  grupo: 'pecho',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['mancuerna', 'banco_inclinado'],
  musculos: {
    principales: ['pectoral_superior'],
    secundarios: ['pectoral', 'deltoides_anterior', 'triceps'],
  },
  sustitutos: ['press-inclinado-barra', 'flexiones-declinadas', 'press-banca-mancuerna'],
  vista: 'lateral',
  ...press('inclinado', { sobrePecho: -0.5 }),
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'punta', lados: ['cerca', 'lejos'] },
  cues: [
    'iron-pecho:ejercicios.press-inclinado-mancuerna.cues.angulo',
    'iron-pecho:ejercicios.press-inclinado-mancuerna.cues.bajada',
    'iron-pecho:ejercicios.press-inclinado-mancuerna.cues.subida',
  ],
  errores: [
    'iron-pecho:ejercicios.press-inclinado-mancuerna.errores.gluteos',
    'iron-pecho:ejercicios.press-inclinado-mancuerna.errores.codos',
    'iron-pecho:ejercicios.press-inclinado-mancuerna.errores.corto',
  ],
};

// NIVL · IRON · Pecho · Press de banca con mancuernas, vista lateral.
//
// Como el press de banca, con una mancuerna en cada mano (agarre en pronación:
// se ven de punta). Bajan un poco más que la barra, junto al pecho.
// Biomecánica comprobada en src/iron/__tests__/biomecanica-pecho.test.ts.

import type { Ejercicio } from '../../tipos';
import { press } from './_familias';

export const pressBancaMancuerna: Ejercicio = {
  id: 'press-banca-mancuerna',
  nombre: 'iron-pecho:ejercicios.press-banca-mancuerna.nombre',
  grupo: 'pecho',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['mancuerna', 'banco'],
  musculos: {
    principales: ['pectoral'],
    secundarios: ['deltoides_anterior', 'triceps'],
  },
  sustitutos: ['press-banca', 'flexiones', 'press-suelo-mancuerna'],
  vista: 'lateral',
  ...press('plano', { sobrePecho: -0.5 }),
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'punta', lados: ['cerca', 'lejos'] },
  cues: [
    'iron-pecho:ejercicios.press-banca-mancuerna.cues.escapulas',
    'iron-pecho:ejercicios.press-banca-mancuerna.cues.bajada',
    'iron-pecho:ejercicios.press-banca-mancuerna.cues.subida',
  ],
  errores: [
    'iron-pecho:ejercicios.press-banca-mancuerna.errores.codos',
    'iron-pecho:ejercicios.press-banca-mancuerna.errores.rapido',
    'iron-pecho:ejercicios.press-banca-mancuerna.errores.asimetria',
  ],
};

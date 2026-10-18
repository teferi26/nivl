// NIVL · IRON · Pecho · Press declinado con mancuernas, vista lateral.
//
// Tablero a 20° con la cabeza abajo y los pies enganchados: las mancuernas
// bajan junto a la parte baja del pecho y suben sobre los hombros.
// Biomecánica comprobada en src/iron/__tests__/biomecanica-pecho.test.ts.

import type { Ejercicio } from '../../tipos';
import { press } from './_familias';

export const pressDeclinadoMancuerna: Ejercicio = {
  id: 'press-declinado-mancuerna',
  nombre: 'iron-pecho:ejercicios.press-declinado-mancuerna.nombre',
  grupo: 'pecho',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['mancuerna', 'banco_declinado'],
  musculos: {
    principales: ['pectoral'],
    secundarios: ['triceps', 'deltoides_anterior'],
  },
  sustitutos: ['press-declinado-barra', 'fondos-paralelas', 'press-banca-mancuerna'],
  vista: 'lateral',
  ...press('declinado', { sobrePecho: -0.5 }),
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'punta', lados: ['cerca', 'lejos'] },
  cues: [
    'iron-pecho:ejercicios.press-declinado-mancuerna.cues.pies',
    'iron-pecho:ejercicios.press-declinado-mancuerna.cues.bajada',
    'iron-pecho:ejercicios.press-declinado-mancuerna.cues.salida',
  ],
  errores: [
    'iron-pecho:ejercicios.press-declinado-mancuerna.errores.rapido',
    'iron-pecho:ejercicios.press-declinado-mancuerna.errores.codos',
    'iron-pecho:ejercicios.press-declinado-mancuerna.errores.cabeza',
  ],
};

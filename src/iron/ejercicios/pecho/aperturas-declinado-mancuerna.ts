// NIVL · IRON · Pecho · Aperturas declinadas con mancuernas, vista lateral.
//
// Aperturas con la cabeza abajo y los pies enganchados: el arco carga la parte
// baja del pecho. De perfil, la mancuerna baja sobre el hombro.
// Biomecánica comprobada en src/iron/__tests__/biomecanica-pecho.test.ts.

import type { Ejercicio } from '../../tipos';
import { aperturas } from './_familias';

export const aperturasDeclinadoMancuerna: Ejercicio = {
  id: 'aperturas-declinado-mancuerna',
  nombre: 'iron-pecho:ejercicios.aperturas-declinado-mancuerna.nombre',
  grupo: 'pecho',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['mancuerna', 'banco_declinado'],
  musculos: {
    principales: ['pectoral'],
    secundarios: ['deltoides_anterior'],
  },
  sustitutos: ['aperturas-mancuerna', 'fondos-paralelas', 'pec-deck'],
  vista: 'lateral',
  ...aperturas('declinado'),
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'punta', lados: ['cerca', 'lejos'] },
  cues: [
    'iron-pecho:ejercicios.aperturas-declinado-mancuerna.cues.pies',
    'iron-pecho:ejercicios.aperturas-declinado-mancuerna.cues.codos',
    'iron-pecho:ejercicios.aperturas-declinado-mancuerna.cues.bajada',
    'iron-pecho:ejercicios.aperturas-declinado-mancuerna.cues.subida',
  ],
  errores: [
    'iron-pecho:ejercicios.aperturas-declinado-mancuerna.errores.press',
    'iron-pecho:ejercicios.aperturas-declinado-mancuerna.errores.profundo',
    'iron-pecho:ejercicios.aperturas-declinado-mancuerna.errores.peso',
  ],
};

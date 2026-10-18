// NIVL · IRON · Pecho · Press con mancuernas juntas, vista lateral.
//
// Mancuernas juntas, con las palmas enfrentadas (se ven a lo largo), apretadas
// entre sí todo el recorrido: baja hasta rozar el pecho y sube.
// Biomecánica comprobada en src/iron/__tests__/biomecanica-pecho.test.ts.

import type { Ejercicio } from '../../tipos';
import { press } from './_familias';

export const pressSqueezeMancuerna: Ejercicio = {
  id: 'press-squeeze-mancuerna',
  nombre: 'iron-pecho:ejercicios.press-squeeze-mancuerna.nombre',
  grupo: 'pecho',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['mancuerna', 'banco'],
  musculos: {
    principales: ['pectoral'],
    secundarios: ['triceps', 'deltoides_anterior'],
  },
  sustitutos: ['press-banca-mancuerna', 'press-banca', 'flexiones'],
  vista: 'lateral',
  ...press('plano', { t: 0.68, sobrePecho: 0 }),
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'lado', lados: ['cerca', 'lejos'] },
  cues: [
    'iron-pecho:ejercicios.press-squeeze-mancuerna.cues.apretar',
    'iron-pecho:ejercicios.press-squeeze-mancuerna.cues.agarre',
    'iron-pecho:ejercicios.press-squeeze-mancuerna.cues.bajada',
  ],
  errores: [
    'iron-pecho:ejercicios.press-squeeze-mancuerna.errores.separar',
    'iron-pecho:ejercicios.press-squeeze-mancuerna.errores.rapido',
    'iron-pecho:ejercicios.press-squeeze-mancuerna.errores.gluteos',
  ],
};

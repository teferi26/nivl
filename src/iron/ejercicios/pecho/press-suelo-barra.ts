// NIVL · IRON · Pecho · Press en el suelo con barra, vista lateral.
//
// Tumbado en el suelo con las rodillas dobladas: la barra baja hasta que los
// codos tocan el suelo (recorrido corto, sin rebote) y sube sobre los hombros.
// Biomecánica comprobada en src/iron/__tests__/biomecanica-pecho.test.ts.

import type { Ejercicio } from '../../tipos';
import { press } from './_familias';

export const pressSueloBarra: Ejercicio = {
  id: 'press-suelo-barra',
  nombre: 'iron-pecho:ejercicios.press-suelo-barra.nombre',
  grupo: 'pecho',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['barra'],
  musculos: {
    principales: ['pectoral'],
    secundarios: ['triceps', 'deltoides_anterior'],
  },
  sustitutos: ['press-suelo-mancuerna', 'press-banca', 'flexiones'],
  vista: 'lateral',
  ...press('suelo'),
  carga: { tipo: 'barra', en: 'agarre', disco: 9, eje: { x: -3, y: 10 } },
  cues: [
    'iron-pecho:ejercicios.press-suelo-barra.cues.codos',
    'iron-pecho:ejercicios.press-suelo-barra.cues.rodillas',
    'iron-pecho:ejercicios.press-suelo-barra.cues.trayectoria',
  ],
  errores: [
    'iron-pecho:ejercicios.press-suelo-barra.errores.rebote',
    'iron-pecho:ejercicios.press-suelo-barra.errores.codos',
    'iron-pecho:ejercicios.press-suelo-barra.errores.lumbar',
  ],
};

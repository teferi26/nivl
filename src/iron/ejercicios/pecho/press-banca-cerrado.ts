// NIVL · IRON · Pecho · Press de banca con agarre cerrado, vista lateral.
//
// Manos a la anchura de los hombros y codos pegados: la barra toca más abajo
// en el pecho y el tríceps trabaja tanto como el pectoral.
// Biomecánica comprobada en src/iron/__tests__/biomecanica-pecho.test.ts.

import type { Ejercicio } from '../../tipos';
import { press } from './_familias';

export const pressBancaCerrado: Ejercicio = {
  id: 'press-banca-cerrado',
  nombre: 'iron-pecho:ejercicios.press-banca-cerrado.nombre',
  grupo: 'pecho',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['barra', 'banco'],
  musculos: {
    principales: ['pectoral', 'triceps'],
    secundarios: ['deltoides_anterior'],
  },
  sustitutos: ['flexiones-diamante', 'press-squeeze-mancuerna', 'press-banca'],
  vista: 'lateral',
  ...press('plano', { t: 0.64 }),
  carga: { tipo: 'barra', en: 'agarre', disco: 9, eje: { x: -3, y: 10 } },
  cues: [
    'iron-pecho:ejercicios.press-banca-cerrado.cues.seguridad',
    'iron-pecho:ejercicios.press-banca-cerrado.cues.agarre',
    'iron-pecho:ejercicios.press-banca-cerrado.cues.codos',
    'iron-pecho:ejercicios.press-banca-cerrado.cues.trayectoria',
  ],
  errores: [
    'iron-pecho:ejercicios.press-banca-cerrado.errores.munecas',
    'iron-pecho:ejercicios.press-banca-cerrado.errores.codos',
    'iron-pecho:ejercicios.press-banca-cerrado.errores.rebote',
  ],
};

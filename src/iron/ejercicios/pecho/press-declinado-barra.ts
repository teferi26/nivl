// NIVL · IRON · Pecho · Press declinado con barra, vista lateral.
//
// Tablero a 20° con la cabeza abajo y los pies enganchados: la barra baja a la
// parte baja del pecho y sube hasta quedar sobre los hombros.
// Biomecánica comprobada en src/iron/__tests__/biomecanica-pecho.test.ts.

import type { Ejercicio } from '../../tipos';
import { press } from './_familias';

export const pressDeclinadoBarra: Ejercicio = {
  id: 'press-declinado-barra',
  nombre: 'iron-pecho:ejercicios.press-declinado-barra.nombre',
  grupo: 'pecho',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['barra', 'banco_declinado'],
  musculos: {
    principales: ['pectoral'],
    secundarios: ['triceps', 'deltoides_anterior'],
  },
  sustitutos: ['press-declinado-mancuerna', 'fondos-paralelas', 'press-banca'],
  vista: 'lateral',
  ...press('declinado'),
  carga: { tipo: 'barra', en: 'agarre', disco: 9, eje: { x: -3, y: 10 } },
  cues: [
    'iron-pecho:ejercicios.press-declinado-barra.cues.seguridad',
    'iron-pecho:ejercicios.press-declinado-barra.cues.pies',
    'iron-pecho:ejercicios.press-declinado-barra.cues.trayectoria',
  ],
  errores: [
    'iron-pecho:ejercicios.press-declinado-barra.errores.rebote',
    'iron-pecho:ejercicios.press-declinado-barra.errores.recorrido',
    'iron-pecho:ejercicios.press-declinado-barra.errores.cabeza',
  ],
};

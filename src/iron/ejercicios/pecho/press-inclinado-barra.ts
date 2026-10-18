// NIVL · IRON · Pecho · Press inclinado con barra, vista lateral.
//
// Respaldo a 30°: la barra baja a la parte alta del pecho, bajo las clavículas,
// y sube en vertical hasta quedar sobre los hombros. Antebrazos verticales.
// Biomecánica comprobada en src/iron/__tests__/biomecanica-pecho.test.ts.

import type { Ejercicio } from '../../tipos';
import { press } from './_familias';

export const pressInclinadoBarra: Ejercicio = {
  id: 'press-inclinado-barra',
  nombre: 'iron-pecho:ejercicios.press-inclinado-barra.nombre',
  grupo: 'pecho',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['barra', 'banco_inclinado'],
  musculos: {
    principales: ['pectoral_superior'],
    secundarios: ['pectoral', 'deltoides_anterior', 'triceps'],
  },
  sustitutos: ['press-inclinado-mancuerna', 'flexiones-declinadas', 'press-banca'],
  vista: 'lateral',
  ...press('inclinado'),
  carga: { tipo: 'barra', en: 'agarre', disco: 9, eje: { x: -3, y: 10 } },
  cues: [
    'iron-pecho:ejercicios.press-inclinado-barra.cues.seguridad',
    'iron-pecho:ejercicios.press-inclinado-barra.cues.angulo',
    'iron-pecho:ejercicios.press-inclinado-barra.cues.apoyos',
    'iron-pecho:ejercicios.press-inclinado-barra.cues.trayectoria',
  ],
  errores: [
    'iron-pecho:ejercicios.press-inclinado-barra.errores.gluteos',
    'iron-pecho:ejercicios.press-inclinado-barra.errores.codos',
    'iron-pecho:ejercicios.press-inclinado-barra.errores.cuello',
  ],
};

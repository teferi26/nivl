// NIVL · IRON · Buenos días con barra (good morning).
//
// La barra sobre la espalda alta, como en la sentadilla. Rodillas sueltas,
// la cadera va atrás y el tronco baja hasta casi paralelo con la espalda
// neutra. Carga ligera: es un ejercicio de técnica y de cadena posterior.
// Biomecánica (src/iron/__tests__/espalda.test.ts): abajo la barra queda
// sobre el pie, las rodillas casi no se doblan y los pies siguen planos.

import type { Ejercicio } from '../../tipos';
import { ANCLA_DE_PIE, pose, type Absolutos } from './_pose';

// Las manos en la barra, detrás del cuello (los mismos ángulos de articulación
// que la sentadilla: hombro -9° y codo -147°, con los brazos fuera del plano).
const brazos = (tronco: number) => ({ brazo: tronco + 180 - 9.2, antebrazo: tronco + 180 - 9.2 - 147 });
const ESCORZO = { brazo_c: 0.62, brazo_l: 0.62, antebrazo_c: 0.5, antebrazo_l: 0.5 };

const ARRIBA: Absolutos = { tronco: 88, cabeza: 88, muslo: -86, pierna: -94, pie: 0, ...brazos(88) };
const MEDIO: Absolutos = { tronco: 56, cabeza: 60, muslo: -70, pierna: -82, pie: 0, ...brazos(56) };
const ABAJO: Absolutos = { tronco: 25, cabeza: 30, muslo: -55, pierna: -70, pie: 0, ...brazos(25) };

const p = (ms: number, a: Absolutos) => pose(ms, a, { escorzo: ESCORZO });

export const buenosDias: Ejercicio = {
  id: 'buenos-dias',
  nombre: 'iron-espalda:ejercicios.buenos-dias.nombre',
  grupo: 'espalda',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['barra'],
  musculos: {
    principales: ['lumbares', 'isquiotibiales'],
    secundarios: ['gluteo', 'abdomen', 'espalda_alta'],
  },
  sustitutos: ['peso-muerto-rumano', 'hiperextension', 'superman'],
  vista: 'lateral',
  ancla: ANCLA_DE_PIE,
  poses: [p(0, ARRIBA), p(400, ARRIBA), p(1300, MEDIO), p(2200, ABAJO), p(2500, ABAJO), p(3200, MEDIO)],
  cicloMs: 4000,
  esfuerzo: [{ desde: 2500, hasta: 4000 }],
  msFicha: 2350,
  carga: { tipo: 'barra', en: 'tronco', t: 1, dorso: 6.6, disco: 8.5, eje: { x: -15, y: 6 } },
  encuadre: { x: -46, y: -4, ancho: 92, alto: 112 },
  cues: [
    'iron-espalda:ejercicios.buenos-dias.cues.carga',
    'iron-espalda:ejercicios.buenos-dias.cues.cadera',
    'iron-espalda:ejercicios.buenos-dias.cues.espalda',
  ],
  errores: [
    'iron-espalda:ejercicios.buenos-dias.errores.lumbar',
    'iron-espalda:ejercicios.buenos-dias.errores.rodillas',
  ],
};

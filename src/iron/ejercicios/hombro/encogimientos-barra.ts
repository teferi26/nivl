// NIVL · IRON · Hombro · Encogimientos de trapecio con barra, de pie.
//
// Vista FRONTAL por delante (la barra va delante de los muslos). Misma
// técnica y mismo dibujo de la elevación que con mancuernas
// (encogimientos-mancuerna.ts): los hombros suben y la cabeza no se mueve.

import type { Ejercicio } from '../../tipos';
import { ANCLA_PIE_FRONTAL } from './comun';
import { poseEncogimiento } from './encogimientos-mancuerna';

export const encogimientosBarra: Ejercicio = {
  id: 'encogimientos-barra',
  nombre: 'iron-hombro:ejercicios.encogimientos-barra.nombre',
  grupo: 'espalda',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['barra'],
  musculos: {
    principales: ['trapecio'],
    secundarios: ['espalda_alta', 'antebrazo'],
  },
  sustitutos: ['encogimientos-mancuerna'],
  vista: 'frontal',
  ancla: ANCLA_PIE_FRONTAL,
  // Agarre algo más ancho que los muslos: brazos casi verticales.
  poses: [
    poseEncogimiento(0, false, 3),
    poseEncogimiento(300, false, 3),
    poseEncogimiento(900, true, 3),
    poseEncogimiento(1600, true, 3),
  ],
  cicloMs: 2900,
  esfuerzo: [{ desde: 300, hasta: 900 }],
  msFicha: 1200,
  carga: { tipo: 'barra', en: 'agarre' },
  encuadre: { x: -54, y: -4, ancho: 108, alto: 108 },
  cues: [
    'iron-hombro:ejercicios.encogimientos-barra.cues.vertical',
    'iron-hombro:ejercicios.encogimientos-barra.cues.pausa',
    'iron-hombro:ejercicios.encogimientos-barra.cues.agarre',
  ],
  errores: [
    'iron-hombro:ejercicios.encogimientos-barra.errores.circulos',
    'iron-hombro:ejercicios.encogimientos-barra.errores.rebote',
  ],
};

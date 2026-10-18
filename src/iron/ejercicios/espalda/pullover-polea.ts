// NIVL · IRON · Pullover en polea alta (jalón con brazos rectos), de pie.
//
// De pie frente a la torre, cadera algo flexionada y rodillas sueltas. Los
// brazos, casi rectos, bajan en arco desde delante de la cabeza hasta los
// muslos: el dorsal trabaja sin que ayude el bíceps.
// Biomecánica (src/iron/__tests__/espalda.test.ts): el codo no se dobla más
// de 15° en todo el recorrido y el tronco no se mueve.

import type { Ejercicio } from '../../tipos';
import { ANCLA_DE_PIE, desde, hombroEn, pose, type Absolutos } from './_pose';

const CUERPO = { tronco: 65, cabeza: 72, muslo: -78, pierna: -98, pie: 0 } as const;
const brazos = (brazo: number): Absolutos => ({ ...CUERPO, brazo, antebrazo: brazo + 8 });

const ARRIBA = brazos(24);
const MEDIO = brazos(-26);
const ABAJO = brazos(-72);
const HOMBRO = hombroEn(ANCLA_DE_PIE, pose(0, ARRIBA));
const POLEA = desde(HOMBRO, 28, 60);

export const pulloverPolea: Ejercicio = {
  id: 'pullover-polea',
  nombre: 'iron-espalda:ejercicios.pullover-polea.nombre',
  grupo: 'espalda',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['polea'],
  musculos: {
    principales: ['dorsal'],
    secundarios: ['triceps', 'deltoides_posterior', 'abdomen', 'espalda_alta'],
  },
  sustitutos: ['jalon-pecho', 'pullover-mancuerna'],
  vista: 'lateral',
  ancla: ANCLA_DE_PIE,
  poses: [pose(0, ARRIBA), pose(400, ARRIBA), pose(900, MEDIO), pose(1400, ABAJO), pose(1700, ABAJO), pose(2700, MEDIO)],
  cicloMs: 3700,
  esfuerzo: [{ desde: 400, hasta: 1400 }],
  msFicha: 300,
  carga: { tipo: 'polea', agarre: 'barra', polea: POLEA, lados: ['cerca'], eje: { x: 4, y: 2.5 } },
  escenario: [{ tipo: 'polea', x: POLEA.x + 3, y: POLEA.y, hacia: -1, capa: 'fondo' }],
  encuadre: { x: -30, y: -4, ancho: 96, alto: 124 },
  cues: [
    'iron-espalda:ejercicios.pullover-polea.cues.brazos',
    'iron-espalda:ejercicios.pullover-polea.cues.arco',
    'iron-espalda:ejercicios.pullover-polea.cues.tronco',
  ],
  errores: [
    'iron-espalda:ejercicios.pullover-polea.errores.codos',
    'iron-espalda:ejercicios.pullover-polea.errores.tronco',
  ],
};

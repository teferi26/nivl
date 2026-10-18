// NIVL · IRON · Face pull (cuerda en polea a la altura de la cara), de pie.
//
// Los brazos van de estirados hacia la polea a las manos delante de la
// frente, con los codos altos y abiertos (salen del plano: el brazo se ve
// corto al final). Trabaja la espalda alta y el deltoides posterior.
// Biomecánica (src/iron/__tests__/espalda.test.ts): el tronco no se mueve,
// al final el codo queda a la altura del hombro o por encima y las manos no
// tapan la cara (quedan delante de ella).

import type { Ejercicio } from '../../tipos';
import { ANCLA_DE_PIE, brazoHasta, desde, hombroEn, pose, type Absolutos } from './_pose';

const CUERPO = { tronco: 88, cabeza: 90, muslo: -88, pierna: -92, pie: 0 } as const;
const HOMBRO = hombroEn(ANCLA_DE_PIE, pose(0, { ...CUERPO, brazo: 0, antebrazo: 0 }));
const POLEA = { x: HOMBRO.x + 54, y: HOMBRO.y + 7 };

const E_DELANTE = { brazo: 0.97, antebrazo: 0.97 };
const E_MEDIO = { brazo: 0.7, antebrazo: 0.95 };
const E_FIN = { brazo: 0.42, antebrazo: 0.9 };

const hacia = (Math.atan2(POLEA.y - HOMBRO.y, POLEA.x - HOMBRO.x) * 180) / Math.PI;
const MANO_DELANTE = desde(HOMBRO, hacia, 35.8);
const MANO_FIN = { x: HOMBRO.x + 20, y: HOMBRO.y + 6 };
const MANO_MEDIO = { x: (MANO_DELANTE.x + MANO_FIN.x) / 2, y: (MANO_DELANTE.y + MANO_FIN.y) / 2 + 1.5 };

const conBrazos = (mano: { x: number; y: number }, e: { brazo: number; antebrazo: number }): Absolutos => ({
  ...CUERPO,
  // Con el brazo en el plano (delante) el codo dobla hacia abajo; al final, alto y abierto.
  ...brazoHasta(HOMBRO, mano, e.brazo >= 0.9, e),
});
const esc = (e: { brazo: number; antebrazo: number }) => ({
  escorzo: { brazo_c: e.brazo, brazo_l: e.brazo, antebrazo_c: e.antebrazo, antebrazo_l: e.antebrazo },
});

export const facePull: Ejercicio = {
  id: 'face-pull',
  nombre: 'iron-espalda:ejercicios.face-pull.nombre',
  grupo: 'espalda',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['polea'],
  musculos: {
    principales: ['espalda_alta', 'deltoides_posterior'],
    secundarios: ['trapecio', 'deltoides_lateral', 'biceps', 'antebrazo'],
  },
  sustitutos: ['remo-polea-sentado', 'remo-maquina'],
  vista: 'lateral',
  ancla: ANCLA_DE_PIE,
  poses: [
    pose(0, conBrazos(MANO_DELANTE, E_DELANTE), esc(E_DELANTE)),
    pose(400, conBrazos(MANO_DELANTE, E_DELANTE), esc(E_DELANTE)),
    pose(900, conBrazos(MANO_MEDIO, E_MEDIO), esc(E_MEDIO)),
    pose(1400, conBrazos(MANO_FIN, E_FIN), esc(E_FIN)),
    pose(1800, conBrazos(MANO_FIN, E_FIN), esc(E_FIN)),
    pose(2800, conBrazos(MANO_MEDIO, E_MEDIO), esc(E_MEDIO)),
  ],
  cicloMs: 3800,
  esfuerzo: [{ desde: 400, hasta: 1400 }],
  msFicha: 1100,
  carga: { tipo: 'polea', agarre: 'cuerda', polea: POLEA, lados: ['cerca'] },
  escenario: [{ tipo: 'polea', x: POLEA.x + 3, y: POLEA.y, hacia: -1, alto: POLEA.y + 14, capa: 'fondo' }],
  encuadre: { x: -26, y: -4, ancho: 96, alto: 112 },
  cues: [
    'iron-espalda:ejercicios.face-pull.cues.codos',
    'iron-espalda:ejercicios.face-pull.cues.cara',
    'iron-espalda:ejercicios.face-pull.cues.tronco',
  ],
  errores: [
    'iron-espalda:ejercicios.face-pull.errores.peso',
    'iron-espalda:ejercicios.face-pull.errores.codos',
  ],
};

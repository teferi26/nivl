// NIVL · IRON · Remo en polea a una mano, de pie (asa en D).
//
// De pie frente a la torre, rodillas sueltas y el tronco algo inclinado. Solo
// trabaja el brazo cercano: el asa va de estirada hacia la polea a la
// cintura, con el codo pegado al costado. El otro brazo descansa en la cadera.
// Biomecánica (src/iron/__tests__/espalda.test.ts): el tronco no gira ni se
// mueve, al final el codo pasa la línea de la espalda y el cable va del asa a
// la polea en cada cuadro.

import type { Ejercicio } from '../../tipos';
import { ANCLA_DE_PIE, brazoHasta, desde, hombroEn, pose, sobreTronco, type Absolutos } from './_pose';

const CUERPO = { tronco: 80, cabeza: 84, muslo: -82, pierna: -96, pie: 0 } as const;
const HOMBRO = hombroEn(ANCLA_DE_PIE, pose(0, { ...CUERPO, brazo: 0, antebrazo: 0 }));
const CADERA = desde(HOMBRO, CUERPO.tronco, -30);
const POLEA = { x: HOMBRO.x + 50, y: HOMBRO.y - 8 };

const hacia = (Math.atan2(POLEA.y - HOMBRO.y, POLEA.x - HOMBRO.x) * 180) / Math.PI;
const MANO_DELANTE = desde(HOMBRO, hacia, 35.4);
const MANO_FIN = sobreTronco(CADERA, CUERPO.tronco, 0.36, 4);
const MANO_MEDIO = { x: (MANO_DELANTE.x + MANO_FIN.x) / 2 + 1, y: (MANO_DELANTE.y + MANO_FIN.y) / 2 };

// La mano libre en la cadera: brazo algo atrás y el codo doblado.
const LIBRE: Absolutos = { ...CUERPO, brazo: CUERPO.tronco + 180 - 20, antebrazo: CUERPO.tronco + 180 - 20 + 95 };
const con = (mano: { x: number; y: number }): Absolutos => ({ ...CUERPO, ...brazoHasta(HOMBRO, mano, true) });
const p = (ms: number, a: Absolutos) => pose(ms, a, { lejos: LIBRE });

export const remoPoleaUnaMano: Ejercicio = {
  id: 'remo-polea-una-mano',
  nombre: 'iron-espalda:ejercicios.remo-polea-una-mano.nombre',
  grupo: 'espalda',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['polea'],
  musculos: {
    principales: ['dorsal'],
    secundarios: ['espalda_alta', 'deltoides_posterior', 'biceps', 'oblicuos'],
  },
  sustitutos: ['remo-mancuerna', 'remo-polea-sentado', 'remo-mancuernas'],
  vista: 'lateral',
  ancla: ANCLA_DE_PIE,
  poses: [p(0, con(MANO_DELANTE)), p(400, con(MANO_DELANTE)), p(850, con(MANO_MEDIO)), p(1300, con(MANO_FIN)), p(1650, con(MANO_FIN)), p(2500, con(MANO_MEDIO))],
  cicloMs: 3400,
  esfuerzo: [{ desde: 400, hasta: 1300 }],
  msFicha: 250,
  carga: { tipo: 'polea', agarre: 'asa', polea: POLEA, lados: ['cerca'] },
  escenario: [{ tipo: 'polea', x: POLEA.x + 3, y: POLEA.y, hacia: -1, alto: 108, capa: 'fondo' }],
  encuadre: { x: -26, y: -4, ancho: 90, alto: 112 },
  cues: [
    'iron-espalda:ejercicios.remo-polea-una-mano.cues.postura',
    'iron-espalda:ejercicios.remo-polea-una-mano.cues.codo',
    'iron-espalda:ejercicios.remo-polea-una-mano.cues.giro',
  ],
  errores: [
    'iron-espalda:ejercicios.remo-polea-una-mano.errores.giro',
    'iron-espalda:ejercicios.remo-polea-una-mano.errores.encoger',
  ],
};

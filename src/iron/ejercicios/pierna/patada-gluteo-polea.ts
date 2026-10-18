// NIVL · IRON · Patada de glúteo en polea baja, de pie, vista lateral.
//
// Ronda 2 (polea del equipo espalda, con tobillera). De pie frente a la
// torre, agarrado a ella y con el tronco algo inclinado, la pierna cercana
// lleva la tobillera enganchada al cable de la polea baja y se lleva hacia
// atrás estirando la cadera, sin arquear la zona lumbar. La pierna de apoyo
// (la lejana) no se mueve.
// Biomecánica (src/iron/__tests__/ronda2.test.ts): pie de apoyo plano y
// quieto, tronco quieto, la cadera que trabaja va de ≥ 5° de flexión a una
// extensión de 20 a 30° (sin pasar de -30), rodilla casi estirada, nada
// atraviesa el suelo.

import type { Ancla, Ejercicio } from '../../tipos';
import { brazoHasta, hombroEn, pose, type Absolutos } from '../espalda/_pose';

const r1 = (v: number) => Math.round(v * 10) / 10;
/** De pie sobre la pierna lejana: su tobillo en el suelo y el pie plano. */
const ANCLA: Ancla = { punto: 'tobillo_l', x: 0, y: 4, segmento: 'pie_l', angulo: 0 };
const TRONCO = 70;
const APOYO: Absolutos = { tronco: TRONCO, cabeza: 78, muslo: -88, pierna: -95, pie: 0, brazo: -60, antebrazo: -10 };
const HOMBRO = hombroEn(ANCLA, pose(0, APOYO, { lejos: APOYO }));
/** Las manos en el poste de la torre. */
const MANO = { x: HOMBRO.x + 25, y: HOMBRO.y - 10 };
const BRAZOS = brazoHasta(HOMBRO, MANO, true);
const POSTE_X = r1(MANO.x + 1.5);
export const POLEA_TOBILLO = { x: r1(POSTE_X - 3), y: 7 };

const pierna = (muslo: number, rodilla: number, tobillo: number): Absolutos => {
  const p = muslo - rodilla;
  return { ...APOYO, ...BRAZOS, muslo, pierna: p, pie: tobillo + p + 90 };
};
const DELANTE = pierna(-72, 30, 7);
const MEDIO = pierna(-104, 36, 44);
const ATRAS = pierna(-133, 8, -20);
// Al volver, la rodilla se dobla un poco para que el pie no roce el suelo.
const VUELTA = pierna(-86, 36, 27);
const APOYO_B: Absolutos = { ...APOYO, ...BRAZOS };
const p = (ms: number, a: Absolutos) => pose(ms, a, { lejos: APOYO_B });

export const patadaGluteoPolea: Ejercicio = {
  id: 'patada-gluteo-polea',
  nombre: 'iron-pierna:ejercicios.patada-gluteo-polea.nombre',
  grupo: 'pierna',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['polea'],
  musculos: {
    principales: ['gluteo'],
    secundarios: ['isquiotibiales', 'gluteo_medio', 'lumbares'],
  },
  sustitutos: ['patada-gluteo', 'hip-thrust', 'puente-gluteo-una-pierna'],
  vista: 'lateral',
  ancla: ANCLA,
  poses: [p(0, DELANTE), p(300, DELANTE), p(800, MEDIO), p(1300, ATRAS), p(1650, ATRAS), p(2400, MEDIO), p(2900, VUELTA)],
  cicloMs: 3300,
  esfuerzo: [{ desde: 300, hasta: 1300 }],
  msFicha: 1450,
  carga: { tipo: 'polea', agarre: 'tobillera', en: 'tobillo', polea: POLEA_TOBILLO, lados: ['cerca'] },
  escenario: [{ tipo: 'polea', x: POSTE_X, y: POLEA_TOBILLO.y, hacia: -1, alto: 100, capa: 'fondo' }],
  encuadre: { x: -44, y: -4, ancho: 96, alto: 104 },
  cues: [
    'iron-pierna:ejercicios.patada-gluteo-polea.cues.tronco',
    'iron-pierna:ejercicios.patada-gluteo-polea.cues.atras',
    'iron-pierna:ejercicios.patada-gluteo-polea.cues.lumbar',
  ],
  errores: [
    'iron-pierna:ejercicios.patada-gluteo-polea.errores.arquear',
    'iron-pierna:ejercicios.patada-gluteo-polea.errores.impulso',
  ],
};

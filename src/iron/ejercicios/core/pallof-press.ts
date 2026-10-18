// NIVL · IRON · Pallof press con banda elástica, de pie, vista frontal.
//
// Ronda 2 (banda del equipo hombro). La banda sale de un poste a un lado, a la
// altura del pecho, y tira de las manos hacia él. Se empuja el agarre al
// frente desde el esternón (los brazos van hacia la cámara: se ven cortos),
// se aguanta y se vuelve: el tronco no gira hacia la banda. Es un ejercicio
// de antirrotación: trabajan los oblicuos y el transverso.
// Biomecánica (src/iron/__tests__/ronda2.test.ts): caderas, hombros y pies
// quietos y simétricos, las manos juntas en el centro del pecho todo el ciclo,
// los brazos se acortan (escorzo) al empujar.

import { ikDosEslabones, normalizar } from '../../autor';
import { LARGO, MEDIA_ANCHURA } from '../../esqueleto';
import type { Ejercicio, Extremidades, Pose } from '../../tipos';
import { ANCLA_PIE_FRONTAL, PIERNAS_PIE_FRONTAL } from '../hombro/comun';

const r1 = (v: number) => Math.round(v * 10) / 10;
const HOMBRO_Y = ANCLA_PIE_FRONTAL.y + LARGO.tronco;

/**
 * Brazo de un lado (vista frontal: el cercano a la izquierda) para que el puño
 * caiga en `mano`, con el escorzo dado. El codo sale hacia fuera y abajo; en la
 * vista frontal un antebrazo que cruza hacia el centro es un codo «negativo»
 * (el convenio frontal abre hacia fuera), así que el antebrazo va algo hacia la
 * cámara (escorzo < 0,9): es lo que pasa con las manos en el esternón.
 */
function brazo(lado: 'c' | 'l', mano: { x: number; y: number }, eb: number, ea: number): Extremidades {
  const s = lado === 'c' ? -1 : 1;
  const hombro = { x: s * MEDIA_ANCHURA.hombro, y: HOMBRO_Y };
  const ik = ikDosEslabones(hombro, mano, LARGO.brazo * eb, LARGO.antebrazo * ea + LARGO.mano, lado === 'c');
  return {
    ...PIERNAS_PIE_FRONTAL,
    hombro: r1(normalizar(s * (ik.a1 - 270))),
    codo: r1(normalizar(s * (ik.a2 - ik.a1))),
  };
}

const PECHO = { eb: 0.95, ea: 0.8 };
const FUERA = { eb: 0.42, ea: 0.28 };
const MANO_PECHO = { x: 2.6, y: HOMBRO_Y - 15 };
const MANO_FUERA = { x: 1.2, y: HOMBRO_Y - 8 };
const pose = (ms: number, mano: { x: number; y: number }, e: { eb: number; ea: number }): Pose => ({
  ms,
  cuello: 0,
  cerca: brazo('c', { x: -mano.x, y: mano.y }, e.eb, e.ea),
  lejos: brazo('l', mano, e.eb, e.ea),
  escorzo: { brazo_c: e.eb, brazo_l: e.eb, antebrazo_c: e.ea, antebrazo_l: e.ea },
});
/** El poste de la banda, a la derecha (lado lejano), a la altura del pecho. */
export const ANCLAJE_PALLOF = { x: 56, y: r1(HOMBRO_Y - 12) };

export const pallofPress: Ejercicio = {
  id: 'pallof-press',
  nombre: 'iron-core:ejercicios.pallof-press.nombre',
  grupo: 'core',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['banda'],
  musculos: {
    principales: ['oblicuos', 'transverso'],
    secundarios: ['abdomen', 'gluteo_medio', 'deltoides_anterior'],
  },
  sustitutos: ['plancha-lateral', 'dead-bug', 'bird-dog'],
  vista: 'frontal',
  ancla: ANCLA_PIE_FRONTAL,
  poses: [pose(0, MANO_PECHO, PECHO), pose(400, MANO_PECHO, PECHO), pose(1200, MANO_FUERA, FUERA), pose(2400, MANO_FUERA, FUERA), pose(3200, MANO_PECHO, PECHO)],
  cicloMs: 3600,
  esfuerzo: [{ desde: 400, hasta: 2400 }],
  msFicha: 1800,
  carga: { tipo: 'banda', en: 'agarre', lados: ['lejos'], anclaje: ANCLAJE_PALLOF },
  encuadre: { x: -46, y: -4, ancho: 110, alto: 124 },
  cues: [
    'iron-core:ejercicios.pallof-press.cues.tronco',
    'iron-core:ejercicios.pallof-press.cues.empuje',
    'iron-core:ejercicios.pallof-press.cues.pausa',
  ],
  errores: [
    'iron-core:ejercicios.pallof-press.errores.girar',
    'iron-core:ejercicios.pallof-press.errores.cerca',
  ],
};

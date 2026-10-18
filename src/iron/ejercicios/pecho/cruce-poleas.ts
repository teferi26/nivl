// NIVL · IRON · Pecho · Cruce de poleas (de arriba abajo), de pie, vista lateral.
//
// Ronda 2 (polea del equipo espalda). Entre dos torres con las poleas altas,
// un paso adelante y el tronco algo inclinado. Los brazos, con el codo un
// poco doblado y fijo, bajan en arco desde abiertos (a la altura de los
// hombros, fuera del plano: se ven cortos) hasta juntar las manos delante de
// la parte baja del pecho. De perfil las dos torres se ven como una, al fondo:
// se dibuja el cable del lado lejano, que pasa por detrás del cuerpo.
// Biomecánica (src/iron/__tests__/ronda2.test.ts): tronco y piernas quietos,
// el codo apenas cambia (abrazo fijo), las manos acaban por delante y por
// debajo del hombro, el cable no cruza la cabeza.

import type { Ejercicio } from '../../tipos';
import { ANCLA_DE_PIE, brazoHasta, desde, hombroEn, pose, type Absolutos } from '../espalda/_pose';

const r1 = (v: number) => Math.round(v * 10) / 10;
const CUERPO = { tronco: 74, cabeza: 80, muslo: -84, pierna: -96, pie: 0 } as const;
const HOMBRO = hombroEn(ANCLA_DE_PIE, pose(0, { ...CUERPO, brazo: -90, antebrazo: -90 }));
/** Las poleas, altas, sobre la cabeza (de perfil las dos torres quedan a los lados, en el fondo). */
export const POLEA_ALTA = { x: r1(HOMBRO.x + 4), y: r1(HOMBRO.y + 36) };

// Abiertos: la mano a la altura del hombro, el brazo casi de punta (sale del plano).
const E_ABIERTO = { brazo: 0.35, antebrazo: 0.55 };
const E_MEDIO = { brazo: 0.75, antebrazo: 0.85 };
const E_CERRADO = { brazo: 0.97, antebrazo: 0.97 };
const MANO_ABIERTO = desde(HOMBRO, 20, 14);
const MANO_MEDIO = desde(HOMBRO, -18, 25);
const MANO_CERRADO = desde(HOMBRO, -46, 33);
const brazos = (mano: { x: number; y: number }, e: { brazo: number; antebrazo: number }): Absolutos => ({
  ...CUERPO,
  ...brazoHasta(HOMBRO, mano, true, e),
});
const p = (ms: number, mano: { x: number; y: number }, e: { brazo: number; antebrazo: number }) =>
  pose(ms, brazos(mano, e), { escorzo: { brazo_c: e.brazo, brazo_l: e.brazo, antebrazo_c: e.antebrazo, antebrazo_l: e.antebrazo } });

export const crucePoleas: Ejercicio = {
  id: 'cruce-poleas',
  nombre: 'iron-pecho:ejercicios.cruce-poleas.nombre',
  grupo: 'pecho',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['polea'],
  musculos: {
    principales: ['pectoral'],
    secundarios: ['deltoides_anterior', 'pectoral_superior', 'biceps'],
  },
  sustitutos: ['aperturas-mancuerna', 'pec-deck', 'aperturas-inclinado-mancuerna'],
  vista: 'lateral',
  ancla: ANCLA_DE_PIE,
  poses: [
    p(0, MANO_ABIERTO, E_ABIERTO),
    p(400, MANO_ABIERTO, E_ABIERTO),
    p(1000, MANO_MEDIO, E_MEDIO),
    p(1500, MANO_CERRADO, E_CERRADO),
    p(1850, MANO_CERRADO, E_CERRADO),
    p(2800, MANO_MEDIO, E_MEDIO),
  ],
  cicloMs: 3800,
  esfuerzo: [{ desde: 400, hasta: 1500 }],
  msFicha: 550,
  carga: { tipo: 'polea', agarre: 'asa', polea: POLEA_ALTA, lados: ['lejos'] },
  escenario: [{ tipo: 'polea', x: r1(POLEA_ALTA.x - 3), y: POLEA_ALTA.y, hacia: 1, alto: r1(POLEA_ALTA.y + 8), capa: 'fondo' }],
  encuadre: { x: -40, y: -4, ancho: 88, alto: 130 },
  cues: [
    'iron-pecho:ejercicios.cruce-poleas.cues.codos',
    'iron-pecho:ejercicios.cruce-poleas.cues.arco',
    'iron-pecho:ejercicios.cruce-poleas.cues.vuelta',
  ],
  errores: [
    'iron-pecho:ejercicios.cruce-poleas.errores.press',
    'iron-pecho:ejercicios.cruce-poleas.errores.tronco',
  ],
};

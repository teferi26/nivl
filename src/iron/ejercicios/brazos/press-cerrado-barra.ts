// NIVL · IRON · Press de banca con agarre cerrado, vista lateral (cabeza a la izquierda).
//
// Agarre algo más estrecho que los hombros y codos pegados (unos 30 a 45° del
// tronco): el tríceps hace la mayor parte del trabajo.
// Biomecánica (comprobada en src/iron/__tests__/brazos.test.ts):
// · Antebrazos verticales todo el recorrido (±15°).
// · La barra toca la parte baja del pecho y acaba sobre los hombros.
// · Glúteos, espalda alta y cabeza en el banco; pies planos.
// Los codos salen poco del plano: el brazo se ve casi entero (escorzo de 0,7
// a 0,95). Cada pose está despejada con el antebrazo vertical bajo la barra.

import type { Ejercicio, Pose } from '../../tipos';
import { ANCLA_TUMBADO, BANCO_TUMBADO, TUMBADO, textos } from './comun';

interface Paso {
  hombro: number;
  codo: number;
  brazo: number;
}
// De arriba (bloqueo) a abajo (pecho).
const ARRIBA: Paso = { hombro: 89.5, codo: -3, brazo: 0.95 };
const P3: Paso = { hombro: 58.5, codo: 28, brazo: 0.86 };
const P2: Paso = { hombro: 24.5, codo: 62, brazo: 0.78 };
const P1: Paso = { hombro: -11.5, codo: 98, brazo: 0.73 };
const ABAJO: Paso = { hombro: -33.5, codo: 120, brazo: 0.7 };

function pose(ms: number, p: Paso): Pose {
  return {
    ms,
    cuello: 0,
    cerca: { ...TUMBADO, hombro: p.hombro, codo: p.codo },
    escorzo: { brazo_c: p.brazo, brazo_l: p.brazo },
  };
}

const T = textos('press-cerrado-barra', ['agarre', 'codos', 'trayectoria', 'seguridad'], ['codosAbiertos', 'rebote', 'munecas']);

export const pressCerradoBarra: Ejercicio = {
  id: 'press-cerrado-barra',
  nombre: T.nombre,
  grupo: 'brazo',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['barra', 'banco'],
  musculos: { principales: ['triceps'], secundarios: ['pectoral', 'deltoides_anterior'] },
  sustitutos: ['press-cerrado-mancuerna', 'fondos-banco', 'flexiones-diamante'],
  vista: 'lateral',
  ancla: ANCLA_TUMBADO,
  poses: [
    pose(0, ARRIBA),
    pose(500, ARRIBA),
    pose(1000, P3),
    pose(1550, P2),
    pose(2100, P1),
    pose(2600, ABAJO),
    pose(2900, ABAJO),
    pose(3200, P1),
    pose(3500, P2),
    pose(3800, P3),
    pose(4150, ARRIBA),
  ],
  cicloMs: 4500,
  esfuerzo: [{ desde: 2900, hasta: 4150 }],
  // Abajo el brazo tapa el tríceps: la ficha enseña la barra arriba.
  msFicha: 250,
  carga: { tipo: 'barra', en: 'agarre', disco: 8, eje: { x: -3, y: 10 } },
  escenario: [BANCO_TUMBADO],
  encuadre: { x: -66, y: -4, ancho: 104, alto: 96 },
  cues: T.cues,
  errores: T.errores,
};

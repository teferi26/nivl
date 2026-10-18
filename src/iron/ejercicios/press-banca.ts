// NIVL · IRON · Press de banca con barra, vista lateral (cabeza a la izquierda).
//
// Biomecánica (comprobada en src/iron/__tests__/biomecanica.test.ts):
// · La barra toca la parte baja del pecho y sube en una «J» suave hasta
//   quedar sobre los hombros.
// · Antebrazos verticales todo el recorrido (±15°).
// · Codos a unos 45 a 60° del tronco: el brazo sale del plano y se ve corto
//   (escorzo), por eso los ángulos de hombro y codo son los del dibujo.
// · Glúteos, espalda alta y cabeza en el banco; pies planos en el suelo.
// Cada pose clave está despejada para que el antebrazo quede vertical bajo
// la barra (ver docs/modos/F1-motor.md).

import type { Ejercicio, Extremidades, Pose, SegmentoId } from '../tipos';

const PIERNAS = { cadera: -12, rodilla: 92.1, tobillo: 12.1 } as const;

interface Paso {
  hombro: number;
  codo: number;
  brazo: number;
  antebrazo: number;
}
// De arriba (bloqueo) a abajo (pecho).
const ARRIBA: Paso = { hombro: 88.7, codo: 1, brazo: 0.94, antebrazo: 0.95 };
const P3: Paso = { hombro: 77.3, codo: 10.7, brazo: 0.52, antebrazo: 0.96 };
const P2: Paso = { hombro: 18.6, codo: 69.4, brazo: 0.25, antebrazo: 0.98 };
const P1: Paso = { hombro: -38.4, codo: 126.4, brazo: 0.46, antebrazo: 0.99 };
const ABAJO: Paso = { hombro: -52.5, codo: 140.5, brazo: 0.71, antebrazo: 1 };

function pose(ms: number, p: Paso): Pose {
  const cerca: Extremidades = { ...PIERNAS, hombro: p.hombro, codo: p.codo };
  const escorzo: Partial<Record<SegmentoId, number>> = {
    brazo_c: p.brazo,
    brazo_l: p.brazo,
    antebrazo_c: p.antebrazo,
    antebrazo_l: p.antebrazo,
  };
  return { ms, cuello: 0, cerca, escorzo };
}

export const pressBanca: Ejercicio = {
  id: 'press-banca',
  nombre: 'iron:ejercicios.press-banca.nombre',
  grupo: 'pecho',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['barra', 'banco'],
  musculos: {
    principales: ['pectoral'],
    secundarios: ['deltoides_anterior', 'triceps'],
  },
  sustitutos: [],
  vista: 'lateral',
  ancla: { punto: 'cadera', x: 0, y: 32.2, segmento: 'tronco', angulo: 182 },
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
  carga: { tipo: 'barra', en: 'agarre' },
  escenario: [{ tipo: 'banco', x: -54, ancho: 68, alto: 24.6, capa: 'medio' }],
  encuadre: { x: -66, y: -4, ancho: 104, alto: 88 },
  cues: [
    'iron:ejercicios.press-banca.cues.apoyos',
    'iron:ejercicios.press-banca.cues.escapulas',
    'iron:ejercicios.press-banca.cues.trayectoria',
    'iron:ejercicios.press-banca.cues.seguridad',
  ],
  errores: [
    'iron:ejercicios.press-banca.errores.codos',
    'iron:ejercicios.press-banca.errores.rebote',
    'iron:ejercicios.press-banca.errores.gluteos',
  ],
};

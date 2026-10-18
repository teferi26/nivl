// NIVL · IRON · Motor: interpolación entre poses clave.
//
// `angulosEn(ejercicio, ms)` da los ángulos de cualquier instante del ciclo.
// Cada ángulo se interpola por separado con una curva cúbica monótona
// (Hermite con tangentes de Fritsch y Carlson) a través de todas las poses
// clave, en bucle: el movimiento pasa por las poses intermedias sin frenar,
// arranca y frena suave en los extremos (donde el ángulo cambia de sentido) y
// nunca se pasa de una pose (sin rebotes imposibles). Dos poses iguales
// seguidas son una pausa quieta. Puro y 'worklet'.

import type { AngulosPose } from './esqueleto';
import { ARTICULACIONES, type Ejercicio, type Extremidades, type Pose, type SegmentoId } from './tipos';

type Lector = (p: Pose) => number;

function tiempo(poses: readonly Pose[], ciclo: number, k: number): number {
  'worklet';
  const n = poses.length;
  const vueltas = Math.floor(k / n);
  const i = ((k % n) + n) % n;
  return poses[i].ms + vueltas * ciclo;
}

function valor(poses: readonly Pose[], k: number, leer: Lector): number {
  'worklet';
  const n = poses.length;
  return leer(poses[((k % n) + n) % n]);
}

function pendiente(poses: readonly Pose[], ciclo: number, k: number, leer: Lector): number {
  'worklet';
  const dt = tiempo(poses, ciclo, k + 1) - tiempo(poses, ciclo, k);
  return dt > 0 ? (valor(poses, k + 1, leer) - valor(poses, k, leer)) / dt : 0;
}

/** Tangente en la pose k: 0 si es un extremo o una pausa; si no, la media acotada. */
function tangente(poses: readonly Pose[], ciclo: number, k: number, leer: Lector): number {
  'worklet';
  const a = pendiente(poses, ciclo, k - 1, leer);
  const b = pendiente(poses, ciclo, k, leer);
  if (a * b <= 0) return 0;
  const m = (a + b) / 2;
  const tope = 3 * Math.min(Math.abs(a), Math.abs(b));
  return Math.abs(m) > tope ? Math.sign(m) * tope : m;
}

/** Un canal (un ángulo) en el instante t, sabiendo que t cae entre la pose k y la k+1. */
function canal(poses: readonly Pose[], ciclo: number, k: number, t: number, leer: Lector): number {
  'worklet';
  const t0 = tiempo(poses, ciclo, k);
  const t1 = tiempo(poses, ciclo, k + 1);
  const h = t1 - t0;
  const v0 = valor(poses, k, leer);
  const v1 = valor(poses, k + 1, leer);
  if (h <= 0) return v0;
  const s = Math.min(1, Math.max(0, (t - t0) / h));
  const m0 = tangente(poses, ciclo, k, leer) * h;
  const m1 = tangente(poses, ciclo, k + 1, leer) * h;
  const s2 = s * s;
  const s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * v0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * v1 + (s3 - s2) * m1;
}

const SEGMENTOS_ESCORZO: readonly SegmentoId[] = [
  'tronco',
  'cabeza',
  'muslo_c',
  'pierna_c',
  'pie_c',
  'brazo_c',
  'antebrazo_c',
  'muslo_l',
  'pierna_l',
  'pie_l',
  'brazo_l',
  'antebrazo_l',
];

/** Ángulos de una pose clave tal cual (sin mezclar). */
export function angulosDePose(ej: Pick<Ejercicio, 'ancla'>, pose: Pose): AngulosPose {
  'worklet';
  return {
    cuello: pose.cuello,
    cerca: pose.cerca,
    lejos: pose.lejos ?? pose.cerca,
    angulo: pose.angulo ?? ej.ancla.angulo,
    escorzo: pose.escorzo ?? {},
    punto: pose.punto,
  };
}

/** Los ángulos en el instante `ms` (se repite cada `cicloMs`). */
export function angulosEn(ej: Ejercicio, ms: number): AngulosPose {
  'worklet';
  const poses = ej.poses;
  const ciclo = ej.cicloMs;
  const t = ((ms % ciclo) + ciclo) % ciclo;
  let k = poses.length - 1;
  for (let i = 0; i < poses.length; i++) if (poses[i].ms <= t) k = i;
  const anclaAng = ej.ancla.angulo;
  // El ancla solo se mueve si alguna pose lo dice (saltos, burpees).
  let movil = false;
  for (let i = 0; i < poses.length; i++) if (poses[i].punto !== undefined) movil = true;

  const cerca: Record<string, number> = {};
  const lejos: Record<string, number> = {};
  for (let i = 0; i < ARTICULACIONES.length; i++) {
    const a = ARTICULACIONES[i];
    cerca[a] = canal(poses, ciclo, k, t, (p) => p.cerca[a]);
    lejos[a] = canal(poses, ciclo, k, t, (p) => (p.lejos ?? p.cerca)[a]);
  }
  const escorzo: Partial<Record<SegmentoId, number>> = {};
  for (let i = 0; i < SEGMENTOS_ESCORZO.length; i++) {
    const s = SEGMENTOS_ESCORZO[i];
    let usado = false;
    for (let j = 0; j < poses.length; j++) if (poses[j].escorzo?.[s] !== undefined) usado = true;
    if (usado) escorzo[s] = canal(poses, ciclo, k, t, (p) => p.escorzo?.[s] ?? 1);
  }
  return {
    cuello: canal(poses, ciclo, k, t, (p) => p.cuello),
    cerca: cerca as unknown as Extremidades,
    lejos: lejos as unknown as Extremidades,
    angulo: canal(poses, ciclo, k, t, (p) => p.angulo ?? anclaAng),
    escorzo,
    punto: movil
      ? { x: canal(poses, ciclo, k, t, (p) => (p.punto ?? ej.ancla).x), y: canal(poses, ciclo, k, t, (p) => (p.punto ?? ej.ancla).y) }
      : undefined,
  };
}

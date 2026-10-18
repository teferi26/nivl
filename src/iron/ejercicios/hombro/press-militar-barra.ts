// NIVL · IRON · Hombro · Press militar con barra, de pie, vista lateral.
//
// Biomecánica (src/iron/__tests__/hombro.test.ts):
// · La barra sale de la clavícula y sube casi recta hasta quedar sobre el
//   medio del pie con los brazos estirados (bloqueo).
// · Antebrazos verticales bajo la barra en todo el recorrido (±15°). Los
//   codos van un poco por delante y hacia fuera: el brazo sale del plano y se
//   ve corto (escorzo) en la mitad del recorrido.
// · La cabeza se aparta hacia atrás cuando la barra pasa por la cara y vuelve
//   a su sitio arriba («meter la cabeza»). Tronco vertical: sin arquear.
// Cada paso está despejado con el antebrazo vertical (ver F1-motor.md).

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

export interface PasoPress {
  hombro: number;
  codo: number;
  brazo: number;
  cuello: number;
}

/** De la clavícula (abajo) al bloqueo (arriba), con la persona de pie. */
export const PASOS_PRESS: readonly PasoPress[] = [
  { hombro: 16.2, codo: 155.8, brazo: 0.89, cuello: 0 },
  { hombro: 29.9, codo: 150.1, brazo: 0.78, cuello: -8 },
  { hombro: 39.4, codo: 140.6, brazo: 0.59, cuello: -18 },
  { hombro: 58.8, codo: 121.2, brazo: 0.42, cuello: -22 },
  { hombro: 95, codo: 85, brazo: 0.32, cuello: -20 },
  { hombro: 138.6, codo: 41.4, brazo: 0.4, cuello: -8 },
  { hombro: 159.3, codo: 20.7, brazo: 0.61, cuello: 0 },
  { hombro: 169.6, codo: 10.4, brazo: 0.98, cuello: 3 },
];

export const PIERNAS_PIE = { tobillo: 2, rodilla: 3, cadera: 1 } as const;

export function posePress(ms: number, p: PasoPress, piernas: Pick<Extremidades, 'cadera' | 'rodilla' | 'tobillo'> = PIERNAS_PIE): Pose {
  const cerca: Extremidades = { ...piernas, hombro: p.hombro, codo: p.codo };
  return { ms, cuello: p.cuello, cerca, escorzo: { brazo_c: p.brazo, brazo_l: p.brazo } };
}

/** Subida en `subida` ms desde `t0` y bajada en `bajada` ms desde `t1`. */
function recorrido(t0: number, subida: number, t1: number, bajada: number): Pose[] {
  const n = PASOS_PRESS.length - 1;
  const out: Pose[] = [];
  for (let i = 0; i <= n; i++) out.push(posePress(t0 + Math.round((subida * i) / n), PASOS_PRESS[i]));
  for (let i = n - 1; i >= 1; i--) out.push(posePress(t1 + Math.round((bajada * (n - i)) / n), PASOS_PRESS[i]));
  return out;
}

export const pressMilitarBarra: Ejercicio = {
  id: 'press-militar-barra',
  nombre: 'iron-hombro:ejercicios.press-militar-barra.nombre',
  grupo: 'hombro',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['barra'],
  musculos: {
    principales: ['deltoides_anterior'],
    secundarios: ['deltoides_lateral', 'triceps', 'trapecio', 'abdomen'],
  },
  sustitutos: ['press-militar-mancuerna', 'push-press', 'press-banda'],
  vista: 'lateral',
  ancla: { punto: 'tobillo_c', x: 0, y: 4, segmento: 'pie_c', angulo: 0 },
  poses: [posePress(0, PASOS_PRESS[0]), ...recorrido(300, 1100, 1700, 1700)],
  cicloMs: 3700,
  esfuerzo: [{ desde: 300, hasta: 1400 }],
  // A media subida: el deltoides anterior se ve entero y la barra libra la cara.
  msFicha: 760,
  // Cámara en 3/4: el disco cercano, delante y abajo, lejos de la cara.
  carga: { tipo: 'barra', en: 'agarre', disco: 8.5, eje: { x: 13, y: -6 } },
  encuadre: { x: -40, y: -4, ancho: 84, alto: 132 },
  cues: [
    'iron-hombro:ejercicios.press-militar-barra.cues.abdomen',
    'iron-hombro:ejercicios.press-militar-barra.cues.trayectoria',
    'iron-hombro:ejercicios.press-militar-barra.cues.cabeza',
    'iron-hombro:ejercicios.press-militar-barra.cues.bloqueo',
  ],
  errores: [
    'iron-hombro:ejercicios.press-militar-barra.errores.arco',
    'iron-hombro:ejercicios.press-militar-barra.errores.codos',
    'iron-hombro:ejercicios.press-militar-barra.errores.lejos',
  ],
};

// NIVL · IRON · Hombro · Flexión en pica (pike push-up), peso corporal, vista lateral.
//
// Manos y pies en el suelo y la cadera arriba: el cuerpo es una «V»
// invertida y el empuje va hacia arriba, sobre los hombros. Opción para casa
// del press militar.
// Biomecánica (src/iron/__tests__/hombro.test.ts):
// · Manos quietas en el suelo (ancla en el agarre); la cadera se queda arriba
//   (≥ 44) todo el recorrido.
// · La cabeza baja hacia el suelo por delante de las manos sin tocarlo.
// · Arriba, brazos casi estirados (codo ≤ 10°).
// Cada pose está despejada con las manos y los pies fijos (IK de dos
// eslabones desde la cadera y el hombro; ver F1-motor.md).

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

interface PasoPica {
  angulo: number;
  cuello: number;
  e: Extremidades;
}
const paso = (angulo: number, cuello: number, hombro: number, codo: number, cadera: number, rodilla: number, tobillo: number): PasoPica => ({
  angulo,
  cuello,
  e: { hombro, codo, cadera, rodilla, tobillo },
});

// De arriba abajo; manos en (0, 2,4) y tobillo en (-42, 4).
const BAJADA: readonly PasoPica[] = [
  paso(-95.7, 0, 94.8, 8.4, 90.1, 10.7, 29.5),
  paso(-77.3, -2, 80.3, 46.5, 95, 12.4, 31.5),
  paso(-67.4, -5, 75.8, 66.2, 100.3, 14.4, 33.5),
  paso(-59.1, -8, 74.4, 81.6, 104.6, 13.5, 34),
  paso(-52.5, -10, 74.7, 92.9, 108.5, 13.2, 34.8),
  paso(-43.5, -12, 78.4, 104.3, 113.8, 12.8, 35.2),
  paso(-32.7, -15, 85.9, 114.6, 119.7, 12.2, 35.6),
];
const ARRIBA = BAJADA[0];

export const posePica = (ms: number, p: PasoPica): Pose => ({ ms, cuello: p.cuello, cerca: p.e, angulo: p.angulo });

/** Bajada lenta de 300 a 1700 ms, pausa abajo y subida de 1900 al final del ciclo. */
export function cicloPica<T>(pasos: readonly T[], pose: (ms: number, p: T) => Pose): Pose[] {
  const n = pasos.length - 1;
  const out: Pose[] = [pose(0, pasos[0])];
  for (let i = 0; i <= n; i++) out.push(pose(300 + Math.round((1400 * i) / n), pasos[i]));
  for (let i = n; i >= 1; i--) out.push(pose(1900 + Math.round((1100 * (n - i)) / n), pasos[i]));
  return out;
}

export const flexionPica: Ejercicio = {
  id: 'flexion-pica',
  nombre: 'iron-hombro:ejercicios.flexion-pica.nombre',
  grupo: 'hombro',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['peso_corporal'],
  musculos: {
    principales: ['deltoides_anterior'],
    secundarios: ['triceps', 'deltoides_lateral', 'pectoral', 'trapecio'],
  },
  sustitutos: ['flexion-pica-pies-elevados', 'press-banda', 'press-militar-mancuerna'],
  vista: 'lateral',
  ancla: { punto: 'agarre_c', x: 0, y: 2.4, segmento: 'antebrazo_c', angulo: ARRIBA.angulo },
  poses: cicloPica(BAJADA, posePica),
  cicloMs: 3200,
  esfuerzo: [{ desde: 1900, hasta: 3200 }],
  msFicha: 1000,
  encuadre: { x: -54, y: -4, ancho: 84, alto: 68 },
  cues: [
    'iron-hombro:ejercicios.flexion-pica.cues.cadera',
    'iron-hombro:ejercicios.flexion-pica.cues.cabeza',
    'iron-hombro:ejercicios.flexion-pica.cues.codos',
  ],
  errores: [
    'iron-hombro:ejercicios.flexion-pica.errores.cadera',
    'iron-hombro:ejercicios.flexion-pica.errores.golpe',
  ],
};

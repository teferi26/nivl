// NIVL · IRON · Burpees, vista lateral.
//
// De pie, cuclillas con las manos en el suelo, salto atrás a plancha alta,
// salto adelante a cuclillas, de pie y salto vertical con los brazos arriba.
// Biomecánica (comprobada en src/iron/__tests__/core.test.ts):
// · Las manos apoyan delante de los pies y no se mueven mientras están en
//   el suelo (de las cuclillas a la plancha y vuelta: ±1,5).
// · En la plancha, hombro, cadera y tobillo en línea y la mano bajo el hombro.
// · En el salto, los pies se despegan del suelo y los brazos suben.
// · Aterrizaje con las rodillas dobladas.
// El ancla es el tobillo y se mueve (`punto`); `angulo` es el del pie. Las
// poses están despejadas por IK: manos en (16; 2,4) y pies apoyados en el
// suelo cuando toca.

import type { Ejercicio, Pose } from '../../tipos';

type Instante = Omit<Pose, 'ms'>;

const DE_PIE: Instante = { punto: { x: 0, y: 4 }, angulo: 0, cuello: 0, cerca: { cadera: 0, rodilla: 0, tobillo: 0, hombro: 5, codo: 10 } };
/** Cuclillas sobre las puntas, manos en el suelo. */
const AGACHA: Instante = {
  punto: { x: -0.4, y: 9.5 },
  angulo: -30,
  cuello: -10,
  cerca: { cadera: 146.6, rodilla: 149.1, tobillo: 28.5, hombro: 41.1, codo: 14.6 },
};
const PLANCHA: Instante = {
  punto: { x: -58.1, y: 12 },
  angulo: -89.8,
  cuello: 0,
  cerca: { cadera: 1.1, rodilla: 2.3, tobillo: -18.9, hombro: 69.7, codo: 0 },
};
/**
 * El salto atrás de las cuclillas a la plancha, cuadro a cuadro: manos fijas
 * en (16; 2,4) y el tobillo en arco por el aire (despejado por IK). La vuelta
 * recorre los mismos cuadros al revés.
 */
const VUELO: readonly Instante[] = [
  { punto: { x: -8, y: 14 }, angulo: -63, cuello: 0, cerca: { cadera: 132.7, rodilla: 148.9, tobillo: 20.2, hombro: 51.6, codo: 13.2 } },
  { punto: { x: -18.1, y: 14.1 }, angulo: -96.2, cuello: 0, cerca: { cadera: 91.1, rodilla: 143.8, tobillo: 18.7, hombro: 53, codo: 9.5 } },
  { punto: { x: -30.6, y: 15.5 }, angulo: -114.8, cuello: 0, cerca: { cadera: 62.9, rodilla: 121.3, tobillo: 8.5, hombro: 58.2, codo: 7.4 } },
  { punto: { x: -42.4, y: 15.9 }, angulo: -118.4, cuello: 0, cerca: { cadera: 43.5, rodilla: 92.3, tobillo: -2.5, hombro: 62.8, codo: 5.3 } },
  { punto: { x: -51.6, y: 15.2 }, angulo: -114, cuello: 0, cerca: { cadera: 27.3, rodilla: 60.6, tobillo: -12, hombro: 66.5, codo: 2.9 } },
  { punto: { x: -57, y: 13.5 }, angulo: -102.5, cuello: 0, cerca: { cadera: 12.1, rodilla: 27.4, tobillo: -17.7, hombro: 69.4, codo: 0 } },
];

const SUBE: Instante = { punto: { x: 0, y: 4 }, angulo: 0, cuello: -5, cerca: { cadera: 75.3, rodilla: 85, tobillo: 37.7, hombro: 40, codo: 20 } };
const PUNTAS: Instante = {
  punto: { x: 6.3, y: 11.3 },
  angulo: -45,
  cuello: 0,
  cerca: { cadera: 28.9, rodilla: 41.5, tobillo: -28.4, hombro: 120, codo: 10 },
};
const SALTO: Instante = {
  punto: { x: 3, y: 18 },
  angulo: -55,
  cuello: 0,
  cerca: { cadera: 15.7, rodilla: 22.7, tobillo: -46, hombro: 140, codo: 10 },
};
const ATERRIZA: Instante = {
  punto: { x: 0, y: 4 },
  angulo: 0,
  cuello: -5,
  cerca: { cadera: 42.8, rodilla: 51.2, tobillo: 20.4, hombro: 40, codo: 20 },
};

const en = (ms: number, p: Instante): Pose => ({ ms, ...p });

/**
 * El pie girando sobre la punta (la punta de la planta queda en (12, 0)); el
 * cuerpo, a la fracción `u` del camino entre `a` y `b`.
 */
function sobrePunta(phi: number, a: Instante, b: Instante, u: number): Instante {
  const r = (phi * Math.PI) / 180;
  const m = (x: number, y: number) => Math.round((x + (y - x) * u) * 10) / 10;
  return {
    punto: { x: Math.round((12 - 12 * Math.cos(r) - 4 * Math.sin(r)) * 100) / 100, y: Math.round((-12 * Math.sin(r) + 4 * Math.cos(r)) * 100) / 100 },
    angulo: phi,
    cuello: m(a.cuello, b.cuello),
    cerca: {
      cadera: m(a.cerca.cadera, b.cerca.cadera),
      rodilla: m(a.cerca.rodilla, b.cerca.rodilla),
      tobillo: m(a.cerca.tobillo, b.cerca.tobillo),
      hombro: m(a.cerca.hombro, b.cerca.hombro),
      codo: m(a.cerca.codo, b.cerca.codo),
    },
  };
}

export const burpees: Ejercicio = {
  id: 'burpees',
  nombre: 'iron-core:ejercicios.burpees.nombre',
  grupo: 'cardio',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['peso_corporal'],
  musculos: {
    principales: ['cuadriceps', 'gluteo'],
    secundarios: ['pectoral', 'deltoides_anterior', 'triceps', 'abdomen', 'gemelos'],
  },
  sustitutos: ['sentadilla-salto', 'mountain-climbers', 'saltos-tijera'],
  vista: 'lateral',
  ancla: { punto: 'tobillo_c', x: 0, y: 4, segmento: 'pie_c', angulo: 0 },
  poses: [
    en(0, DE_PIE),
    en(200, DE_PIE),
    en(450, sobrePunta(-10, DE_PIE, AGACHA, 0.5)),
    en(580, sobrePunta(-20, DE_PIE, AGACHA, 0.78)),
    en(700, AGACHA),
    ...VUELO.map((p, i) => en(770 + i * 65, p)),
    en(1150, PLANCHA),
    en(1450, PLANCHA),
    ...[...VUELO].reverse().map((p, i) => en(1490 + i * 58, p)),
    en(1850, AGACHA),
    en(2000, sobrePunta(-20, AGACHA, SUBE, 0.35)),
    en(2120, sobrePunta(-10, AGACHA, SUBE, 0.7)),
    en(2250, SUBE),
    en(2350, sobrePunta(-15, SUBE, PUNTAS, 0.33)),
    en(2450, sobrePunta(-30, SUBE, PUNTAS, 0.67)),
    en(2550, PUNTAS),
    en(2750, SALTO),
    en(2950, { ...PUNTAS, cerca: { ...PUNTAS.cerca, hombro: 80 } }),
    en(3030, sobrePunta(-30, { ...PUNTAS, cerca: { ...PUNTAS.cerca, hombro: 80 } }, ATERRIZA, 0.33)),
    en(3110, sobrePunta(-15, { ...PUNTAS, cerca: { ...PUNTAS.cerca, hombro: 80 } }, ATERRIZA, 0.67)),
    en(3200, ATERRIZA),
  ],
  cicloMs: 3600,
  esfuerzo: [{ desde: 2250, hasta: 2750 }],
  msFicha: 1300,
  encuadre: { x: -76, y: -4, ancho: 124, alto: 138 },
  cues: [
    'iron-core:ejercicios.burpees.cues.manos',
    'iron-core:ejercicios.burpees.cues.plancha',
    'iron-core:ejercicios.burpees.cues.salto',
  ],
  errores: [
    'iron-core:ejercicios.burpees.errores.cadera',
    'iron-core:ejercicios.burpees.errores.aterrizaje',
  ],
};

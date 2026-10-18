// NIVL · IRON · Hombro · Pájaro con mancuernas (elevación posterior), inclinado de pie.
//
// Vista FRONTAL POR DETRÁS (`cara: 'post'`): deltoides posterior y espalda
// alta, que de perfil no se verían (el brazo se movería hacia la cámara).
// Bisagra de cadera con el tronco a unos 20° del suelo: visto por detrás el
// tronco se ve corto (escorzo 0,36) y la cabeza asoma por encima (0,5);
// rodillas sueltas (piernas en escorzo leve).
// Biomecánica (src/iron/__tests__/hombro.test.ts):
// · Las mancuernas cuelgan bajo los hombros y suben en abanico hasta la
//   altura de la espalda (abducción ≤ 90°), codos casi estirados (≤ 20°).
// · El tronco no se levanta durante el tirón (mismo escorzo en todo el ciclo).
// Límite del 2D: los brazos colgando se pintan por delante de la cadera.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';
import { conBrazos } from './comun';

const PIERNAS = { cadera: 4, rodilla: 0, tobillo: -4 } as const;
const ABAJO: Extremidades = conBrazos(PIERNAS, 14, 12);
const ARRIBA: Extremidades = conBrazos(PIERNAS, 86, 14);

const pose = (ms: number, cerca: Extremidades): Pose => ({
  ms,
  cuello: 0,
  cerca,
  escorzo: { tronco: 0.36, cabeza: 0.5, muslo_c: 0.9, muslo_l: 0.9, pierna_c: 0.97, pierna_l: 0.97 },
});

export const pajaroMancuerna: Ejercicio = {
  id: 'pajaro-mancuerna',
  nombre: 'iron-hombro:ejercicios.pajaro-mancuerna.nombre',
  grupo: 'hombro',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['mancuerna'],
  musculos: {
    principales: ['deltoides_posterior'],
    secundarios: ['espalda_alta', 'trapecio', 'manguito_rotador'],
  },
  sustitutos: ['tiron-banda', 'face-pull-banda'],
  vista: 'frontal',
  cara: 'post',
  // Cadera a la altura que dejan las piernas con las rodillas sueltas.
  ancla: { punto: 'cadera', x: 0, y: 49.7, segmento: 'tronco', angulo: 90 },
  poses: [pose(0, ABAJO), pose(300, ABAJO), pose(1200, ARRIBA), pose(1500, ARRIBA)],
  cicloMs: 3500,
  esfuerzo: [{ desde: 300, hasta: 1200 }],
  msFicha: 1350,
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'lado', lados: ['cerca', 'lejos'] },
  encuadre: { x: -60, y: -4, ancho: 120, alto: 84 },
  cues: [
    'iron-hombro:ejercicios.pajaro-mancuerna.cues.bisagra',
    'iron-hombro:ejercicios.pajaro-mancuerna.cues.abanico',
    'iron-hombro:ejercicios.pajaro-mancuerna.cues.ligera',
  ],
  errores: [
    'iron-hombro:ejercicios.pajaro-mancuerna.errores.tronco',
    'iron-hombro:ejercicios.pajaro-mancuerna.errores.trapecio',
  ],
};

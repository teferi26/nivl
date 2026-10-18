// NIVL · IRON · Paseo del granjero con mancuernas, vista lateral.
//
// Una mancuerna pesada en cada mano, brazos estirados a los lados, hombros
// atrás y abdomen firme; pasos cortos. La animación camina en el sitio: la
// cadera no se desplaza y las piernas se alternan, siempre con un pie plano
// en el suelo. Trabaja sobre todo el agarre (antebrazo) y el trapecio.
// Biomecánica (comprobada en src/iron/__tests__/brazos.test.ts): tronco
// vertical, brazos colgando quietos, siempre un pie apoyado.

import type { Ejercicio, Extremidades } from '../../tipos';
import { pose, textos } from './comun';

const BRAZOS = { hombro: 0, codo: 4 } as const;
const APOYADA: Extremidades = { ...BRAZOS, cadera: 0, rodilla: 0, tobillo: 0 };
const EN_EL_AIRE: Extremidades = { ...BRAZOS, cadera: 30, rodilla: 48, tobillo: 2 };
const T = textos('paseo-granjero', ['postura', 'agarre', 'pasos'], ['inclinarse', 'hombros']);

export const paseoGranjero: Ejercicio = {
  id: 'paseo-granjero',
  nombre: T.nombre,
  grupo: 'brazo',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['mancuerna'],
  musculos: { principales: ['antebrazo'], secundarios: ['trapecio', 'abdomen', 'oblicuos', 'gluteo'] },
  sustitutos: ['curl-muneca-espalda-barra', 'curl-muneca-barra'],
  vista: 'lateral',
  // La cadera fija a la altura de la pierna estirada (tobillo en y = 4).
  ancla: { punto: 'cadera', x: 0, y: 53, segmento: 'tronco', angulo: 90 },
  poses: [
    pose(0, APOYADA),
    pose(450, APOYADA, { lejos: EN_EL_AIRE }),
    pose(900, APOYADA),
    pose(1350, EN_EL_AIRE, { lejos: APOYADA }),
  ],
  cicloMs: 1800,
  esfuerzo: [{ desde: 0, hasta: 1800 }],
  msFicha: 1350,
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'lado', lados: ['cerca', 'lejos'] },
  encuadre: { x: -42, y: -4, ancho: 84, alto: 112 },
  cues: T.cues,
  errores: T.errores,
};

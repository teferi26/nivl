// NIVL · IRON · Russian twist (giro ruso), vista lateral.
//
// Sentado en la esterilla, tronco inclinado atrás unos 40°, rodillas
// algo dobladas y talones apoyados. Las manos, juntas, van de un lado de la
// cadera al otro girando el tronco, no solo los brazos.
// Biomecánica (comprobada en src/iron/__tests__/core.test.ts):
// · Cadera, piernas y la inclinación del tronco quietos (ancla en la cadera).
// · Talones en la esterilla todo el recorrido.
// · Las manos bajan hasta casi tocar el suelo junto a la cadera.
// De perfil el giro no se ve: al lado de la cámara los brazos bajan
// enteros; al lado contrario se alejan (escorzo) y quedan algo más altos.

import type { Ejercicio, Extremidades, Pose, SegmentoId } from '../../tipos';

const PIERNAS = { cadera: 61.2, rodilla: 32.3, tobillo: -40.9 } as const;
/** Brazos estirados al frente, manos juntas sobre las rodillas. */
const CENTRO: Extremidades = { ...PIERNAS, hombro: 33, codo: 10 };
/** Giro al lado de la cámara: manos al suelo junto a la cadera. */
const CERCA: Extremidades = { ...PIERNAS, hombro: 1.7, codo: 0 };
/** Giro al lado contrario: los brazos se alejan de la cámara. */
const LEJOS: Extremidades = { ...PIERNAS, hombro: 3, codo: 8 };

const pose = (ms: number, brazos: Extremidades, lejos = false): Pose => {
  const e = lejos ? 0.85 : 1;
  const escorzo: Partial<Record<SegmentoId, number>> = { brazo_c: e, antebrazo_c: e, brazo_l: e, antebrazo_l: e };
  return { ms, cuello: 10, cerca: brazos, escorzo };
};

export const russianTwist: Ejercicio = {
  id: 'russian-twist',
  nombre: 'iron-core:ejercicios.russian-twist.nombre',
  grupo: 'core',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['esterilla'],
  musculos: {
    principales: ['oblicuos'],
    secundarios: ['abdomen', 'transverso'],
  },
  sustitutos: ['plancha-lateral', 'toques-hombro', 'crunch'],
  vista: 'lateral',
  // Sentado sobre los isquiones; el tronco, a 132° (42° hacia atrás).
  ancla: { punto: 'cadera', x: 0, y: 8.8, segmento: 'tronco', angulo: 132 },
  poses: [pose(0, CENTRO), pose(650, CERCA), pose(850, CERCA), pose(1500, CENTRO), pose(2150, LEJOS, true), pose(2350, LEJOS, true)],
  cicloMs: 3000,
  esfuerzo: [
    { desde: 0, hasta: 650 },
    { desde: 1500, hasta: 2150 },
  ],
  msFicha: 0,
  escenario: [{ tipo: 'esterilla', x: -36, ancho: 92, alto: 0.8, capa: 'fondo' }],
  encuadre: { x: -40, y: -4, ancho: 100, alto: 60 },
  cues: [
    'iron-core:ejercicios.russian-twist.cues.espalda',
    'iron-core:ejercicios.russian-twist.cues.gira',
    'iron-core:ejercicios.russian-twist.cues.pies',
  ],
  errores: [
    'iron-core:ejercicios.russian-twist.errores.brazos',
    'iron-core:ejercicios.russian-twist.errores.encorvar',
  ],
};

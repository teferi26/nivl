// NIVL · IRON · Peso muerto convencional con barra.
//
// Biomecánica (src/iron/__tests__/espalda.test.ts):
// · La barra sale del suelo (discos apoyados) y sube en vertical sobre el
//   medio del pie (±3), pegada a las piernas.
// · Abajo, la cadera por encima de la rodilla y los hombros un poco por
//   delante de la barra; espalda neutra (la cabeza sigue al tronco).
// · Arriba, de pie con las piernas rectas, sin echarse atrás.
// · Pies planos todo el recorrido.

import type { Ejercicio } from '../../tipos';
import { ANCLA_DE_PIE, pose } from './_pose';
import { BARRA_SUELO, BLOQUEO, enBarra } from './_peso-muerto';

const SUELO = enBarra(20, BARRA_SUELO, -96, 32);
const ESPINILLA = enBarra(32, 21, -94.5, 44);
const RODILLA = enBarra(46, 30, -92.5, 56);

export const pesoMuerto: Ejercicio = {
  id: 'peso-muerto',
  nombre: 'iron-espalda:ejercicios.peso-muerto.nombre',
  grupo: 'espalda',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['barra'],
  musculos: {
    principales: ['lumbares', 'gluteo', 'isquiotibiales'],
    secundarios: ['cuadriceps', 'dorsal', 'trapecio', 'antebrazo', 'abdomen'],
  },
  sustitutos: ['peso-muerto-mancuernas', 'peso-muerto-sumo', 'peso-muerto-rumano'],
  vista: 'lateral',
  ancla: ANCLA_DE_PIE,
  poses: [
    pose(0, SUELO),
    pose(500, SUELO),
    pose(1000, ESPINILLA),
    pose(1450, RODILLA),
    pose(2100, BLOQUEO),
    pose(2500, BLOQUEO),
    pose(3200, RODILLA),
    pose(3700, ESPINILLA),
    pose(4100, SUELO),
  ],
  cicloMs: 4500,
  esfuerzo: [{ desde: 500, hasta: 2100 }],
  msFicha: 1450,
  carga: { tipo: 'barra', en: 'agarre', eje: { x: 13, y: 0 } },
  encuadre: { x: -36, y: -4, ancho: 92, alto: 112 },
  cues: [
    'iron-espalda:ejercicios.peso-muerto.cues.barra',
    'iron-espalda:ejercicios.peso-muerto.cues.espalda',
    'iron-espalda:ejercicios.peso-muerto.cues.empuja',
    'iron-espalda:ejercicios.peso-muerto.cues.arriba',
  ],
  errores: [
    'iron-espalda:ejercicios.peso-muerto.errores.lumbar',
    'iron-espalda:ejercicios.peso-muerto.errores.lejos',
    'iron-espalda:ejercicios.peso-muerto.errores.cadera',
  ],
};

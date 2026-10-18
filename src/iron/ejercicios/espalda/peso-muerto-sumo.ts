// NIVL · IRON · Peso muerto sumo con barra.
//
// Pies muy abiertos y puntas hacia fuera; las manos agarran por dentro de las
// piernas. Las rodillas se abren hacia las puntas: el muslo sale del plano y
// se ve corto abajo (escorzo). Tronco más erguido que en el convencional.
// Mismas reglas que el peso muerto (src/iron/__tests__/espalda.test.ts).

import type { Ejercicio } from '../../tipos';
import { ANCLA_DE_PIE } from './_pose';
import { BARRA_SUELO, BLOQUEO, enBarra, poseEscorzo } from './_peso-muerto';

const SUELO = enBarra(48, BARRA_SUELO, -93, 58, { muslo: 0.62, pierna: 0.92 });
const MEDIO = enBarra(62, 26, -91, 68, { muslo: 0.74, pierna: 0.95 });
const ARRIBA = { ...BLOQUEO };

export const pesoMuertoSumo: Ejercicio = {
  id: 'peso-muerto-sumo',
  nombre: 'iron-espalda:ejercicios.peso-muerto-sumo.nombre',
  grupo: 'espalda',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['barra'],
  musculos: {
    principales: ['lumbares', 'gluteo', 'aductores'],
    secundarios: ['cuadriceps', 'isquiotibiales', 'trapecio', 'antebrazo'],
  },
  sustitutos: ['peso-muerto', 'peso-muerto-mancuernas'],
  vista: 'lateral',
  ancla: ANCLA_DE_PIE,
  poses: [
    poseEscorzo(0, SUELO, 0.62, 0.92),
    poseEscorzo(500, SUELO, 0.62, 0.92),
    poseEscorzo(1250, MEDIO, 0.74, 0.95),
    poseEscorzo(2000, ARRIBA, 0.96, 1),
    poseEscorzo(2400, ARRIBA, 0.96, 1),
    poseEscorzo(3300, MEDIO, 0.74, 0.95),
  ],
  cicloMs: 4100,
  esfuerzo: [{ desde: 500, hasta: 2000 }],
  msFicha: 1250,
  carga: { tipo: 'barra', en: 'agarre', eje: { x: 13, y: 0 } },
  encuadre: { x: -32, y: -4, ancho: 88, alto: 112 },
  cues: [
    'iron-espalda:ejercicios.peso-muerto-sumo.cues.pies',
    'iron-espalda:ejercicios.peso-muerto-sumo.cues.rodillas',
    'iron-espalda:ejercicios.peso-muerto-sumo.cues.pecho',
  ],
  errores: [
    'iron-espalda:ejercicios.peso-muerto-sumo.errores.rodillas',
    'iron-espalda:ejercicios.peso-muerto-sumo.errores.lumbar',
  ],
};

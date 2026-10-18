// NIVL · IRON · Curl nórdico, vista lateral. En casa (talones sujetos bajo un mueble firme o por un compañero).
//
// De rodillas, con los tobillos sujetos y el cuerpo recto de rodillas a
// cabeza, se deja caer hacia delante lo más despacio posible frenando con los
// isquiotibiales; las manos amortiguan abajo y ayudan a volver.
// Aquí el trabajo está en la bajada (excéntrica): el principal brilla al bajar.
// Biomecánica (comprobada en src/iron/__tests__/pierna.test.ts):
// · Rodillas fijas en el suelo (el ancla) y tobillos quietos.
// · Cadera estirada: rodilla, cadera y hombro en línea (cadera ±5°).
// · La bajada dura más del doble que la subida.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const pie = (rodilla: number, hombro: number, codo: number): Extremidades => ({ cadera: 0, rodilla, tobillo: -45, hombro, codo });

const ARRIBA = pie(100, 30, 100);
const MEDIO = pie(55, 40, 95);
const ABAJO = pie(36, 50, 95);

const pose = (ms: number, cerca: Extremidades, cuello: number): Pose => ({ ms, cerca, cuello });

export const curlNordico: Ejercicio = {
  id: 'curl-nordico',
  nombre: 'iron-pierna:ejercicios.curl-nordico.nombre',
  grupo: 'pierna',
  nivel: 'avanzado',
  tipo: 'dinamico',
  material: ['peso_corporal'],
  musculos: {
    principales: ['isquiotibiales'],
    secundarios: ['gluteo', 'gemelos', 'abdomen'],
  },
  sustitutos: ['curl-femoral-tumbado', 'peso-muerto-rumano-mancuerna'],
  vista: 'lateral',
  // Rodillas en el suelo; la espinilla sube un poco hacia el tobillo sujeto.
  ancla: { punto: 'rodilla_c', x: 0, y: 3.8, segmento: 'pierna_c', angulo: 170 },
  poses: [
    pose(0, ARRIBA, 0),
    pose(400, ARRIBA, 0),
    pose(1700, MEDIO, 0),
    pose(2800, ABAJO, 4),
    pose(3100, ABAJO, 4),
    pose(3600, MEDIO, 0),
  ],
  cicloMs: 4200,
  esfuerzo: [{ desde: 400, hasta: 2800 }],
  msFicha: 1900,
  encuadre: { x: -36, y: -4, ancho: 108, alto: 80 },
  cues: [
    'iron-pierna:ejercicios.curl-nordico.cues.linea',
    'iron-pierna:ejercicios.curl-nordico.cues.lento',
    'iron-pierna:ejercicios.curl-nordico.cues.manos',
  ],
  errores: [
    'iron-pierna:ejercicios.curl-nordico.errores.cadera',
    'iron-pierna:ejercicios.curl-nordico.errores.caer',
  ],
};

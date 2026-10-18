// NIVL · IRON · Hiperextensiones en banco a 45°.
//
// La cadera apoyada en la almohadilla y los tobillos bajo el rodillo: las
// piernas no se mueven (el ancla es la cadera con el muslo fijo a 45°). El
// tronco baja doblando la cadera, con la espalda neutra, y sube hasta quedar
// en línea con las piernas, sin pasarse. Brazos cruzados sobre el pecho.
// Biomecánica (src/iron/__tests__/espalda.test.ts): arriba hombro, cadera y
// tobillo en línea; nunca más allá (sin hiperextender la zona lumbar).

import type { Ejercicio, Pose } from '../../tipos';

const MUSLO = 225;
const BRAZOS = { hombro: 25, codo: 135 } as const;
const tronco = (cadera: number): Pose['cerca'] => ({ cadera, rodilla: 0, tobillo: 0, ...BRAZOS });
const p = (ms: number, cadera: number, cuello = 0): Pose => ({ ms, cuello, cerca: tronco(cadera) });

const rad = (g: number) => (g * Math.PI) / 180;
const CADERA = { x: 0, y: 52 };
// Almohadilla delante del muslo, justo bajo la cadera; rodillo detrás de los tobillos.
const ALMOHADILLA = {
  x: CADERA.x + 3.7 * Math.cos(rad(MUSLO)) + 7.3 * Math.cos(rad(MUSLO + 90)),
  y: CADERA.y + 3.7 * Math.sin(rad(MUSLO)) + 7.3 * Math.sin(rad(MUSLO + 90)),
};
const TOBILLOS = {
  x: CADERA.x + 45.3 * Math.cos(rad(MUSLO)) + 6 * Math.cos(rad(MUSLO - 90)),
  y: CADERA.y + 45.3 * Math.sin(rad(MUSLO)) + 6 * Math.sin(rad(MUSLO - 90)),
};

export const hiperextension: Ejercicio = {
  id: 'hiperextension',
  nombre: 'iron-espalda:ejercicios.hiperextension.nombre',
  grupo: 'espalda',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['maquina'],
  musculos: {
    principales: ['lumbares', 'gluteo'],
    secundarios: ['isquiotibiales', 'espalda_alta'],
  },
  sustitutos: ['superman', 'peso-muerto-mancuernas', 'peso-muerto'],
  vista: 'lateral',
  ancla: { punto: 'cadera', x: CADERA.x, y: CADERA.y, segmento: 'muslo_c', angulo: MUSLO },
  // cadera 0: en línea con las piernas (arriba); 80: el tronco cuelga (abajo).
  poses: [p(0, 0), p(500, 0), p(1700, 80, 10), p(2000, 80, 10), p(2600, 40, 5)],
  cicloMs: 3200,
  esfuerzo: [{ desde: 2000, hasta: 3200 }],
  msFicha: 300,
  escenario: [{ tipo: 'hiperextension', cadera: ALMOHADILLA, angulo: 45, tobillos: TOBILLOS, capa: 'medio' }],
  encuadre: { x: -48, y: -4, ancho: 108, alto: 100 },
  cues: [
    'iron-espalda:ejercicios.hiperextension.cues.almohadilla',
    'iron-espalda:ejercicios.hiperextension.cues.linea',
    'iron-espalda:ejercicios.hiperextension.cues.control',
  ],
  errores: [
    'iron-espalda:ejercicios.hiperextension.errores.pasarse',
    'iron-espalda:ejercicios.hiperextension.errores.impulso',
  ],
};

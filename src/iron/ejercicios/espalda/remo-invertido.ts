// NIVL · IRON · Remo invertido en barra baja (también bajo una mesa firme).
//
// Boca arriba bajo la barra, talones en el suelo y el cuerpo recto como una
// tabla. Cadena cerrada: los talones y las manos no se mueven; el cuerpo gira
// sobre los tobillos. El ancla es el tobillo con el pie quieto; los brazos se
// despejan en cada pose para que el puño siga en la barra.
// Biomecánica (src/iron/__tests__/espalda.test.ts):
// · Hombro, cadera y tobillo en línea en todo el recorrido (sin cadera caída).
// · Las manos no se despegan de la barra.
// · Arriba el pecho llega a la barra; abajo, brazos estirados.

import type { Ejercicio } from '../../tipos';
import { brazoHasta, hombroEn, pose, type Absolutos } from './_pose';

// El tobillo y el pie fijos (talón en el suelo); la barra, a 73,5 del tobillo.
const TOBILLO = { x: 60, y: 5.1 } as const;
const BARRA = {
  x: TOBILLO.x - 73.5 * Math.cos((44 * Math.PI) / 180),
  y: TOBILLO.y + 73.5 * Math.sin((44 * Math.PI) / 180),
} as const;
const ANCLA = { punto: 'tobillo_c', x: TOBILLO.x, y: TOBILLO.y, segmento: 'pie_c', angulo: 80 } as const;
const ESC = { brazo: 0.95, antebrazo: 0.97 };

/** El cuerpo recto inclinado `fi` grados sobre el suelo; los brazos llegan a la barra. */
function tabla(fi: number): Absolutos {
  const cuerpo: Absolutos = { tronco: 180 - fi, muslo: -fi, pierna: -fi, pie: 80, brazo: 0, antebrazo: 0 };
  const hombro = hombroEn(ANCLA, pose(0, cuerpo));
  return { ...cuerpo, ...brazoHasta(hombro, BARRA, true, ESC) };
}

const ABAJO = tabla(16);
const MEDIO = tabla(26.5);
const ARRIBA = tabla(37);
const ESCORZO = { brazo_c: ESC.brazo, brazo_l: ESC.brazo, antebrazo_c: ESC.antebrazo, antebrazo_l: ESC.antebrazo };
const p = (ms: number, a: Absolutos) => pose(ms, a, { escorzo: ESCORZO });

export const remoInvertido: Ejercicio = {
  id: 'remo-invertido',
  nombre: 'iron-espalda:ejercicios.remo-invertido.nombre',
  grupo: 'espalda',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['barra_fija'],
  musculos: {
    principales: ['dorsal', 'espalda_alta'],
    secundarios: ['deltoides_posterior', 'biceps', 'antebrazo', 'gluteo', 'abdomen'],
  },
  sustitutos: ['remo-polea-sentado', 'remo-mancuernas', 'dominada-negativa'],
  vista: 'lateral',
  ancla: ANCLA,
  poses: [p(0, ABAJO), p(400, ABAJO), p(950, MEDIO), p(1450, ARRIBA), p(1800, ARRIBA), p(2700, MEDIO)],
  cicloMs: 3600,
  esfuerzo: [{ desde: 400, hasta: 1450 }],
  msFicha: 1600,
  escenario: [{ tipo: 'barra_dominadas', x: BARRA.x, y: BARRA.y, soporte: 'poste', eje: { x: -4, y: 3 }, capa: 'fondo' }],
  encuadre: { x: -34, y: -4, ancho: 110, alto: 76 },
  cues: [
    'iron-espalda:ejercicios.remo-invertido.cues.tabla',
    'iron-espalda:ejercicios.remo-invertido.cues.pecho',
    'iron-espalda:ejercicios.remo-invertido.cues.mesa',
  ],
  errores: [
    'iron-espalda:ejercicios.remo-invertido.errores.cadera',
    'iron-espalda:ejercicios.remo-invertido.errores.cuello',
  ],
};

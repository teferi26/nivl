// NIVL · IRON · Peso muerto rumano con barra.
//
// Se empieza de pie y se baja llevando la cadera atrás, con las rodillas
// sueltas (unos 20°) y la espalda neutra; la barra baja pegada a los muslos
// hasta la rodilla o un poco más y vuelve. No toca el suelo.
// Biomecánica (src/iron/__tests__/espalda.test.ts): barra sobre el medio del
// pie (±3), rodillas casi quietas (no es una sentadilla) y pies planos.

import type { Ejercicio } from '../../tipos';
import { ANCLA_DE_PIE, pose, type Absolutos } from './_pose';

const ARRIBA: Absolutos = { tronco: 88, cabeza: 88, muslo: -80, pierna: -95, pie: 0, brazo: -82, antebrazo: -82 };
const MEDIO: Absolutos = { tronco: 62, cabeza: 70, muslo: -68, pierna: -88, pie: 0, brazo: -88, antebrazo: -88 };
const ABAJO: Absolutos = { tronco: 35, cabeza: 45, muslo: -56, pierna: -78, pie: 0, brazo: -92, antebrazo: -92 };

export const pesoMuertoRumano: Ejercicio = {
  id: 'peso-muerto-rumano',
  nombre: 'iron-espalda:ejercicios.peso-muerto-rumano.nombre',
  grupo: 'espalda',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['barra'],
  musculos: {
    principales: ['lumbares', 'isquiotibiales', 'gluteo'],
    secundarios: ['dorsal', 'trapecio', 'antebrazo', 'abdomen'],
  },
  sustitutos: ['peso-muerto-mancuernas', 'buenos-dias', 'peso-muerto'],
  vista: 'lateral',
  ancla: ANCLA_DE_PIE,
  poses: [pose(0, ARRIBA), pose(400, ARRIBA), pose(1300, MEDIO), pose(2200, ABAJO), pose(2500, ABAJO), pose(3200, MEDIO)],
  cicloMs: 4000,
  esfuerzo: [{ desde: 2500, hasta: 4000 }],
  msFicha: 2350,
  carga: { tipo: 'barra', en: 'agarre', disco: 11, eje: { x: 13, y: 0 } },
  encuadre: { x: -36, y: -4, ancho: 88, alto: 112 },
  cues: [
    'iron-espalda:ejercicios.peso-muerto-rumano.cues.cadera',
    'iron-espalda:ejercicios.peso-muerto-rumano.cues.barra',
    'iron-espalda:ejercicios.peso-muerto-rumano.cues.hasta',
  ],
  errores: [
    'iron-espalda:ejercicios.peso-muerto-rumano.errores.lumbar',
    'iron-espalda:ejercicios.peso-muerto-rumano.errores.sentadilla',
  ],
};

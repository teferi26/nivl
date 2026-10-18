// NIVL · IRON · Saltos de tijera (jumping jacks), vista FRONTAL.
//
// De pie, se salta abriendo piernas y subiendo los brazos por los lados
// hasta encima de la cabeza; se salta otra vez para cerrar.
// Biomecánica (comprobada en src/iron/__tests__/core.test.ts):
// · Abiertas, las piernas se separan unos 14° cada una (pies algo más
//   anchos que los hombros) y los brazos llegan arriba (≥ 150°).
// · Cerradas, pies juntos bajo la cadera y brazos pegados.
// · En los dos apoyos los tobillos quedan a la misma altura (pies en el
//   suelo); entre medias, la cadera sube: hay fase en el aire.
// El ancla es la cadera y se mueve (`punto`); la altura de cada apoyo está
// calculada para que los pies toquen el suelo.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

// El tobillo compensa la apertura: la planta queda horizontal.
const CERRADO: Extremidades = { cadera: 0, rodilla: 0, tobillo: 0, hombro: 8, codo: 5 };
const AIRE: Extremidades = { cadera: 7, rodilla: 0, tobillo: -7, hombro: 90, codo: 5 };
const ABIERTO: Extremidades = { cadera: 14, rodilla: 0, tobillo: -14, hombro: 165, codo: 10 };

/** Altura de la cadera para que los tobillos queden a 4 con las piernas abiertas `abd` grados. */
const alturaCadera = (abd: number) => Math.round((4 + 49 * Math.cos((abd * Math.PI) / 180)) * 100) / 100;

const pose = (ms: number, cerca: Extremidades, y: number): Pose => ({ ms, cuello: 0, cerca, punto: { x: 0, y } });

export const saltosTijera: Ejercicio = {
  id: 'saltos-tijera',
  nombre: 'iron-core:ejercicios.saltos-tijera.nombre',
  grupo: 'cardio',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['peso_corporal'],
  musculos: {
    principales: ['deltoides_lateral', 'gemelos'],
    secundarios: ['gluteo', 'aductores', 'cuadriceps', 'trapecio'],
  },
  sustitutos: ['comba', 'rodillas-arriba', 'sentadilla-salto'],
  vista: 'frontal',
  ancla: { punto: 'cadera', x: 0, y: 53, segmento: 'tronco', angulo: 90 },
  poses: [
    pose(0, CERRADO, alturaCadera(0)),
    pose(375, AIRE, 57),
    pose(750, ABIERTO, alturaCadera(14)),
    pose(1125, AIRE, 57),
  ],
  cicloMs: 1500,
  esfuerzo: [{ desde: 0, hasta: 750 }],
  msFicha: 750,
  encuadre: { x: -56, y: -4, ancho: 112, alto: 132 },
  cues: [
    'iron-core:ejercicios.saltos-tijera.cues.puntas',
    'iron-core:ejercicios.saltos-tijera.cues.brazos',
    'iron-core:ejercicios.saltos-tijera.cues.rodillas',
  ],
  errores: [
    'iron-core:ejercicios.saltos-tijera.errores.talones',
    'iron-core:ejercicios.saltos-tijera.errores.rodillasDentro',
  ],
};

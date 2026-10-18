// NIVL · IRON · Peso muerto rumano con mancuernas, vista lateral.
//
// La misma bisagra de cadera que con barra, con una mancuerna en cada mano
// delante de los muslos: más fácil de montar en casa o en un gimnasio lleno.
// Biomecánica (comprobada en src/iron/__tests__/pierna.test.ts):
// · Las mancuernas bajan en vertical sobre el medio del pie (±2) rozando las piernas.
// · Espinillas casi verticales y rodillas suaves; brazos estirados.
// Mismas poses despejadas que el rumano con barra.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const ARRIBA: Extremidades = { cadera: 12.5, rodilla: 6, tobillo: -2.5, hombro: 13.9, codo: 0 };
const MEDIO: Extremidades = { cadera: 56.4, rodilla: 14, tobillo: -0.4, hombro: 26.2, codo: 0 };
const ABAJO: Extremidades = { cadera: 95.3, rodilla: 20, tobillo: -3.3, hombro: 50.3, codo: 0 };

const pose = (ms: number, cerca: Extremidades, cuello: number): Pose => ({ ms, cerca, cuello });

export const pesoMuertoRumanoMancuerna: Ejercicio = {
  id: 'peso-muerto-rumano-mancuerna',
  nombre: 'iron-pierna:ejercicios.peso-muerto-rumano-mancuerna.nombre',
  grupo: 'pierna',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['mancuerna'],
  musculos: {
    principales: ['isquiotibiales', 'gluteo'],
    secundarios: ['lumbares', 'aductores', 'antebrazo'],
  },
  sustitutos: ['peso-muerto-rumano', 'peso-muerto-una-pierna', 'buenos-dias'],
  vista: 'lateral',
  ancla: { punto: 'tobillo_c', x: 0, y: 4, segmento: 'pie_c', angulo: 0 },
  poses: [
    pose(0, ARRIBA, 0),
    pose(400, ARRIBA, 0),
    pose(1300, MEDIO, 4),
    pose(2200, ABAJO, 6),
    pose(2400, ABAJO, 6),
    pose(3100, MEDIO, 4),
  ],
  cicloMs: 3900,
  esfuerzo: [{ desde: 2400, hasta: 3900 }],
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'punta', lados: ['cerca'] },
  encuadre: { x: -46, y: -4, ancho: 100, alto: 112 },
  cues: [
    'iron-pierna:ejercicios.peso-muerto-rumano-mancuerna.cues.cadera',
    'iron-pierna:ejercicios.peso-muerto-rumano-mancuerna.cues.pegadas',
    'iron-pierna:ejercicios.peso-muerto-rumano-mancuerna.cues.espalda',
  ],
  errores: [
    'iron-pierna:ejercicios.peso-muerto-rumano-mancuerna.errores.redondear',
    'iron-pierna:ejercicios.peso-muerto-rumano-mancuerna.errores.lejos',
  ],
};

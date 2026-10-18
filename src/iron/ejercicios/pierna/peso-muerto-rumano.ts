// NIVL · IRON · Peso muerto rumano con barra, vista lateral.
//
// Bisagra de cadera: la cadera va atrás con las rodillas apenas flexionadas y
// la barra baja pegada a las piernas hasta justo por debajo de la rodilla.
// Trabajan sobre todo los isquiotibiales y el glúteo.
// Biomecánica (comprobada en src/iron/__tests__/pierna.test.ts):
// · La barra baja y sube en vertical sobre el medio del pie (±2) y roza las
//   piernas sin atravesarlas.
// · Espinillas casi verticales (tobillo entre -6 y 6°) y rodillas suaves (≤ 25°).
// · La cadera retrocede al bajar; brazos estirados (codo 0).
// Las poses están despejadas para que la barra caiga sobre el medio del pie
// rozando el muslo y la espinilla (ver docs/iron/F2-pierna.md).

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const ARRIBA: Extremidades = { cadera: 12.5, rodilla: 6, tobillo: -2.5, hombro: 13.9, codo: 0 };
const MEDIO: Extremidades = { cadera: 56.4, rodilla: 14, tobillo: -0.4, hombro: 26.2, codo: 0 };
const ABAJO: Extremidades = { cadera: 95.3, rodilla: 20, tobillo: -3.3, hombro: 50.3, codo: 0 };

const pose = (ms: number, cerca: Extremidades, cuello: number): Pose => ({ ms, cerca, cuello });

export const pesoMuertoRumano: Ejercicio = {
  id: 'peso-muerto-rumano',
  nombre: 'iron-pierna:ejercicios.peso-muerto-rumano.nombre',
  grupo: 'pierna',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['barra'],
  musculos: {
    principales: ['isquiotibiales', 'gluteo'],
    secundarios: ['lumbares', 'aductores', 'trapecio', 'antebrazo'],
  },
  sustitutos: ['peso-muerto-rumano-mancuerna', 'buenos-dias', 'curl-femoral-tumbado'],
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
  // Cámara en 3/4: el disco cercano queda delante de las piernas, sin tapar el muslo.
  carga: { tipo: 'barra', en: 'agarre', disco: 10.5, eje: { x: 14, y: -2 } },
  encuadre: { x: -46, y: -4, ancho: 100, alto: 112 },
  cues: [
    'iron-pierna:ejercicios.peso-muerto-rumano.cues.cadera',
    'iron-pierna:ejercicios.peso-muerto-rumano.cues.barra',
    'iron-pierna:ejercicios.peso-muerto-rumano.cues.espalda',
    'iron-pierna:ejercicios.peso-muerto-rumano.cues.rango',
  ],
  errores: [
    'iron-pierna:ejercicios.peso-muerto-rumano.errores.redondear',
    'iron-pierna:ejercicios.peso-muerto-rumano.errores.sentadilla',
    'iron-pierna:ejercicios.peso-muerto-rumano.errores.separar',
  ],
};

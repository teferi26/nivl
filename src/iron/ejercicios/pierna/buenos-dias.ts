// NIVL · IRON · Buenos días con barra, vista lateral.
//
// La barra va a la espalda como en la sentadilla; con las rodillas suaves se
// lleva la cadera atrás y el tronco baja en bloque.
// Biomecánica (comprobada en src/iron/__tests__/pierna.test.ts):
// · Espalda neutra: la cabeza sigue al tronco; rodillas suaves (≤ 25°).
// · Espinillas casi verticales; la cadera retrocede al bajar.
// · La barra se mantiene cerca del medio del pie (±5): la cadera va atrás
//   para equilibrarla y el tronco baja hasta unos 40° sobre la horizontal.
// Las poses están despejadas para que la barra no se vaya delante de los pies.
// Brazos como en la sentadilla con barra: las manos siguen en la barra.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const BRAZOS = { hombro: -9.2, codo: -147 } as const;
const ESCORZO = { brazo_c: 0.62, brazo_l: 0.62, antebrazo_c: 0.5, antebrazo_l: 0.5 } as const;

const ARRIBA: Extremidades = { cadera: 13.5, rodilla: 4, tobillo: 5, ...BRAZOS };
const MEDIO: Extremidades = { cadera: 43.2, rodilla: 14, tobillo: 2.8, ...BRAZOS };
const ABAJO: Extremidades = { cadera: 79.5, rodilla: 24, tobillo: -3.5, ...BRAZOS };

const pose = (ms: number, cerca: Extremidades, cuello: number): Pose => ({ ms, cerca, cuello, escorzo: ESCORZO });

export const buenosDias: Ejercicio = {
  id: 'buenos-dias',
  nombre: 'iron-pierna:ejercicios.buenos-dias.nombre',
  grupo: 'pierna',
  nivel: 'avanzado',
  tipo: 'dinamico',
  material: ['barra', 'rack'],
  musculos: {
    principales: ['isquiotibiales'],
    secundarios: ['gluteo', 'lumbares', 'aductores'],
  },
  sustitutos: ['peso-muerto-rumano', 'peso-muerto-rumano-mancuerna'],
  vista: 'lateral',
  ancla: { punto: 'tobillo_c', x: 0, y: 4, segmento: 'pie_c', angulo: 0 },
  poses: [
    pose(0, ARRIBA, 0),
    pose(400, ARRIBA, 0),
    pose(1400, MEDIO, 2),
    pose(2400, ABAJO, 4),
    pose(2600, ABAJO, 4),
    pose(3400, MEDIO, 2),
  ],
  cicloMs: 4200,
  esfuerzo: [{ desde: 2600, hasta: 4200 }],
  carga: { tipo: 'barra', en: 'tronco', t: 1, dorso: 6.6, disco: 8.5, eje: { x: -15, y: 6 } },
  escenario: [{ tipo: 'rack', x: -40, ancho: 58, alto: 78, capa: 'fondo', seguro: 46 }],
  encuadre: { x: -58, y: -4, ancho: 108, alto: 112 },
  cues: [
    'iron-pierna:ejercicios.buenos-dias.cues.cadera',
    'iron-pierna:ejercicios.buenos-dias.cues.espalda',
    'iron-pierna:ejercicios.buenos-dias.cues.carga',
  ],
  errores: [
    'iron-pierna:ejercicios.buenos-dias.errores.redondear',
    'iron-pierna:ejercicios.buenos-dias.errores.rodillas',
  ],
};

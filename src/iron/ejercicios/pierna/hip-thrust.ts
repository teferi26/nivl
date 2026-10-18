// NIVL · IRON · Hip thrust con barra, vista lateral.
//
// La espalda alta se apoya en el borde de un banco (a la altura de las
// escápulas), los pies planos y la barra sobre la cadera. La cadera sube
// hasta dejar tronco y muslos en línea, con las espinillas verticales.
// Biomecánica (comprobada en src/iron/__tests__/pierna.test.ts):
// · Pies planos y quietos; la espalda alta no se despega del borde del banco
//   (las poses están despejadas para que el punto de apoyo no se mueva).
// · Arriba: tronco y muslo en línea (cadera ±6°), muslo horizontal (±8°) y
//   espinilla vertical (±8°).
// · La barra va sobre la cadera todo el recorrido.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const BRAZOS = { hombro: -19.8, codo: 69.4 } as const;

const ABAJO: Extremidades = { cadera: 69.2, rodilla: 113.5, tobillo: -10.7, ...BRAZOS };
const MEDIO: Extremidades = { cadera: 28.1, rodilla: 103.7, tobillo: 0.6, ...BRAZOS };
const ARRIBA: Extremidades = { cadera: 1.9, rodilla: 90, tobillo: 0.1, ...BRAZOS };

const pose = (ms: number, cerca: Extremidades, cuello: number): Pose => ({ ms, cerca, cuello });

export const hipThrust: Ejercicio = {
  id: 'hip-thrust',
  nombre: 'iron-pierna:ejercicios.hip-thrust.nombre',
  grupo: 'pierna',
  nivel: 'intermedio',
  tipo: 'dinamico',
  material: ['barra', 'banco'],
  musculos: {
    principales: ['gluteo'],
    secundarios: ['isquiotibiales', 'cuadriceps', 'gluteo_medio', 'abdomen'],
  },
  sustitutos: ['puente-gluteo', 'puente-gluteo-una-pierna', 'swing-kettlebell'],
  vista: 'lateral',
  // El pie plano es el ancla; el tronco sale de la cadena pie, pierna, muslo.
  ancla: { punto: 'tobillo_c', x: 0, y: 4, segmento: 'pie_c', angulo: 0 },
  poses: [
    pose(0, ABAJO, 10),
    pose(300, ABAJO, 10),
    pose(800, MEDIO, 18),
    pose(1250, ARRIBA, 28),
    pose(1750, ARRIBA, 28),
    pose(2400, MEDIO, 18),
  ],
  cicloMs: 3000,
  esfuerzo: [{ desde: 300, hasta: 1250 }],
  msFicha: 1500,
  // Cámara en 3/4: el disco cercano queda por encima del muslo, sin tapar el glúteo.
  carga: { tipo: 'barra', en: 'tronco', t: 0.02, dorso: -7.8, disco: 9, eje: { x: 8, y: 10 } },
  escenario: [{ tipo: 'banco', x: -82, ancho: 33.6, alto: 22, capa: 'fondo' }],
  encuadre: { x: -88, y: -4, ancho: 112, alto: 72 },
  cues: [
    'iron-pierna:ejercicios.hip-thrust.cues.apoyo',
    'iron-pierna:ejercicios.hip-thrust.cues.arriba',
    'iron-pierna:ejercicios.hip-thrust.cues.barbilla',
    'iron-pierna:ejercicios.hip-thrust.cues.talones',
  ],
  errores: [
    'iron-pierna:ejercicios.hip-thrust.errores.lumbar',
    'iron-pierna:ejercicios.hip-thrust.errores.pies',
    'iron-pierna:ejercicios.hip-thrust.errores.rango',
  ],
};

// NIVL · IRON · Abducción de cadera en máquina, vista frontal.
//
// Sentado con la espalda en el respaldo y las almohadillas por fuera de las
// rodillas, se abren las piernas unos 35° y se cierran despacio sin dejar
// que los discos choquen. Trabaja el glúteo medio.
// Vista frontal: los muslos vienen hacia la cámara (escorzo); al abrirse se
// ven más largos y más tumbados, y las espinillas siguen colgando.
// Biomecánica (comprobada en src/iron/__tests__/pierna.test.ts):
// · Cadera y tronco quietos en el asiento (la cadera es el ancla).
// · Las dos rodillas se abren a la vez y lo mismo (simétrico ±0,5).
// · Las espinillas cuelgan verticales (±3°) y las almohadillas siguen a la rodilla.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const BRAZOS = { hombro: 8, codo: 5 } as const;

/** Piernas abiertas `a` (0 a 1): ángulo y escorzo del muslo en el dibujo. */
function piernas(a: number): { ext: Extremidades; muslo: number } {
  // De muslo hacia la cámara (corto, hacia abajo) a abierto unos 35°.
  const abierto = 35 * a;
  const fuera = 24.5 * Math.sin((abierto * Math.PI) / 180);
  const abajo = 6.1;
  const largo = Math.hypot(fuera, abajo);
  const dibujo = (Math.atan2(fuera, abajo) * 180) / Math.PI;
  const r = Math.round(dibujo * 10) / 10;
  return { ext: { cadera: r, rodilla: r, tobillo: 0, ...BRAZOS }, muslo: Math.round((largo / 24.5) * 100) / 100 };
}

function pose(ms: number, a: number): Pose {
  const p = piernas(a);
  return { ms, cuello: 0, cerca: p.ext, escorzo: { muslo_c: p.muslo, muslo_l: p.muslo } };
}

export const abduccionMaquina: Ejercicio = {
  id: 'abduccion-maquina',
  nombre: 'iron-pierna:ejercicios.abduccion-maquina.nombre',
  grupo: 'pierna',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['maquina'],
  musculos: {
    principales: ['gluteo_medio'],
    secundarios: ['gluteo'],
  },
  sustitutos: ['abduccion-tumbado'],
  vista: 'frontal',
  ancla: { punto: 'cadera', x: 0, y: 46, segmento: 'tronco', angulo: 90 },
  poses: [pose(0, 0), pose(300, 0), pose(800, 0.55), pose(1200, 1), pose(1600, 1), pose(2400, 0.55)],
  cicloMs: 3200,
  esfuerzo: [{ desde: 300, hasta: 1200 }],
  msFicha: 1400,
  carga: { tipo: 'abductora', ejeY: 30 },
  escenario: [{ tipo: 'abductora', x: 0, ancho: 34, alto: 39, capa: 'fondo' }],
  encuadre: { x: -48, y: -4, ancho: 96, alto: 104 },
  cues: [
    'iron-pierna:ejercicios.abduccion-maquina.cues.espalda',
    'iron-pierna:ejercicios.abduccion-maquina.cues.abrir',
    'iron-pierna:ejercicios.abduccion-maquina.cues.cerrar',
  ],
  errores: [
    'iron-pierna:ejercicios.abduccion-maquina.errores.inclinar',
    'iron-pierna:ejercicios.abduccion-maquina.errores.golpe',
  ],
};

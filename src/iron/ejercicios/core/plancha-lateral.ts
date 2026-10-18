// NIVL · IRON · Plancha lateral sobre el antebrazo, vista FRONTAL.
//
// Isométrico: tumbado de lado sobre el antebrazo derecho, se levanta la
// cadera hasta que el cuerpo queda recto; el brazo de arriba, al techo. Se
// ve de frente (la persona mira a la cámara), así se leen los oblicuos.
// Biomecánica (comprobada en src/iron/__tests__/core.test.ts):
// · El codo de apoyo justo bajo el hombro (brazo vertical).
// · Hombro, cadera y tobillos en línea recta: la cadera no cae.
// · Pies apilados: el de arriba descansa sobre el de abajo.
// En la vista frontal el lado cercano (el derecho) es el de abajo: el
// antebrazo de apoyo sale hacia la cámara y se dibuja en escorzo.

import type { Ejercicio, Extremidades, Pose } from '../../tipos';

const ABAJO: Extremidades = { cadera: -5.9, rodilla: 0, tobillo: -20, hombro: 71, codo: 90 };
const ARRIBA: Extremidades = { cadera: -6, rodilla: 0, tobillo: 0, hombro: 109, codo: 0 };

const pose = (ms: number): Pose => ({ ms, cuello: 0, cerca: ABAJO, lejos: ARRIBA, escorzo: { antebrazo_c: 0.25 } });

export const planchaLateral: Ejercicio = {
  id: 'plancha-lateral',
  nombre: 'iron-core:ejercicios.plancha-lateral.nombre',
  grupo: 'core',
  nivel: 'intermedio',
  tipo: 'isometrico',
  material: ['esterilla'],
  musculos: {
    principales: ['oblicuos'],
    secundarios: ['transverso', 'abdomen', 'gluteo', 'deltoides_lateral'],
  },
  sustitutos: ['plancha', 'toques-hombro', 'russian-twist'],
  vista: 'frontal',
  // El codo en la esterilla y el brazo de apoyo vertical; el tronco, a 19° del suelo.
  ancla: { punto: 'codo_c', x: 0, y: 3.4, segmento: 'brazo_c', angulo: -90 },
  poses: [pose(0), pose(2000)],
  cicloMs: 4000,
  esfuerzo: [{ desde: 0, hasta: 4000 }],
  escenario: [{ tipo: 'esterilla', x: -18, ancho: 106, alto: 0.8, capa: 'fondo' }],
  encuadre: { x: -22, y: -4, ancho: 112, alto: 96 },
  cues: [
    'iron-core:ejercicios.plancha-lateral.cues.codo',
    'iron-core:ejercicios.plancha-lateral.cues.cadera',
    'iron-core:ejercicios.plancha-lateral.cues.respira',
  ],
  errores: [
    'iron-core:ejercicios.plancha-lateral.errores.caderaCaida',
    'iron-core:ejercicios.plancha-lateral.errores.hombro',
  ],
};

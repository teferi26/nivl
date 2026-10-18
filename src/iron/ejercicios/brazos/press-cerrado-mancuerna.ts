// NIVL · IRON · Press cerrado con mancuernas (agarre neutro), tumbado en el banco.
//
// Las dos mancuernas juntas, palmas mirándose y codos pegados al cuerpo:
// tríceps sobre todo, con menos tensión en las muñecas que con la barra.
// Mismas poses que el press cerrado con barra (despejadas con el antebrazo
// vertical); las mancuernas se ven a lo largo.
// Biomecánica (comprobada en src/iron/__tests__/brazos.test.ts): antebrazos
// verticales y las mancuernas bajan a la parte baja del pecho.

import type { Ejercicio } from '../../tipos';
import { ANCLA_TUMBADO, BANCO_TUMBADO, textos } from './comun';
import { pressCerradoBarra } from './press-cerrado-barra';

const T = textos('press-cerrado-mancuerna', ['juntas', 'codos', 'bajada'], ['separar', 'rebote']);

export const pressCerradoMancuerna: Ejercicio = {
  id: 'press-cerrado-mancuerna',
  nombre: T.nombre,
  grupo: 'brazo',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['mancuerna', 'banco'],
  musculos: { principales: ['triceps'], secundarios: ['pectoral', 'deltoides_anterior'] },
  sustitutos: ['press-cerrado-barra', 'flexiones-diamante', 'fondos-banco'],
  vista: 'lateral',
  ancla: ANCLA_TUMBADO,
  poses: pressCerradoBarra.poses,
  cicloMs: pressCerradoBarra.cicloMs,
  esfuerzo: pressCerradoBarra.esfuerzo,
  msFicha: pressCerradoBarra.msFicha,
  carga: { tipo: 'mancuerna', en: 'agarre', orientacion: 'lado', lados: ['cerca'] },
  escenario: [BANCO_TUMBADO],
  encuadre: { x: -66, y: -4, ancho: 104, alto: 96 },
  cues: T.cues,
  errores: T.errores,
};

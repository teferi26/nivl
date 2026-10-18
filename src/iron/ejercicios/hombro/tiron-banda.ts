// NIVL · IRON · Hombro · Tirón separando la banda (band pull-apart), de pie.
//
// Vista FRONTAL POR DETRÁS (`cara: 'post'`): deltoides posterior y romboides.
// Brazos estirados delante a la altura de los hombros; se abren en
// horizontal hasta quedar en cruz. El brazo gira fuera del plano: el escorzo
// es el seno del ángulo de apertura (casi 0 delante, 1 en cruz). La banda va
// de una mano a la otra por delante del pecho: se tapa detrás del tronco.
// Biomecánica (src/iron/__tests__/hombro.test.ts):
// · Las manos se quedan a la altura de los hombros (±3) todo el recorrido.
// · Codos estirados; tronco quieto.

import type { Ejercicio, Pose } from '../../tipos';
import { ANCLA_PIE_FRONTAL, conBrazos, PIERNAS_PIE_FRONTAL } from './comun';

const pose = (ms: number, apertura: number): Pose => {
  const ve = Math.round(Math.sin((apertura * Math.PI) / 180) * 100) / 100;
  return {
    ms,
    cuello: 0,
    cerca: conBrazos(PIERNAS_PIE_FRONTAL, 90, 0),
    escorzo: { brazo_c: ve, brazo_l: ve, antebrazo_c: ve, antebrazo_l: ve },
  };
};

export const tironBanda: Ejercicio = {
  id: 'tiron-banda',
  nombre: 'iron-hombro:ejercicios.tiron-banda.nombre',
  grupo: 'hombro',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['banda'],
  musculos: {
    principales: ['deltoides_posterior'],
    secundarios: ['espalda_alta', 'trapecio', 'manguito_rotador'],
  },
  sustitutos: ['face-pull-banda', 'pajaro-mancuerna'],
  vista: 'frontal',
  cara: 'post',
  ancla: ANCLA_PIE_FRONTAL,
  poses: [pose(0, 15), pose(300, 15), pose(700, 45), pose(1100, 88), pose(1500, 88), pose(2100, 45)],
  cicloMs: 2900,
  esfuerzo: [{ desde: 300, hasta: 1100 }],
  msFicha: 1300,
  carga: { tipo: 'banda', en: 'agarre', lados: ['cerca', 'lejos'], anclaje: 'manos', oculta: [-11.5, 11.5] },
  encuadre: { x: -56, y: -4, ancho: 112, alto: 108 },
  cues: [
    'iron-hombro:ejercicios.tiron-banda.cues.altura',
    'iron-hombro:ejercicios.tiron-banda.cues.escapulas',
    'iron-hombro:ejercicios.tiron-banda.cues.vuelta',
  ],
  errores: [
    'iron-hombro:ejercicios.tiron-banda.errores.trapecio',
    'iron-hombro:ejercicios.tiron-banda.errores.arco',
  ],
};

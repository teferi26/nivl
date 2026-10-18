// NIVL · IRON · Hombro · Rotación interna con banda, codo pegado al costado.
//
// El giro contrario a la rotación externa (rotacion-externa-banda.ts), con
// la banda anclada del lado del brazo que trabaja: el antebrazo va de fuera
// hacia el ombligo. Vista frontal por detrás, como la externa.
// Biomecánica (src/iron/__tests__/hombro.test.ts): codo quieto junto al
// costado y antebrazo horizontal a la altura del codo.

import type { Ejercicio } from '../../tipos';
import { ANCLA_PIE_FRONTAL } from './comun';
import { CASI_DENTRO, CASI_FUERA, DENTRO, FUERA, MEDIO_FUERA, poseRotacion } from './rotacion-externa-banda';

export const rotacionInternaBanda: Ejercicio = {
  id: 'rotacion-interna-banda',
  nombre: 'iron-hombro:ejercicios.rotacion-interna-banda.nombre',
  grupo: 'hombro',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['banda'],
  musculos: {
    principales: ['manguito_rotador'],
    secundarios: ['pectoral', 'dorsal'],
  },
  sustitutos: ['rotacion-externa-banda'],
  vista: 'frontal',
  cara: 'post',
  ancla: ANCLA_PIE_FRONTAL,
  poses: [
    poseRotacion(0, ...FUERA),
    poseRotacion(300, ...FUERA),
    poseRotacion(600, ...MEDIO_FUERA),
    poseRotacion(850, ...CASI_FUERA),
    poseRotacion(1050, ...CASI_DENTRO),
    poseRotacion(1300, ...DENTRO),
    poseRotacion(1600, ...DENTRO),
    poseRotacion(1950, ...CASI_DENTRO),
    poseRotacion(2200, ...CASI_FUERA),
    poseRotacion(2550, ...MEDIO_FUERA),
  ],
  cicloMs: 3100,
  esfuerzo: [{ desde: 300, hasta: 1300 }],
  msFicha: 150,
  carga: { tipo: 'banda', en: 'agarre', lados: ['cerca'], anclaje: { x: -46, y: 64.4 }, oculta: [-21, 60] },
  encuadre: { x: -52, y: -4, ancho: 100, alto: 108 },
  cues: [
    'iron-hombro:ejercicios.rotacion-interna-banda.cues.codo',
    'iron-hombro:ejercicios.rotacion-interna-banda.cues.lento',
    'iron-hombro:ejercicios.rotacion-interna-banda.cues.ligera',
  ],
  errores: [
    'iron-hombro:ejercicios.rotacion-interna-banda.errores.codo',
    'iron-hombro:ejercicios.rotacion-interna-banda.errores.tronco',
  ],
};

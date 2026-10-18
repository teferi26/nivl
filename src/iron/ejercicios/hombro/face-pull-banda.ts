// NIVL · IRON · Hombro · Face pull con banda, de pie.
//
// Vista FRONTAL POR DETRÁS (`cara: 'post'`). La banda anclada delante, a la
// altura de la cara (tope de puerta o poste): se tapa detrás de la cabeza y
// el tronco. De brazos estirados hacia el anclaje a «portería»: codos altos
// y abiertos a la altura de los hombros y manos junto a las orejas, con las
// palmas mirando al frente (rotación externa).
// Biomecánica (src/iron/__tests__/hombro.test.ts):
// · Los codos nunca por debajo de las manos al final, ni por encima de los
//   hombros más de lo justo (abducción ≤ 95°).
// · Al final, antebrazos verticales (±12°) y manos a la altura de la cabeza.
// Arranque con los brazos hacia delante (casi de punta: escorzo pequeño).

import type { Ejercicio, Pose } from '../../tipos';
import { ANCLA_PIE_FRONTAL, conBrazos, PIERNAS_PIE_FRONTAL } from './comun';

const pose = (ms: number, hombro: number, codo: number, eBrazo: number, eAntebrazo: number): Pose => ({
  ms,
  cuello: 0,
  cerca: conBrazos(PIERNAS_PIE_FRONTAL, hombro, codo),
  escorzo: { brazo_c: eBrazo, brazo_l: eBrazo, antebrazo_c: eAntebrazo, antebrazo_l: eAntebrazo },
});

const ESTIRADO = [80, 0, 0.18, 0.18] as const;
const TIRANDO = [82, 40, 0.55, 0.4] as const;
const CERCA = [85, 80, 0.85, 0.75] as const;
const PORTERIA = [88, 95, 0.92, 0.95] as const;

export const facePullBanda: Ejercicio = {
  id: 'face-pull-banda',
  nombre: 'iron-hombro:ejercicios.face-pull-banda.nombre',
  grupo: 'hombro',
  nivel: 'principiante',
  tipo: 'dinamico',
  material: ['banda'],
  musculos: {
    principales: ['deltoides_posterior'],
    secundarios: ['manguito_rotador', 'espalda_alta', 'trapecio', 'biceps'],
  },
  sustitutos: ['tiron-banda', 'pajaro-mancuerna', 'rotacion-externa-banda'],
  vista: 'frontal',
  cara: 'post',
  ancla: ANCLA_PIE_FRONTAL,
  poses: [
    pose(0, ...ESTIRADO),
    pose(300, ...ESTIRADO),
    pose(650, ...TIRANDO),
    pose(950, ...CERCA),
    pose(1250, ...PORTERIA),
    pose(1650, ...PORTERIA),
    pose(2100, ...CERCA),
    pose(2500, ...TIRANDO),
  ],
  cicloMs: 3000,
  esfuerzo: [{ desde: 300, hasta: 1250 }],
  msFicha: 1450,
  carga: { tipo: 'banda', en: 'agarre', lados: ['cerca', 'lejos'], anclaje: { x: 0, y: 88 }, oculta: [-12, 12] },
  encuadre: { x: -52, y: -4, ancho: 104, alto: 116 },
  cues: [
    'iron-hombro:ejercicios.face-pull-banda.cues.codos',
    'iron-hombro:ejercicios.face-pull-banda.cues.giro',
    'iron-hombro:ejercicios.face-pull-banda.cues.pausa',
  ],
  errores: [
    'iron-hombro:ejercicios.face-pull-banda.errores.codosBajos',
    'iron-hombro:ejercicios.face-pull-banda.errores.tronco',
  ],
};

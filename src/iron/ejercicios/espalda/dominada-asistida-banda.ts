// NIVL · IRON · Dominada asistida con banda elástica, vista lateral.
//
// Ronda 2 (banda del equipo hombro). La misma dominada (dominada.ts) con una
// banda atada a la barra y pasada bajo la rodilla: la banda empuja más abajo,
// donde cuesta más, y menos arriba. La progresión antes de la dominada sin
// ayuda (y una alternativa a la negativa).
// Biomecánica (src/iron/__tests__/ronda2.test.ts y espalda.test.ts): manos
// fijas en la barra, barbilla sobre la barra arriba, la banda va de la barra
// a la rodilla cercana (de perfil pasa por delante del pecho, como en una foto).

import type { Ejercicio } from '../../tipos';
import { ANCLA_COLGADO, BARRA_ALTA, ENCUADRE_COLGADO, ESCENARIO_BARRA_ALTA } from './_colgado';
import { dominada } from './dominada';

export const dominadaAsistidaBanda: Ejercicio = {
  ...dominada,
  id: 'dominada-asistida-banda',
  nombre: 'iron-espalda:ejercicios.dominada-asistida-banda.nombre',
  nivel: 'principiante',
  material: ['barra_fija', 'banda'],
  sustitutos: ['dominada-negativa', 'jalon-pecho', 'remo-invertido'],
  ancla: ANCLA_COLGADO,
  poses: dominada.poses,
  carga: { tipo: 'banda', en: 'rodilla', lados: ['cerca'], anclaje: { x: BARRA_ALTA.x + 1.5, y: BARRA_ALTA.y } },
  escenario: ESCENARIO_BARRA_ALTA,
  encuadre: ENCUADRE_COLGADO,
  cues: [
    'iron-espalda:ejercicios.dominada-asistida-banda.cues.banda',
    'iron-espalda:ejercicios.dominada-asistida-banda.cues.pecho',
    'iron-espalda:ejercicios.dominada-asistida-banda.cues.bajada',
  ],
  errores: [
    'iron-espalda:ejercicios.dominada-asistida-banda.errores.rebote',
    'iron-espalda:ejercicios.dominada-asistida-banda.errores.medio',
  ],
};


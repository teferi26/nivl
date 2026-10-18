// NIVL · IRON · Fase 2, grupo CORE Y CARDIO: core, cardio con peso corporal y
// movilidad básica. Material propio: esterilla, comba y rueda abdominal.
// Músculos propios: transverso del abdomen, serrato anterior y cuello.
// Textos en src/i18n/es/iron-core.json (namespace `iron-core`); lista,
// ronda 2 y riesgos en docs/iron/F2-core.md.
//
// Orden: los más usados primero dentro de cada bloque.

import type { Ejercicio } from '../../tipos';
import { elevacionRodillasColgado } from './elevacion-rodillas-colgado';
import { pallofPress } from './pallof-press';
import { balanceoPierna } from './balanceo-pierna';
import { birdDog } from './bird-dog';
import { bisagraCadera } from './bisagra-cadera';
import { burpees } from './burpees';
import { comba } from './comba';
import { crunch } from './crunch';
import { crunchInverso } from './crunch-inverso';
import { deadBug } from './dead-bug';
import { elevacionesPiernas } from './elevaciones-piernas';
import { flexorCadera } from './flexor-cadera';
import { hollowHold } from './hollow-hold';
import { mountainClimbers } from './mountain-climbers';
import { movilidadTobillo } from './movilidad-tobillo';
import { oso } from './oso';
import { perroBocaAbajo } from './perro-boca-abajo';
import { planchaAlta } from './plancha-alta';
import { planchaLateral } from './plancha-lateral';
import { rodillasArriba } from './rodillas-arriba';
import { ruedaAbdominal } from './rueda-abdominal';
import { russianTwist } from './russian-twist';
import { saltosTijera } from './saltos-tijera';
import { sentadillaSalto } from './sentadilla-salto';
import { talonesGluteo } from './talones-gluteo';
import { tijerasAbdominales } from './tijeras-abdominales';
import { toquesHombro } from './toques-hombro';

export const EJERCICIOS_CORE: readonly Ejercicio[] = [
  // core
  crunch,
  planchaLateral,
  deadBug,
  birdDog,
  mountainClimbers,
  elevacionesPiernas,
  russianTwist,
  planchaAlta,
  hollowHold,
  crunchInverso,
  tijerasAbdominales,
  toquesHombro,
  ruedaAbdominal,
  // cardio y peso corporal
  burpees,
  saltosTijera,
  comba,
  rodillasArriba,
  sentadillaSalto,
  talonesGluteo,
  oso,
  // movilidad básica
  perroBocaAbajo,
  bisagraCadera,
  flexorCadera,
  movilidadTobillo,
  balanceoPierna,
  // ronda 2 (material de otros equipos, integración)
  pallofPress,
  elevacionRodillasColgado,
];

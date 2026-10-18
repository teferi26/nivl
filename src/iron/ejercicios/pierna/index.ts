// NIVL · IRON · Catálogo de PIERNA y GLÚTEO (fase 2).
//
// Los más usados primero; después los de casa y sin material. Un ejercicio
// nuevo: su archivo en esta carpeta y una línea aquí (el test del esquema
// comprueba que el id coincide con el nombre del archivo). Textos en
// src/i18n/es/iron-pierna.json (namespace `iron-pierna`). La sentadilla con
// barra es del prototipo y vive en src/iron/ejercicios/sentadilla-barra.ts.

import type { Ejercicio } from '../../tipos';
import { abduccionMaquina } from './abduccion-maquina';
import { abduccionTumbado } from './abduccion-tumbado';
import { buenosDias } from './buenos-dias';
import { curlFemoralTumbado } from './curl-femoral-tumbado';
import { curlNordico } from './curl-nordico';
import { elevacionTibial } from './elevacion-tibial';
import { extensionCuadriceps } from './extension-cuadriceps';
import { gemelosDePie } from './gemelos-de-pie';
import { gemelosSentado } from './gemelos-sentado';
import { hipThrust } from './hip-thrust';
import { patadaGluteo } from './patada-gluteo';
import { pesoMuertoRumano } from './peso-muerto-rumano';
import { pesoMuertoRumanoMancuerna } from './peso-muerto-rumano-mancuerna';
import { pesoMuertoUnaPierna } from './peso-muerto-una-pierna';
import { prensa } from './prensa';
import { puenteGluteo } from './puente-gluteo';
import { puenteGluteoUnaPierna } from './puente-gluteo-una-pierna';
import { sentadillaBulgara } from './sentadilla-bulgara';
import { sentadillaCajon } from './sentadilla-cajon';
import { sentadillaFrontal } from './sentadilla-frontal';
import { sentadillaGoblet } from './sentadilla-goblet';
import { sentadillaPesoCorporal } from './sentadilla-peso-corporal';
import { stepUpCajon } from './step-up-cajon';
import { swingKettlebell } from './swing-kettlebell';
import { zancadaAtrasMancuerna } from './zancada-atras-mancuerna';
import { zancadaEstatica } from './zancada-estatica';

export const EJERCICIOS_PIERNA: readonly Ejercicio[] = [
  sentadillaFrontal,
  sentadillaGoblet,
  prensa,
  sentadillaBulgara,
  zancadaAtrasMancuerna,
  pesoMuertoRumano,
  hipThrust,
  extensionCuadriceps,
  curlFemoralTumbado,
  gemelosDePie,
  gemelosSentado,
  stepUpCajon,
  swingKettlebell,
  pesoMuertoRumanoMancuerna,
  pesoMuertoUnaPierna,
  buenosDias,
  abduccionMaquina,
  sentadillaPesoCorporal,
  sentadillaCajon,
  zancadaEstatica,
  puenteGluteo,
  puenteGluteoUnaPierna,
  patadaGluteo,
  abduccionTumbado,
  curlNordico,
  elevacionTibial,
];

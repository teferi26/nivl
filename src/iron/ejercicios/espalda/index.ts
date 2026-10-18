// NIVL · IRON · Catálogo del grupo ESPALDA (fase 2).
//
// Un ejercicio nuevo: su archivo en esta carpeta y una línea aquí, en el
// orden en que se proponen (los más usados primero). Textos en
// src/i18n/es/iron-espalda.json; informe en docs/iron/F2-espalda.md.
// Los archivos que empiezan por «_» son ayudas para escribir poses.

import type { Ejercicio } from '../../tipos';
import { buenosDias } from './buenos-dias';
import { dominada } from './dominada';
import { dominadaEscapular } from './dominada-escapular';
import { dominadaNegativa } from './dominada-negativa';
import { dominadaNeutra } from './dominada-neutra';
import { dominadaSupina } from './dominada-supina';
import { encogimientosBarra } from './encogimientos-barra';
import { encogimientosMancuerna } from './encogimientos-mancuerna';
import { facePull } from './face-pull';
import { hiperextension } from './hiperextension';
import { jalonNeutro } from './jalon-neutro';
import { jalonPecho } from './jalon-pecho';
import { jalonSupino } from './jalon-supino';
import { pesoMuerto } from './peso-muerto';
import { pesoMuertoMancuernas } from './peso-muerto-mancuernas';
import { pesoMuertoRumano } from './peso-muerto-rumano';
import { pesoMuertoSumo } from './peso-muerto-sumo';
import { pulloverMancuerna } from './pullover-mancuerna';
import { pulloverPolea } from './pullover-polea';
import { remoBarra } from './remo-barra';
import { remoBarraSupino } from './remo-barra-supino';
import { remoInvertido } from './remo-invertido';
import { remoMancuernas } from './remo-mancuernas';
import { remoMaquina } from './remo-maquina';
import { remoPoleaSentado } from './remo-polea-sentado';
import { superman } from './superman';

export const ESPALDA: readonly Ejercicio[] = [
  dominada,
  dominadaSupina,
  dominadaNeutra,
  dominadaNegativa,
  dominadaEscapular,
  remoInvertido,
  jalonPecho,
  jalonSupino,
  jalonNeutro,
  pulloverPolea,
  remoBarra,
  remoBarraSupino,
  remoMancuernas,
  remoPoleaSentado,
  remoMaquina,
  facePull,
  encogimientosBarra,
  encogimientosMancuerna,
  pesoMuerto,
  pesoMuertoRumano,
  pesoMuertoSumo,
  pesoMuertoMancuernas,
  buenosDias,
  hiperextension,
  superman,
  pulloverMancuerna,
];

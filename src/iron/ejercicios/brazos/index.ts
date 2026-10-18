// NIVL · IRON · Catálogo de BRAZOS (fase 2): bíceps, tríceps y antebrazo.
//
// Un ejercicio nuevo del grupo: su archivo en esta carpeta y una línea aquí
// (el test src/iron/__tests__/brazos.test.ts comprueba que están todos).
// Orden: los más usados primero.

import type { Ejercicio } from '../../tipos';
import { curlArana } from './curl-arana';
import { curlInclinadoMancuerna } from './curl-inclinado-mancuerna';
import { curlPolea } from './curl-polea';
import { extensionTricepsPolea } from './extension-triceps-polea';
import { curlArrastreBarra } from './curl-arrastre-barra';
import { curlBarra } from './curl-barra';
import { curlBarraZ } from './curl-barra-z';
import { curlConcentrado } from './curl-concentrado';
import { curlInversoBarraZ } from './curl-inverso-barra-z';
import { curlMartillo } from './curl-martillo';
import { curlMunecaBarra } from './curl-muneca-barra';
import { curlMunecaEspaldaBarra } from './curl-muneca-espalda-barra';
import { curlSentadoMancuerna } from './curl-sentado-mancuerna';
import { extensionMunecaMancuerna } from './extension-muneca-mancuerna';
import { extensionTricepsCabezaBarraZ } from './extension-triceps-cabeza-barra-z';
import { extensionTricepsCabezaMancuerna } from './extension-triceps-cabeza-mancuerna';
import { flexionesDiamante } from './flexiones-diamante';
import { flexionesDiamanteRodillas } from './flexiones-diamante-rodillas';
import { fondosBanco } from './fondos-banco';
import { fondosBancoPiesElevados } from './fondos-banco-pies-elevados';
import { paseoGranjero } from './paseo-granjero';
import { patadaTriceps } from './patada-triceps';
import { patadaTricepsDePie } from './patada-triceps-de-pie';
import { pressCerradoBarra } from './press-cerrado-barra';
import { pressCerradoMancuerna } from './press-cerrado-mancuerna';
import { pressFrancesBarraZ } from './press-frances-barra-z';
import { pressFrancesMancuerna } from './press-frances-mancuerna';
import { pressFrancesSueloMancuerna } from './press-frances-suelo-mancuerna';

export const BRAZOS: readonly Ejercicio[] = [
  curlBarra,
  curlBarraZ,
  curlMartillo,
  curlConcentrado,
  curlSentadoMancuerna,
  curlInversoBarraZ,
  curlArrastreBarra,
  pressFrancesBarraZ,
  pressCerradoBarra,
  fondosBanco,
  fondosBancoPiesElevados,
  extensionTricepsCabezaMancuerna,
  patadaTriceps,
  pressFrancesMancuerna,
  extensionTricepsCabezaBarraZ,
  pressCerradoMancuerna,
  patadaTricepsDePie,
  flexionesDiamante,
  flexionesDiamanteRodillas,
  pressFrancesSueloMancuerna,
  curlMunecaBarra,
  extensionMunecaMancuerna,
  curlMunecaEspaldaBarra,
  paseoGranjero,
  // ronda 2 (material de otros equipos, integración)
  curlPolea,
  curlInclinadoMancuerna,
  curlArana,
  extensionTricepsPolea,
];

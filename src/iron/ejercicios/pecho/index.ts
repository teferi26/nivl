// NIVL · IRON · Pecho: el catálogo del grupo (equipo PECHO, fase 2).
//
// Los más usados primero; luego los de casa y la progresión de las flexiones.
// Cada ejercicio, su archivo en esta carpeta y una línea aquí; el registro
// general (../index.ts) los añade detrás de los del prototipo.

import type { Ejercicio } from '../../tipos';
import { aperturasDeclinadoMancuerna } from './aperturas-declinado-mancuerna';
import { aperturasInclinadoMancuerna } from './aperturas-inclinado-mancuerna';
import { aperturasMancuerna } from './aperturas-mancuerna';
import { aperturasSueloMancuerna } from './aperturas-suelo-mancuerna';
import { flexionIsometrica } from './flexion-isometrica';
import { flexiones } from './flexiones';
import { flexionesAbiertas } from './flexiones-abiertas';
import { flexionesDeclinadas } from './flexiones-declinadas';
import { flexionesInclinadas } from './flexiones-inclinadas';
import { flexionesPliometricas } from './flexiones-pliometricas';
import { flexionesRodillas } from './flexiones-rodillas';
import { fondosNegativos } from './fondos-negativos';
import { fondosParalelas } from './fondos-paralelas';
import { pecDeck } from './pec-deck';
import { pressBancaMancuerna } from './press-banca-mancuerna';
import { pressDeclinadoBarra } from './press-declinado-barra';
import { pressDeclinadoMancuerna } from './press-declinado-mancuerna';
import { pressInclinadoBarra } from './press-inclinado-barra';
import { pressInclinadoMancuerna } from './press-inclinado-mancuerna';
import { pressSqueezeMancuerna } from './press-squeeze-mancuerna';
import { pressSueloBarra } from './press-suelo-barra';
import { pressSueloMancuerna } from './press-suelo-mancuerna';

export const PECHO: readonly Ejercicio[] = [
  pressInclinadoBarra,
  pressDeclinadoBarra,
  pressSueloBarra,
  pressBancaMancuerna,
  pressInclinadoMancuerna,
  pressDeclinadoMancuerna,
  pressSueloMancuerna,
  pressSqueezeMancuerna,
  aperturasMancuerna,
  aperturasInclinadoMancuerna,
  aperturasDeclinadoMancuerna,
  aperturasSueloMancuerna,
  flexiones,
  flexionesRodillas,
  flexionesInclinadas,
  flexionesDeclinadas,
  flexionesAbiertas,
  flexionesPliometricas,
  flexionIsometrica,
  fondosParalelas,
  fondosNegativos,
  pecDeck,
];

// NIVL · IRON · Material del grupo ESPALDA: tipos y despacho.
//
// Lo que dibujo.ts necesita saber del material de este grupo, en un solo
// sitio: los tipos de escenario y de carga, y una función de dibujo para cada
// lista. Así el motor solo lleva una línea por hueco (escenario y carga) y el
// resto de grupos puede añadir la suya al lado sin tocar esta.

import { dibujarBarraDominadas, type BarraDominadas } from './barra-dominadas';
import {
  dibujarAsiento,
  dibujarHiperextension,
  dibujarPalanca,
  type Asiento,
  type BancoHiperextension,
  type CargaPalanca,
} from './maquina-espalda';
import { dibujarCargaPolea, dibujarTorre, type CargaPolea, type TorrePolea } from './polea';
import type { P } from './trazo-espalda';

export type EscenarioEspalda = TorrePolea | BarraDominadas | Asiento | BancoHiperextension;
export type CargaEspalda = CargaPolea | CargaPalanca;

export function esEscenarioEspalda(b: { readonly tipo: string }): b is EscenarioEspalda {
  'worklet';
  return b.tipo === 'polea' || b.tipo === 'barra_dominadas' || b.tipo === 'asiento' || b.tipo === 'hiperextension';
}

export function esCargaEspalda(c: { readonly tipo: string }): c is CargaEspalda {
  'worklet';
  return c.tipo === 'polea' || c.tipo === 'palanca';
}

export function dibujarEscenarioEspalda(b: EscenarioEspalda): string {
  'worklet';
  if (b.tipo === 'polea') return dibujarTorre(b);
  if (b.tipo === 'barra_dominadas') return dibujarBarraDominadas(b);
  if (b.tipo === 'asiento') return dibujarAsiento(b);
  return dibujarHiperextension(b);
}

/** La carga de una mano (`manos` da el agarre de cada lado del esqueleto). */
export function dibujarCargaEspalda(c: CargaEspalda, lado: 'c' | 'l', manos: { c: P; l: P }): string {
  'worklet';
  if (c.lados.indexOf(lado === 'c' ? 'cerca' : 'lejos') < 0) return '';
  const mano = lado === 'c' ? manos.c : manos.l;
  return c.tipo === 'polea' ? dibujarCargaPolea(c, mano) : dibujarPalanca(c, mano);
}

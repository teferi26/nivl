// NIVL · IRON · Material del equipo PECHO: lo que llama src/iron/dibujo.ts.
//
// Un punto de entrada para el escenario y otro para la carga del pec deck:
// así dibujo.ts solo gana dos líneas y no choca con los demás equipos.

import type { Esqueleto } from '../esqueleto';
import type { EscenarioPecho, Vista } from '../tipos';
import { bancoDeclinado } from './banco-declinado';
import { bancoInclinado } from './banco-inclinado';
import { paralelas } from './paralelas';
import { palancaPecDeck, pecDeck } from './pec-deck';

/** Los escenarios de pecho (los demás grupos tienen los suyos). */
export function esEscenarioPecho(b: { readonly tipo: string }): b is EscenarioPecho {
  'worklet';
  return b.tipo === 'banco_inclinado' || b.tipo === 'banco_declinado' || b.tipo === 'paralelas' || b.tipo === 'pec_deck';
}

export function escenarioPecho(b: EscenarioPecho): string {
  'worklet';
  if (b.tipo === 'banco_inclinado') return bancoInclinado(b.x, b.alto, b.angulo, b.respaldo, b.asiento, b.espejo ? -1 : 1);
  if (b.tipo === 'banco_declinado') return bancoDeclinado(b.x, b.alto, b.angulo, b.respaldo, b.rodillo, b.rodillera);
  if (b.tipo === 'paralelas') return paralelas(b.x, b.ancho, b.alto);
  return pecDeck(b.x, b.alto, b.respaldo, b.travesano, b.pivote);
}

/** Carga del pec deck en un lado (vista frontal: el cercano a la izquierda, eje en -pivote). */
export function cargaPecDeck(e: Esqueleto, pivote: number, lado: 'c' | 'l', vista: Vista): string {
  'worklet';
  const signo = vista === 'frontal' ? (lado === 'c' ? -1 : 1) : 0;
  const eje = e.p.cadera.x + signo * pivote;
  return lado === 'c' ? palancaPecDeck(e.p.codo_c, e.p.agarre_c, eje) : palancaPecDeck(e.p.codo_l, e.p.agarre_l, eje);
}

// NIVL · IRON · Material del equipo PECHO: paralelas, vista lateral.
//
// La persona está entre las dos barras, que van a lo largo de la vista: se
// ve una barra (la otra queda detrás, alineada) de `x` a `x + ancho` a la
// altura `alto`, con sus dos postes y la base. El agarre va en la barra.

import { poste, tablon } from './trazo-pecho';

export const RADIO_PARALELA = 1.6;

export function paralelas(x: number, ancho: number, alto: number): string {
  'worklet';
  const r = RADIO_PARALELA;
  let d = tablon({ x, y: alto }, { x: x + ancho, y: alto }, r * 2, true);
  d += poste(x + 4, alto - r);
  d += poste(x + ancho - 7, alto - r);
  d += tablon({ x: x - 2, y: 1.5 }, { x: x + ancho + 2, y: 1.5 }, 3, true);
  return d;
}

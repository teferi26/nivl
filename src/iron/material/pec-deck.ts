// NIVL · IRON · Material del equipo PECHO: pec deck, vista frontal.
//
// Escenario (fijo): respaldo detrás del tronco, asiento, dos columnas, el
// travesaño y los dos ejes que bajan encima de los hombros (x = ±pivote).
// Carga (se mueve): en cada brazo, la almohadilla a lo largo del antebrazo
// (un marco, para que se vea el músculo debajo) y la palanca horizontal de
// la almohadilla a su eje. Cerca = el brazo derecho de la persona, a la
// izquierda de la pantalla (x negativa).

import type { Punto } from '../esqueleto';
import { poligono, poste, tablon } from './trazo-pecho';

export function pecDeck(x: number, alto: number, respaldo: number, travesano: number, pivote: number): string {
  'worklet';
  const g = 4;
  // Respaldo: de la altura del asiento a `respaldo`, más estrecho que los hombros.
  let d = poligono([
    { x: x - 10, y: alto },
    { x: x + 10, y: alto },
    { x: x + 10, y: respaldo },
    { x: x - 10, y: respaldo },
  ]);
  // Asiento y su pie central.
  d += tablon({ x: x + 15, y: alto }, { x: x - 15, y: alto }, g);
  d += poste(x - 2, alto - g, 4);
  // Columnas, travesaño y los dos ejes.
  const col = pivote + 20;
  d += poste(x - col - 3, travesano);
  d += poste(x + col, travesano);
  d += tablon({ x: x + col + 3, y: travesano + 4 }, { x: x - col - 3, y: travesano + 4 }, 4);
  d += tablon({ x: x - pivote, y: travesano }, { x: x - pivote, y: travesano - 15 }, 2.2, true);
  d += tablon({ x: x + pivote, y: travesano }, { x: x + pivote, y: travesano - 15 }, 2.2, true);
  // Base.
  d += tablon({ x: x - col - 6, y: 1.5 }, { x: x + col + 6, y: 1.5 }, 3, true);
  return d;
}

/** La almohadilla del antebrazo (marco) y la palanca hasta el eje en x = `ejeX`. */
export function palancaPecDeck(codo: Punto, agarre: Punto, ejeX: number): string {
  'worklet';
  const dx = agarre.x - codo.x;
  const dy = agarre.y - codo.y;
  const l = Math.hypot(dx, dy) || 1;
  const u = { x: dx / l, y: dy / l };
  const n = { x: -u.y, y: u.x };
  const a = { x: codo.x - u.x, y: codo.y - u.y };
  const b = { x: agarre.x + u.x * 1.5, y: agarre.y + u.y * 1.5 };
  // Marco: dos rectángulos (la carga se pinta con fillRule evenodd).
  let d = '';
  for (const g of [4.4, 3.4]) {
    d += poligono([
      { x: a.x - n.x * g, y: a.y - n.y * g },
      { x: b.x - n.x * g, y: b.y - n.y * g },
      { x: b.x + n.x * g, y: b.y + n.y * g },
      { x: a.x + n.x * g, y: a.y + n.y * g },
    ]);
  }
  d += tablon(b, { x: ejeX, y: b.y }, 1.6, true);
  return d;
}

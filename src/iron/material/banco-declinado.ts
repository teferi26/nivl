// NIVL · IRON · Material del equipo PECHO: banco declinado, vista lateral.
//
// El tablero baja desde su extremo alto (x, alto) hacia -x a `angulo` grados
// (la cabeza queda más baja que la cadera). Delante, una columna con el
// rodillo donde se enganchan los pies y la rodillera bajo las rodillas.

import { circulo, poste, tablon } from './trazo-pecho';

export function bancoDeclinado(
  x: number,
  alto: number,
  angulo: number,
  respaldo: number,
  rodillo: { x: number; y: number; r: number },
  rodillera: { x: number; y: number; r: number },
): string {
  'worklet';
  const rad = (angulo * Math.PI) / 180;
  const a = Math.PI + rad;
  const fin = { x: x + Math.cos(a) * respaldo, y: alto + Math.sin(a) * respaldo };
  const g = 5;
  const caida = g / Math.cos(rad);
  // El grueso por debajo del tablero.
  let d = tablon({ x, y: alto }, fin, g);
  // Patas: bajo el extremo de la cabeza y bajo el alto.
  d += poste(fin.x + 4, fin.y + Math.tan(rad) * 5.5 - caida);
  d += poste(x - 6, alto - Math.tan(rad) * 4.5 - caida);
  // Columna hasta la rodillera, travesaño hasta la pata alta, el rodillo y la rodillera.
  d += poste(rodillo.x - 1.5, rodillera.y);
  d += tablon({ x: x - 6, y: 8 }, { x: rodillo.x + 1.5, y: 8 }, 3, true);
  d += circulo({ x: rodillo.x, y: rodillo.y }, rodillo.r, 16);
  d += circulo({ x: rodillera.x, y: rodillera.y }, rodillera.r, 16);
  return d;
}

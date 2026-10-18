// NIVL · IRON · Material del equipo PECHO: banco inclinado, vista lateral.
//
// La bisagra está en (x, alto): el asiento sale horizontal hacia +x y el
// respaldo sube hacia -x a `angulo` grados (30 a 45 en el press inclinado).
// Tablones de 5 de grueso por debajo de la superficie, dos patas y un puntal
// bajo el respaldo. La superficie del respaldo es la recta en la que se
// apoya la espalda (src/iron/ejercicios/pecho/_geometria.ts la calcula).

import { poligono, poste, tablon } from './trazo-pecho';

export const GROSOR_BANCO = 5;

export function bancoInclinado(x: number, alto: number, angulo: number, respaldo: number, asiento: number): string {
  'worklet';
  const a = ((180 - angulo) * Math.PI) / 180;
  const fin = { x: x + Math.cos(a) * respaldo, y: alto + Math.sin(a) * respaldo };
  const g = GROSOR_BANCO;
  // Respaldo: el grueso queda por debajo (a la izquierda del sentido bisagra→fin).
  let d = tablon({ x, y: alto }, fin, g);
  d += poligono([
    { x, y: alto },
    { x: x + asiento, y: alto },
    { x: x + asiento, y: alto - g },
    { x, y: alto - g },
  ]);
  d += poste(x + asiento - 7, alto - g);
  d += poste(x - 3, alto - g);
  // Puntal bajo el 70 % del respaldo.
  const px = x + Math.cos(a) * respaldo * 0.7;
  const py = alto + Math.sin(a) * respaldo * 0.7 - g / Math.cos((angulo * Math.PI) / 180);
  d += poste(px - 1.5, py);
  return d;
}

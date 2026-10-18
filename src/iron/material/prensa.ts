// NIVL · IRON · Material: prensa de piernas inclinada (pierna, fase 2).
//
// · Bancada (escenario, no se mueve): asiento y respaldo reclinado. `x`,
//   `alto`: la esquina donde el respaldo se junta con el asiento; el respaldo
//   sube con el ángulo RESPALDO_PRENSA y el asiento sale hacia delante.
// · Carro (carga 'prensa', se mueve): la plataforma apoyada en la planta del
//   pie cercano, perpendicular al raíl, y el carro detrás. El raíl se dibuja
//   fijo: su recta pasa siempre por el carro y se recorta en dos puntos de
//   esa recta que no dependen del instante (a partir de la proyección de la
//   cadera, que está quieta en el asiento).

import { dir, planta, type Esqueleto, type Punto } from '../esqueleto';
import type { Banco } from '../tipos';
import { caja, circulo, rectEje, tramo } from './trazo';

/** Ángulo del respaldo (de la esquina del asiento hacia la cabeza). */
export const RESPALDO_PRENSA = 152;

export function bancadaPrensa(b: Banco): string {
  'worklet';
  const c = { x: b.x, y: b.alto };
  const r = dir(RESPALDO_PRENSA);
  // El acolchado queda por detrás de la línea de apoyo (a la derecha del sentido del respaldo).
  const atras = { x: r.y, y: -r.x };
  const g = 4.6;
  const fin = { x: c.x + r.x * 46, y: c.y + r.y * 46 };
  let d = tramo(
    { x: c.x + atras.x * (g / 2), y: c.y + atras.y * (g / 2) },
    { x: fin.x + atras.x * (g / 2), y: fin.y + atras.y * (g / 2) },
    g,
  );
  // Asiento: corto, hacia delante y algo levantado.
  const s = dir(28);
  const sfin = { x: c.x + s.x * b.ancho, y: c.y + s.y * b.ancho };
  d += tramo({ x: c.x + s.y * (g / 2), y: c.y - s.x * (g / 2) }, { x: sfin.x + s.y * (g / 2), y: sfin.y - s.x * (g / 2) }, g);
  // Bastidor: pata bajo el asiento, apoyo del respaldo y viga en el suelo.
  const pata = { x: c.x + s.x * (b.ancho * 0.5), y: c.y + s.y * (b.ancho * 0.5) - g };
  d += tramo(pata, { x: pata.x, y: 0 }, 3);
  const medio = { x: c.x + r.x * 30 + atras.x * g, y: c.y + r.y * 30 + atras.y * g };
  d += tramo(medio, { x: medio.x + 8, y: 0 }, 2.6);
  d += caja(medio.x - 4, 0, b.x + 112, 2);
  return d;
}

/** Plataforma, carro y raíl. `angulo`: inclinación del raíl (45 en la prensa clásica). */
export function carroPrensa(e: Esqueleto, angulo: number): string {
  'worklet';
  const pl = planta(e, 'c');
  const r = dir(angulo);
  const pie = { x: (pl.talon.x + pl.punta.x) / 2, y: (pl.talon.y + pl.punta.y) / 2 };
  const vx = pl.punta.x - pl.talon.x;
  const vy = pl.punta.y - pl.talon.y;
  const la = Math.hypot(vx, vy);
  const u = { x: vx / la, y: vy / la };
  // Plataforma: contra la planta, centrada un poco hacia la punta.
  const placa = { x: pie.x + r.x * 1.6 + u.x * 2, y: pie.y + r.y * 1.6 + u.y * 2 };
  let d = rectEje(placa, 28, 3.2, u);
  // Carro detrás de la plataforma.
  const carro = { x: placa.x + r.x * 6.5 - u.x * 4, y: placa.y + r.y * 6.5 - u.y * 4 };
  d += rectEje(carro, 10, 22, r);
  // Soporte de los discos y un disco.
  const soporte = { x: carro.x + r.x * 4 + u.x * 6, y: carro.y + r.y * 4 + u.y * 6 };
  d += circulo(soporte, 6.5, 24) + circulo(soporte, 1.6, 10);
  // Raíl fijo por debajo del carro.
  const sobre = { x: carro.x - u.x * 10.4, y: carro.y - u.y * 10.4 };
  const h: Punto = e.p.cadera;
  const k = (h.x - sobre.x) * r.x + (h.y - sobre.y) * r.y;
  const p0 = { x: sobre.x + r.x * (k + 24), y: sobre.y + r.y * (k + 24) };
  const p1 = { x: sobre.x + r.x * (k + 112), y: sobre.y + r.y * (k + 112) };
  d += tramo(p0, p1, 2.4);
  if (p0.y > 0) d += tramo(p0, { x: p0.x, y: 0 }, 2.6);
  if (p1.y > 0) d += tramo(p1, { x: p1.x, y: 0 }, 3);
  return d;
}

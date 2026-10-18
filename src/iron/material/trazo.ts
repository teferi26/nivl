// NIVL · IRON · Material: utilidades de trazado (pierna, fase 2).
//
// Las mismas reglas que src/iron/dibujo.ts: mundo con y hacia arriba, y al
// emitir se invierte (SVG va hacia abajo). Puro y 'worklet'; cada función va
// después de las que llama (regla del plugin de worklets).

import type { Punto } from '../esqueleto';

function n1(v: number): string {
  'worklet';
  return (Math.round(v * 10) / 10).toString();
}

function pt(p: Punto): string {
  'worklet';
  return `${n1(p.x)} ${n1(-p.y)}`;
}

/** Polígono cerrado. */
export function poligono(puntos: Punto[]): string {
  'worklet';
  if (puntos.length === 0) return '';
  let d = `M${pt(puntos[0])}`;
  for (let i = 1; i < puntos.length; i++) d += `L${pt(puntos[i])}`;
  return `${d}Z`;
}

export function circulo(c: Punto, r: number, lados = 18): string {
  'worklet';
  const pts: Punto[] = [];
  for (let i = 0; i < lados; i++) {
    const a = (i / lados) * Math.PI * 2;
    pts.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r });
  }
  return poligono(pts);
}

/** Rectángulo centrado en `c`, con el largo a lo largo de `d` (unitario). */
export function rectEje(c: Punto, largo: number, grueso: number, d: Punto): string {
  'worklet';
  const n = { x: -d.y, y: d.x };
  const a = largo / 2;
  const h = grueso / 2;
  return poligono([
    { x: c.x - d.x * a - n.x * h, y: c.y - d.y * a - n.y * h },
    { x: c.x + d.x * a - n.x * h, y: c.y + d.y * a - n.y * h },
    { x: c.x + d.x * a + n.x * h, y: c.y + d.y * a + n.y * h },
    { x: c.x - d.x * a + n.x * h, y: c.y - d.y * a + n.y * h },
  ]);
}

/** Barra de grosor `grueso` entre dos puntos. */
export function tramo(a: Punto, b: Punto, grueso: number): string {
  'worklet';
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy);
  if (l < 1e-6) return '';
  return rectEje({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, l, grueso, { x: dx / l, y: dy / l });
}

/** Rectángulo alineado con los ejes, de (x0, y0) a (x1, y1). */
export function caja(x0: number, y0: number, x1: number, y1: number): string {
  'worklet';
  return poligono([
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]);
}

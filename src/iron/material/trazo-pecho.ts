// NIVL · IRON · Material del equipo PECHO: trazados básicos.
//
// Los mismos trazados que src/iron/dibujo.ts (mundo con y hacia arriba; al
// emitir se invierte), copiados aquí porque dibujo.ts importa el material y
// no al revés. Puro y 'worklet': cada función va después de las que llama.

import type { Punto } from '../esqueleto';

function n1(v: number): string {
  'worklet';
  return (Math.round(v * 10) / 10).toString();
}

function pt(p: Punto): string {
  'worklet';
  return `${n1(p.x)} ${n1(-p.y)}`;
}

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

/** Una pieza recta de `a` a `b` con `grosor`, a la izquierda del sentido a→b (o centrada). */
export function tablon(a: Punto, b: Punto, grosor: number, centrado = false): string {
  'worklet';
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  const n = { x: -dy / l, y: dx / l };
  const g0 = centrado ? -grosor / 2 : 0;
  const g1 = centrado ? grosor / 2 : grosor;
  return poligono([
    { x: a.x + n.x * g0, y: a.y + n.y * g0 },
    { x: b.x + n.x * g0, y: b.y + n.y * g0 },
    { x: b.x + n.x * g1, y: b.y + n.y * g1 },
    { x: a.x + n.x * g1, y: a.y + n.y * g1 },
  ]);
}

/** Un poste vertical desde el suelo hasta `y`, con su borde izquierdo en `x`. */
export function poste(x: number, y: number, ancho = 3): string {
  'worklet';
  return poligono([
    { x, y },
    { x: x + ancho, y },
    { x: x + ancho, y: 0 },
    { x, y: 0 },
  ]);
}

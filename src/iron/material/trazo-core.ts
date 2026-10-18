// NIVL · IRON · Material (core): primitivas de trazado para las piezas de
// material de la fase 2 (esterilla, comba, rueda). Mismo formato que
// src/iron/dibujo.ts: mundo con y hacia arriba, se invierte al emitir, una
// décima de precisión. Puro y 'worklet' (cada función después de las que usa).

import type { Punto } from '../esqueleto';

function n1(v: number): string {
  'worklet';
  return (Math.round(v * 10) / 10).toString();
}

function pt(p: Punto): string {
  'worklet';
  return `${n1(p.x)} ${n1(-p.y)}`;
}

export function poligonoMat(puntos: Punto[]): string {
  'worklet';
  if (puntos.length === 0) return '';
  let d = `M${pt(puntos[0])}`;
  for (let i = 1; i < puntos.length; i++) d += `L${pt(puntos[i])}`;
  return `${d}Z`;
}

export function circuloMat(c: Punto, r: number, lados = 18): string {
  'worklet';
  const pts: Punto[] = [];
  for (let i = 0; i < lados; i++) {
    const a = (i / lados) * Math.PI * 2;
    pts.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r });
  }
  return poligonoMat(pts);
}

/** Una cinta de grosor `ancho` a lo largo de una línea quebrada (cuerdas, cables). */
export function cintaMat(linea: Punto[], ancho: number): string {
  'worklet';
  if (linea.length < 2) return '';
  const h = ancho / 2;
  const ida: Punto[] = [];
  const vuelta: Punto[] = [];
  for (let i = 0; i < linea.length; i++) {
    const a = linea[Math.max(0, i - 1)];
    const b = linea[Math.min(linea.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const n = { x: -dy / l, y: dx / l };
    ida.push({ x: linea[i].x + n.x * h, y: linea[i].y + n.y * h });
    vuelta.push({ x: linea[i].x - n.x * h, y: linea[i].y - n.y * h });
  }
  vuelta.reverse();
  return poligonoMat(ida.concat(vuelta));
}

/** Rectángulo de `largo` × `grueso` centrado en `c` y orientado según `d` (unitario). */
export function barraMat(c: Punto, d: Punto, largo: number, grueso: number): string {
  'worklet';
  const n = { x: -d.y, y: d.x };
  const a = largo / 2;
  const g = grueso / 2;
  return poligonoMat([
    { x: c.x - d.x * a - n.x * g, y: c.y - d.y * a - n.y * g },
    { x: c.x + d.x * a - n.x * g, y: c.y + d.y * a - n.y * g },
    { x: c.x + d.x * a + n.x * g, y: c.y + d.y * a + n.y * g },
    { x: c.x - d.x * a + n.x * g, y: c.y - d.y * a + n.y * g },
  ]);
}

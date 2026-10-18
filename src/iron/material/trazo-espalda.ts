// NIVL · IRON · Material de ESPALDA: trazos básicos.
//
// Las mismas primitivas que dibujo.ts (polígono, círculo, rectángulo girado)
// para las piezas de este grupo: polea, barra de dominadas, jalón, remo en
// máquina y banco de hiperextensiones. Van aparte para no crear un ciclo de
// imports con dibujo.ts (el plugin de worklets captura lo que usa una función
// al definirla). Mundo con y hacia arriba; al emitir se invierte. 'worklet'.

export interface P {
  x: number;
  y: number;
}

function n1(v: number): string {
  'worklet';
  return (Math.round(v * 10) / 10).toString();
}

function pt(p: P): string {
  'worklet';
  return `${n1(p.x)} ${n1(-p.y)}`;
}

export function poligono(puntos: P[]): string {
  'worklet';
  if (puntos.length === 0) return '';
  let d = `M${pt(puntos[0])}`;
  for (let i = 1; i < puntos.length; i++) d += `L${pt(puntos[i])}`;
  return `${d}Z`;
}

export function circulo(c: P, r: number, lados = 18): string {
  'worklet';
  const pts: P[] = [];
  for (let i = 0; i < lados; i++) {
    const a = (i / lados) * Math.PI * 2;
    pts.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r });
  }
  return poligono(pts);
}

/** Un tramo recto de grosor `grosor` entre a y b (cable, poste, palanca). */
export function tramo(a: P, b: P, grosor: number): string {
  'worklet';
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy);
  if (l < 1e-6) return '';
  const h = grosor / 2;
  const n = { x: (-dy / l) * h, y: (dx / l) * h };
  return poligono([
    { x: a.x + n.x, y: a.y + n.y },
    { x: b.x + n.x, y: b.y + n.y },
    { x: b.x - n.x, y: b.y - n.y },
    { x: a.x - n.x, y: a.y - n.y },
  ]);
}

/** Rectángulo de ancho × alto centrado en c y girado `grados`. */
export function caja(c: P, ancho: number, alto: number, grados = 0): string {
  'worklet';
  const r = (grados * Math.PI) / 180;
  const d = { x: Math.cos(r), y: Math.sin(r) };
  const n = { x: -d.y, y: d.x };
  const a = ancho / 2;
  const h = alto / 2;
  return poligono([
    { x: c.x - d.x * a - n.x * h, y: c.y - d.y * a - n.y * h },
    { x: c.x + d.x * a - n.x * h, y: c.y + d.y * a - n.y * h },
    { x: c.x + d.x * a + n.x * h, y: c.y + d.y * a + n.y * h },
    { x: c.x - d.x * a + n.x * h, y: c.y - d.y * a + n.y * h },
  ]);
}

/** Anillo (se pinta con fillRule evenodd en la capa de carga). */
export function anillo(c: P, r: number, grosor: number): string {
  'worklet';
  return circulo(c, r, 20) + circulo(c, r - grosor, 20);
}

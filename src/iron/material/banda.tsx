// NIVL · IRON · Material: banda elástica (equipo hombro, fase 2).
//
// Una tira fina del agarre al anclaje (un punto fijo, la pisada bajo el pie
// o la otra mano), con una comba suave hacia el suelo para que se lea como
// goma y no como el cable rígido de una polea. Se recalcula en cada cuadro.
// Puro y 'worklet' (corre en el hilo de la interfaz, como dibujo.ts); cada
// función va DESPUÉS de las que llama (regla del plugin de worklets).

import { dir, planta, type Esqueleto, type Punto } from '../esqueleto';
import type { Carga, Vista } from '../tipos';

type CargaBanda = Extract<Carga, { tipo: 'banda' }>;

/** Media anchura de la tira y comba (fracción del largo). */
const MEDIA_TIRA = 0.65;
const COMBA = 0.035;

function n1b(v: number): string {
  'worklet';
  return (Math.round(v * 10) / 10).toString();
}

function tira(pts: Punto[]): string {
  'worklet';
  if (pts.length < 2) return '';
  const ida: Punto[] = [];
  const vuelta: Punto[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const nx = (-dy / l) * MEDIA_TIRA;
    const ny = (dx / l) * MEDIA_TIRA;
    ida.push({ x: pts[i].x + nx, y: pts[i].y + ny });
    vuelta.push({ x: pts[i].x - nx, y: pts[i].y - ny });
  }
  vuelta.reverse();
  const todo = ida.concat(vuelta);
  let d = `M${n1b(todo[0].x)} ${n1b(-todo[0].y)}`;
  for (let i = 1; i < todo.length; i++) d += `L${n1b(todo[i].x)} ${n1b(-todo[i].y)}`;
  return `${d}Z`;
}

/** La curva de a a b (comba hacia abajo), sin el tramo de x que tapa el cuerpo. */
function curva(a: Punto, b: Punto, x0: number, x1: number): string {
  'worklet';
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  if (L < 0.5) return '';
  // Normal que apunta hacia el suelo (o hacia +x si la banda es vertical).
  let nx = -(b.y - a.y) / L;
  let ny = (b.x - a.x) / L;
  if (ny > 0 || (ny === 0 && nx < 0)) {
    nx = -nx;
    ny = -ny;
  }
  const c = { x: (a.x + b.x) / 2 + nx * L * COMBA, y: (a.y + b.y) / 2 + ny * L * COMBA };
  const N = 18;
  let d = '';
  let tramo: Punto[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const u = 1 - t;
    const p = { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
    if (p.x > x0 && p.x < x1) {
      d += tira(tramo);
      tramo = [];
    } else tramo.push(p);
  }
  return d + tira(tramo);
}

/** El anclaje fijo: una pieza pequeña (el tope de puerta o la argolla del poste). */
function anclajeFijo(p: Punto): string {
  'worklet';
  const a = 1.6;
  return `M${n1b(p.x - a)} ${n1b(-p.y - a)}L${n1b(p.x + a)} ${n1b(-p.y - a)}L${n1b(p.x + a)} ${n1b(-p.y + a)}L${n1b(p.x - a)} ${n1b(-p.y + a)}Z`;
}

/** Centro de la pisada (bajo el arco del pie) de un lado. */
function pisada(e: Esqueleto, lado: 'c' | 'l', vista: Vista): Punto {
  'worklet';
  const t = lado === 'c' ? e.p.tobillo_c : e.p.tobillo_l;
  if (vista === 'frontal') return { x: t.x, y: t.y - 3.4 };
  const pl = planta(e, lado);
  const d = dir(e.a[lado === 'c' ? 'pie_c' : 'pie_l']);
  return { x: (pl.talon.x + pl.punta.x) / 2 + d.x * 0.5, y: (pl.talon.y + pl.punta.y) / 2 + 0.8 };
}

/** La capa de la banda de un lado (la de 'manos' va entera en el lado cercano). */
export function banda(e: Esqueleto, carga: CargaBanda, lado: 'c' | 'l', vista: Vista): string {
  'worklet';
  const x0 = carga.oculta ? carga.oculta[0] : 0;
  const x1 = carga.oculta ? carga.oculta[1] : 0;
  if (carga.anclaje === 'manos') {
    if (lado === 'l') return '';
    return curva(e.p.agarre_c, e.p.agarre_l, x0, x1);
  }
  if (carga.lados.indexOf(lado === 'c' ? 'cerca' : 'lejos') < 0) return '';
  const mano = lado === 'c' ? e.p.agarre_c : e.p.agarre_l;
  if (carga.anclaje === 'pies') return curva(mano, pisada(e, lado, vista), x0, x1);
  const fijo = { x: carga.anclaje.x, y: carga.anclaje.y };
  // El anclaje tampoco se ve si cae detrás del cuerpo.
  const tapado = fijo.x > x0 && fijo.x < x1;
  return curva(mano, fijo, x0, x1) + (tapado ? '' : anclajeFijo(fijo));
}

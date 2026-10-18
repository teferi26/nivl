// NIVL · IRON · Motor: del esqueleto al dibujo.
//
// Convierte un esqueleto en una lista FIJA de capas (ranuras), cada una con
// el `d` de un <Path> de SVG. La lista es la misma en todos los cuadros: así
// la pantalla monta los <Path> una vez y Reanimated solo cambia su `d`.
// El orden de las ranuras es el orden de pintado (lo de atrás primero): en la
// vista lateral, el brazo y la pierna del lado lejano, el banco, el tronco y
// la cabeza, la pierna y el brazo cercanos y la carga. Cada segmento tiene
// cuatro ranuras: su silueta, los músculos que no trabaja (gris oscuro, para
// que se lea la musculatura siempre), los secundarios y los principales.
//
// Coordenadas: el mundo va con y hacia arriba; al emitir se invierte (SVG va
// hacia abajo). El encuadre del ejercicio da el viewBox (ver `viewBox`).
// Puro y 'worklet'. Ojo: el plugin de worklets captura lo que usa una
// función al definirla, así que cada función va DESPUÉS de las que llama.

import { construirEsqueleto, dir, LARGO, type Esqueleto, type Punto } from './esqueleto';
import { angulosDePose, angulosEn } from './interpolar';
import { dibujarCargaEspalda, dibujarEscenarioEspalda, esCargaEspalda, esEscenarioEspalda } from './material/espalda';
import { FORMAS_FRONTAL, FORMAS_LATERAL, MUSCULOS, type BaseSegmento } from './musculos';
import { tramoBarraZ } from './material/barra-z';
import type { Ancla, Carga, Ejercicio, Escenario, MusculoId, Pose, SegmentoId, Vista } from './tipos';

export type EstiloCapa =
  | 'cuerpo'
  | 'cuerpoLejos'
  | 'musculo'
  | 'musculoLejos'
  | 'principal'
  | 'secundario'
  | 'principalLejos'
  | 'secundarioLejos'
  | 'carga'
  | 'cargaLejos'
  | 'escenario';

export interface Ranura {
  clave: string;
  estilo: EstiloCapa;
}

type Especial = 'ESC_FONDO' | 'ESC_MEDIO' | 'CARGA_L' | 'CARGA_C';
type Paso = SegmentoId | Especial;

const ORDEN_LATERAL: readonly Paso[] = [
  'ESC_FONDO',
  'brazo_l',
  'antebrazo_l',
  'CARGA_L',
  'muslo_l',
  'pierna_l',
  'pie_l',
  'ESC_MEDIO',
  'tronco',
  'cabeza',
  'muslo_c',
  'pierna_c',
  'pie_c',
  'brazo_c',
  'antebrazo_c',
  'CARGA_C',
];

const ORDEN_FRONTAL: readonly Paso[] = [
  'ESC_FONDO',
  'ESC_MEDIO',
  'muslo_l',
  'pierna_l',
  'pie_l',
  'muslo_c',
  'pierna_c',
  'pie_c',
  'tronco',
  'cabeza',
  'brazo_l',
  'antebrazo_l',
  'brazo_c',
  'antebrazo_c',
  'CARGA_L',
  'CARGA_C',
];

const esEspecial = (p: Paso): p is Especial => p === 'ESC_FONDO' || p === 'ESC_MEDIO' || p === 'CARGA_L' || p === 'CARGA_C';

function baseDe(seg: SegmentoId): BaseSegmento | 'pie' {
  'worklet';
  const i = seg.indexOf('_');
  return (i < 0 ? seg : seg.slice(0, i)) as BaseSegmento | 'pie';
}

function ladoDe(seg: SegmentoId): 'c' | 'l' | null {
  'worklet';
  if (seg.endsWith('_c')) return 'c';
  if (seg.endsWith('_l')) return 'l';
  return null;
}

/** Las capas en orden de pintado. Iguales en todos los cuadros de un ejercicio. */
export function ranuras(vista: Vista): Ranura[] {
  const orden = vista === 'lateral' ? ORDEN_LATERAL : ORDEN_FRONTAL;
  const out: Ranura[] = [];
  for (const paso of orden) {
    if (esEspecial(paso)) {
      const estilo: EstiloCapa = paso.startsWith('ESC') ? 'escenario' : paso === 'CARGA_L' && vista === 'lateral' ? 'cargaLejos' : 'carga';
      out.push({ clave: paso, estilo });
      continue;
    }
    const lejos = vista === 'lateral' && ladoDe(paso) === 'l';
    out.push({ clave: paso, estilo: lejos ? 'cuerpoLejos' : 'cuerpo' });
    out.push({ clave: `${paso}:m`, estilo: lejos ? 'musculoLejos' : 'musculo' });
    out.push({ clave: `${paso}:s`, estilo: lejos ? 'secundarioLejos' : 'secundario' });
    out.push({ clave: `${paso}:p`, estilo: lejos ? 'principalLejos' : 'principal' });
  }
  return out;
}

// ── Grosor del cuerpo ────────────────────────────────────────────────────
// [t, radio por delante, radio por detrás] a lo largo de cada segmento.
// En la vista lateral «delante» es la cara anterior; en la frontal, el lado
// de fuera del cuerpo (los perfiles frontales son simétricos).

type Perfil = readonly (readonly [number, number, number])[];

// Figura atlética: hombros anchos, cintura estrecha y volumen en pecho,
// dorsal, glúteo, cuádriceps, isquios, gemelo, deltoides, bíceps y tríceps.
const PERFIL_LATERAL: Readonly<Record<BaseSegmento, Perfil>> = {
  tronco: [
    [0, 6.6, 8.6],
    [0.12, 6.2, 8.2],
    [0.3, 5.3, 6.2],
    [0.45, 5.6, 6.1],
    [0.62, 7.6, 7.1],
    [0.78, 8.7, 7.5],
    [0.9, 7.7, 7.1],
    [1, 5.8, 6.3],
  ],
  cabeza: [
    [0, 3.2, 3.2],
    [0.55, 2.9, 2.9],
  ],
  muslo: [
    [0, 7.2, 7.1],
    [0.25, 7.5, 6.7],
    [0.5, 6.9, 6.1],
    [0.8, 5.3, 4.8],
    [1, 4, 3.8],
  ],
  pierna: [
    [0, 4, 3.8],
    [0.22, 3.6, 5.8],
    [0.42, 3.3, 5.1],
    [0.72, 2.6, 3],
    [1, 2.2, 2.3],
  ],
  brazo: [
    [0, 5.5, 5.1],
    [0.18, 5.1, 4.9],
    [0.48, 4.7, 4.9],
    [0.72, 4.5, 4],
    [1, 3, 3],
  ],
  antebrazo: [
    [0, 3.4, 3.3],
    [0.25, 3.9, 3.7],
    [0.6, 2.9, 2.8],
    [1, 2.1, 2.1],
  ],
};

const PERFIL_FRONTAL: Readonly<Record<BaseSegmento, Perfil>> = {
  tronco: [
    [0, 9.8, 9.8],
    [0.15, 9.2, 9.2],
    [0.35, 7.6, 7.6],
    [0.5, 8.2, 8.2],
    [0.72, 10.8, 10.8],
    [0.86, 11.4, 11.4],
    [0.95, 9, 9],
    [1, 6, 6],
  ],
  cabeza: [
    [0, 3.6, 3.6],
    [0.55, 3.2, 3.2],
  ],
  muslo: [
    [0, 6.8, 6.8],
    [0.3, 6.6, 6.6],
    [0.85, 4.4, 4.4],
    [1, 3.8, 3.8],
  ],
  pierna: [
    [0, 3.8, 3.8],
    [0.3, 4.5, 4.5],
    [1, 2.2, 2.2],
  ],
  brazo: [
    [0, 5.7, 5.7],
    [0.2, 5, 5],
    [0.55, 4.5, 4.5],
    [1, 3, 3],
  ],
  antebrazo: [
    [0, 3.4, 3.4],
    [0.3, 3.9, 3.9],
    [1, 2.1, 2.1],
  ],
};

const RADIO_CABEZA = 6.2;
const RADIO_MANO = 2.4;

function radios(perfil: Perfil, t: number): [number, number] {
  'worklet';
  if (t <= perfil[0][0]) return [perfil[0][1], perfil[0][2]];
  for (let i = 1; i < perfil.length; i++) {
    const b = perfil[i];
    if (t <= b[0]) {
      const a = perfil[i - 1];
      // Transición suave entre puntos del perfil: el contorno queda redondeado.
      const u = 0.5 - 0.5 * Math.cos((Math.PI * (t - a[0])) / (b[0] - a[0]));
      return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
    }
  }
  const z = perfil[perfil.length - 1];
  return [z[1], z[2]];
}

// ── Emisión de trazados ──────────────────────────────────────────────────

function n1(v: number): string {
  'worklet';
  return (Math.round(v * 10) / 10).toString();
}

function pt(p: Punto): string {
  'worklet';
  return `${n1(p.x)} ${n1(-p.y)}`;
}

function poligono(puntos: Punto[]): string {
  'worklet';
  if (puntos.length === 0) return '';
  let d = `M${pt(puntos[0])}`;
  for (let i = 1; i < puntos.length; i++) d += `L${pt(puntos[i])}`;
  return `${d}Z`;
}

function circulo(c: Punto, r: number, lados = 18): string {
  'worklet';
  const pts: Punto[] = [];
  for (let i = 0; i < lados; i++) {
    const a = (i / lados) * Math.PI * 2;
    pts.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r });
  }
  return poligono(pts);
}

interface Marco {
  /** Origen del segmento. */
  o: Punto;
  /** Dirección (unitaria). */
  d: Punto;
  /** Normal hacia «delante» (anterior o hacia fuera). */
  n: Punto;
  largo: number;
}

function puntoFin(e: Esqueleto, seg: SegmentoId): Punto {
  'worklet';
  switch (seg) {
    case 'tronco':
      return e.p.hombro;
    case 'cabeza':
      return e.p.cabeza;
    case 'muslo_c':
      return e.p.rodilla_c;
    case 'pierna_c':
      return e.p.tobillo_c;
    case 'pie_c':
      return e.p.punta_c;
    case 'brazo_c':
      return e.p.codo_c;
    case 'antebrazo_c':
      return e.p.muneca_c;
    case 'muslo_l':
      return e.p.rodilla_l;
    case 'pierna_l':
      return e.p.tobillo_l;
    case 'pie_l':
      return e.p.punta_l;
    case 'brazo_l':
      return e.p.codo_l;
    default:
      return e.p.muneca_l;
  }
}

function marcoDe(e: Esqueleto, seg: SegmentoId, vista: Vista): Marco {
  'worklet';
  const base = baseDe(seg);
  const lado = ladoDe(seg);
  const d = dir(e.a[seg]);
  const izq = { x: -d.y, y: d.x };
  let signo = 1;
  if (vista === 'lateral') signo = base === 'tronco' || base === 'cabeza' ? -1 : 1;
  else signo = lado === 'c' ? -1 : 1;
  let o: Punto;
  if (seg === 'tronco') o = e.p.cadera;
  else if (seg === 'cabeza') o = e.p.hombro;
  else {
    // El origen es el final del segmento menos su largo (vale en las dos vistas).
    const fin = puntoFin(e, seg);
    o = { x: fin.x - d.x * e.l[seg], y: fin.y - d.y * e.l[seg] };
  }
  return { o, d, n: { x: izq.x * signo, y: izq.y * signo }, largo: e.l[seg] };
}

function en(m: Marco, t: number, off: number): Punto {
  'worklet';
  return { x: m.o.x + m.d.x * m.largo * t + m.n.x * off, y: m.o.y + m.d.y * m.largo * t + m.n.y * off };
}

/** Silueta de un segmento: borde delantero, remate, borde trasero y remate. */
function silueta(m: Marco, perfil: Perfil, t1 = 1): string {
  'worklet';
  const N = 14;
  const pts: Punto[] = [];
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * t1;
    pts.push(en(m, t, radios(perfil, t)[0]));
  }
  // Remate del final: media vuelta de delante a detrás pasando por la punta.
  const [aF, pF] = radios(perfil, t1);
  const cF = en(m, t1, (aF - pF) / 2);
  const rF = (aF + pF) / 2;
  for (let k = 1; k < 7; k++) {
    const th = (k / 7) * Math.PI;
    pts.push({
      x: cF.x + rF * (m.n.x * Math.cos(th) + m.d.x * Math.sin(th)),
      y: cF.y + rF * (m.n.y * Math.cos(th) + m.d.y * Math.sin(th)),
    });
  }
  for (let i = N; i >= 0; i--) {
    const t = (i / N) * t1;
    pts.push(en(m, t, -radios(perfil, t)[1]));
  }
  const [a0, p0] = radios(perfil, 0);
  const c0 = en(m, 0, (a0 - p0) / 2);
  const r0 = (a0 + p0) / 2;
  for (let k = 1; k < 7; k++) {
    const th = (k / 7) * Math.PI;
    pts.push({
      x: c0.x + r0 * (-m.n.x * Math.cos(th) - m.d.x * Math.sin(th)),
      y: c0.y + r0 * (-m.n.y * Math.cos(th) - m.d.y * Math.sin(th)),
    });
  }
  return poligono(pts);
}

/** Vientre muscular: una lente entre t0 y t1, centrada en `centro(t)` con media anchura `media(t)`. */
function vientre(
  m: Marco,
  t0: number,
  t1: number,
  centro: (t: number) => number,
  media: (t: number) => number,
  pico = 0.5,
): string {
  'worklet';
  const N = 12;
  const ida: Punto[] = [];
  const vuelta: Punto[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const t = t0 + (t1 - t0) * u;
    // Más grueso en `pico` y afinado hacia los tendones.
    const v = u < pico ? (u / pico) * 0.5 : 0.5 + ((u - pico) / (1 - pico)) * 0.5;
    const ahusado = Math.pow(Math.sin(Math.PI * v), 0.55);
    const c = centro(t);
    const h = media(t) * ahusado;
    ida.push(en(m, t, c + h));
    vuelta.push(en(m, t, c - h));
  }
  vuelta.reverse();
  return poligono(ida.concat(vuelta));
}

function musculosLateral(m: Marco, base: BaseSegmento, perfil: Perfil, lista: readonly MusculoId[]): string {
  'worklet';
  let d = '';
  for (let i = 0; i < lista.length; i++) {
    const formas = FORMAS_LATERAL[lista[i]];
    for (let j = 0; j < formas.length; j++) {
      const f = formas[j];
      if (f.seg !== base) continue;
      const ancho = f.ancho;
      if (f.cara === 'ant') {
        d += vientre(m, f.t0, f.t1, (t) => radios(perfil, t)[0] * (0.96 - ancho / 2), (t) => (radios(perfil, t)[0] * ancho) / 2, f.pico);
      } else if (f.cara === 'post') {
        d += vientre(m, f.t0, f.t1, (t) => -radios(perfil, t)[1] * (0.96 - ancho / 2), (t) => (radios(perfil, t)[1] * ancho) / 2, f.pico);
      } else {
        d += vientre(
          m,
          f.t0,
          f.t1,
          (t) => (radios(perfil, t)[0] - radios(perfil, t)[1]) / 2,
          (t) => Math.min(radios(perfil, t)[0], radios(perfil, t)[1]) * ancho * 0.9,
          f.pico,
        );
      }
    }
  }
  return d;
}

function musculosFrontal(
  m: Marco,
  base: BaseSegmento,
  perfil: Perfil,
  lista: readonly MusculoId[],
  cara: 'ant' | 'post',
): string {
  'worklet';
  let d = '';
  for (let i = 0; i < lista.length; i++) {
    const formas = FORMAS_FRONTAL[lista[i]];
    for (let j = 0; j < formas.length; j++) {
      const f = formas[j];
      if (f.seg !== base || f.cara !== cara) continue;
      const centro = f.centro;
      const ancho = f.ancho;
      d += vientre(m, f.t0, f.t1, (t) => radios(perfil, t)[0] * centro, (t) => (radios(perfil, t)[0] * ancho) / 2, f.pico);
      if (f.par) d += vientre(m, f.t0, f.t1, (t) => -radios(perfil, t)[0] * centro, (t) => (radios(perfil, t)[0] * ancho) / 2, f.pico);
    }
  }
  return d;
}

function pie(e: Esqueleto, lado: 'c' | 'l', vista: Vista): string {
  'worklet';
  const t = lado === 'c' ? e.p.tobillo_c : e.p.tobillo_l;
  if (vista === 'frontal') {
    const s = lado === 'c' ? -1 : 1;
    return poligono([
      { x: t.x - 2.6 * s, y: t.y + 1.5 },
      { x: t.x + 2.8 * s, y: t.y + 1.5 },
      { x: t.x + 3.6 * s, y: t.y - LARGO.tobillo },
      { x: t.x - 3.2 * s, y: t.y - LARGO.tobillo },
    ]);
  }
  const ang = e.a[lado === 'c' ? 'pie_c' : 'pie_l'];
  const d = dir(ang);
  const n = { x: -d.y, y: d.x };
  const q = (u: number, v: number): Punto => ({ x: t.x + d.x * u + n.x * v, y: t.y + d.y * u + n.y * v });
  return poligono([q(-2.4, 2.2), q(-4.4, -1), q(-4.2, -4), q(LARGO.pie, -4), q(LARGO.pie + 0.6, -2.6), q(10, -1.4), q(3.2, 1.4), q(1, 2.8)]);
}

function cabeza(e: Esqueleto, m: Marco, vista: Vista): string {
  'worklet';
  const c = e.p.cabeza;
  const pts: Punto[] = [];
  const N = 28;
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2;
    const u = { x: Math.cos(th), y: Math.sin(th) };
    let r = RADIO_CABEZA;
    if (vista === 'lateral') {
      // La nariz (un relieve hacia delante y un poco abajo) dice adónde mira.
      const nx = m.n.x * 0.94 - m.d.x * 0.34;
      const ny = m.n.y * 0.94 - m.d.y * 0.34;
      const cos = u.x * nx + u.y * ny;
      if (cos > 0) r += 1.5 * Math.pow(cos, 14);
    }
    pts.push({ x: c.x + u.x * r, y: c.y + u.y * r });
  }
  return poligono(pts);
}

// ── Material ─────────────────────────────────────────────────────────────

const RADIO_DISCO = 12.6;

function disco(c: Punto, r: number): string {
  'worklet';
  // Anillo (se pinta con fillRule evenodd) y el buje.
  return circulo(c, r, 32) + circulo(c, r - 1.1, 32) + circulo(c, 2.2, 12);
}

function rect(cx: number, cy: number, ancho: number, alto: number, d: Punto): string {
  'worklet';
  const n = { x: -d.y, y: d.x };
  const a = ancho / 2;
  const h = alto / 2;
  return poligono([
    { x: cx - d.x * a - n.x * h, y: cy - d.y * a - n.y * h },
    { x: cx + d.x * a - n.x * h, y: cy + d.y * a - n.y * h },
    { x: cx + d.x * a + n.x * h, y: cy + d.y * a + n.y * h },
    { x: cx - d.x * a + n.x * h, y: cy - d.y * a + n.y * h },
  ]);
}

function mancuerna(c: Punto, eje: Punto, deLado: boolean): string {
  'worklet';
  if (!deLado) {
    // De punta: el disco hexagonal y el buje.
    const pts: Punto[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      pts.push({ x: c.x + Math.cos(a) * 4.8, y: c.y + Math.sin(a) * 4.8 });
    }
    return poligono(pts) + circulo(c, 1.4, 10);
  }
  // A lo largo: mango y dos cabezas.
  let d = rect(c.x, c.y, 8, 1.6, eje);
  for (const s of [-1, 1]) d += rect(c.x + eje.x * 6.2 * s, c.y + eje.y * 6.2 * s, 4.4, 8.6, eje);
  return d;
}

function cargaLado(e: Esqueleto, carga: Carga | undefined, lado: 'c' | 'l', vista: Vista): string {
  'worklet';
  if (!carga) return '';
  if (esCargaEspalda(carga)) return dibujarCargaEspalda(carga, lado, { c: e.p.agarre_c, l: e.p.agarre_l });
  if (carga.tipo === 'mancuerna') {
    if (carga.lados.indexOf(lado === 'c' ? 'cerca' : 'lejos') < 0) return '';
    const c = lado === 'c' ? e.p.agarre_c : e.p.agarre_l;
    // El eje de la mano: de la muñeca al puño (sigue al antebrazo salvo que la muñeca gire).
    const m = lado === 'c' ? e.p.muneca_c : e.p.muneca_l;
    const lm = Math.hypot(c.x - m.x, c.y - m.y) || 1;
    const ant = { x: (c.x - m.x) / lm, y: (c.y - m.y) / lm };
    const eje = { x: -ant.y, y: ant.x };
    // En la vista frontal la mancuerna se ve al revés que en la lateral.
    const deLado = vista === 'lateral' ? carga.orientacion === 'lado' : carga.orientacion === 'punta';
    return mancuerna(c, eje, deLado);
  }
  if (vista === 'frontal') {
    if (lado === 'l') return '';
    const a = e.p.agarre_c;
    const b = e.p.agarre_l;
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const h = { x: 1, y: 0 };
    let d = rect(cx, cy, Math.abs(b.x - a.x) + 70, 1.4, h);
    for (const s of [-1, 1]) d += rect(cx + s * (Math.abs(b.x - a.x) / 2 + 28), cy, 3.6, RADIO_DISCO * 2, h);
    return d;
  }
  const c = carga.en === 'agarre' ? e.p.agarre_c : en(marcoDe(e, 'tronco', vista), carga.t, -carga.dorso);
  const r = carga.disco ?? RADIO_DISCO;
  if (!carga.eje) return lado === 'c' ? disco(c, r) : '';
  // Cámara en 3/4: el tramo de barra que sale hacia la cámara y su disco,
  // apartados de la cabeza y el torso. El lado lejano queda tapado por el cuerpo.
  if (lado === 'l') return '';
  const ex = carga.eje.x;
  const ey = carga.eje.y;
  const largo = Math.hypot(ex, ey);
  const u = { x: ex / largo, y: ey / largo };
  const tramo = carga.forma === 'z' ? tramoBarraZ(c, carga.eje) : rect(c.x + ex / 2, c.y + ey / 2, largo + 3, 1.5, u);
  return tramo + disco({ x: c.x + ex, y: c.y + ey }, r);
}

/** Dónde está el centro de la barra (para los tests de trayectoria). */
export function centroCarga(e: Esqueleto, carga: Carga | undefined, vista: Vista): Punto | null {
  'worklet';
  if (!carga) return null;
  if (esCargaEspalda(carga) || carga.tipo === 'mancuerna' || carga.en === 'agarre') return e.p.agarre_c;
  return en(marcoDe(e, 'tronco', vista), carga.t, -carga.dorso);
}

function escenario(lista: Ejercicio['escenario'], capa: 'fondo' | 'medio'): string {
  'worklet';
  if (!lista) return '';
  let d = '';
  for (let i = 0; i < lista.length; i++) {
    const b = lista[i];
    if (b.capa !== capa) continue;
    if (esEscenarioEspalda(b)) {
      d += dibujarEscenarioEspalda(b);
      continue;
    }
    const grosor = 5;
    d += poligono([
      { x: b.x, y: b.alto },
      { x: b.x + b.ancho, y: b.alto },
      { x: b.x + b.ancho, y: b.alto - grosor },
      { x: b.x, y: b.alto - grosor },
    ]);
    for (const px of [b.x + 7, b.x + b.ancho - 10]) {
      d += poligono([
        { x: px, y: b.alto - grosor },
        { x: px + 3, y: b.alto - grosor },
        { x: px + 3, y: 0 },
        { x: px, y: 0 },
      ]);
    }
  }
  return d;
}

// ── Montaje ──────────────────────────────────────────────────────────────

export interface Musculos {
  principales: readonly MusculoId[];
  secundarios: readonly MusculoId[];
}

/** Las capas de un esqueleto ya construido (en el orden de `ranuras`). */
export function capasDe(
  e: Esqueleto,
  vista: Vista,
  musculos: Musculos,
  carga?: Carga,
  lista?: Ejercicio['escenario'],
  cara: 'ant' | 'post' = 'ant',
): string[] {
  'worklet';
  const orden = vista === 'lateral' ? ORDEN_LATERAL : ORDEN_FRONTAL;
  const perfiles = vista === 'lateral' ? PERFIL_LATERAL : PERFIL_FRONTAL;
  const out: string[] = [];
  for (let i = 0; i < orden.length; i++) {
    const paso = orden[i];
    if (paso === 'ESC_FONDO') out.push(escenario(lista, 'fondo'));
    else if (paso === 'ESC_MEDIO') out.push(escenario(lista, 'medio'));
    else if (paso === 'CARGA_L') out.push(cargaLado(e, carga, 'l', vista));
    else if (paso === 'CARGA_C') out.push(cargaLado(e, carga, 'c', vista));
    else {
      const base = baseDe(paso);
      if (base === 'pie') {
        out.push(pie(e, paso === 'pie_c' ? 'c' : 'l', vista), '', '', '');
        continue;
      }
      const m = marcoDe(e, paso, vista);
      const perfil = perfiles[base];
      const inactivos: MusculoId[] = [];
      for (let k = 0; k < MUSCULOS.length; k++) {
        const mu = MUSCULOS[k];
        if (musculos.principales.indexOf(mu) < 0 && musculos.secundarios.indexOf(mu) < 0) inactivos.push(mu);
      }
      const resto =
        vista === 'lateral' ? musculosLateral(m, base, perfil, inactivos) : musculosFrontal(m, base, perfil, inactivos, cara);
      // La cabeza va sin cuello dibujado: el remate del tronco llega a su base.
      let cuerpo = base === 'cabeza' ? cabeza(e, m, vista) : silueta(m, perfil);
      if (base === 'antebrazo') cuerpo += circulo(paso === 'antebrazo_c' ? e.p.agarre_c : e.p.agarre_l, RADIO_MANO, 12);
      const prin =
        vista === 'lateral'
          ? musculosLateral(m, base, perfil, musculos.principales)
          : musculosFrontal(m, base, perfil, musculos.principales, cara);
      const sec =
        vista === 'lateral'
          ? musculosLateral(m, base, perfil, musculos.secundarios)
          : musculosFrontal(m, base, perfil, musculos.secundarios, cara);
      out.push(cuerpo, resto, sec, prin);
    }
  }
  return out;
}

export function esqueletoEn(ej: Ejercicio, ms: number): Esqueleto {
  'worklet';
  return construirEsqueleto(angulosEn(ej, ms), ej.ancla, ej.vista);
}

/** Todas las capas de un ejercicio en el instante `ms` del ciclo. */
export function dibujar(ej: Ejercicio, ms: number): string[] {
  'worklet';
  return capasDe(esqueletoEn(ej, ms), ej.vista, ej.musculos, ej.carga, ej.escenario);
}

/**
 * Cuánto brilla el músculo principal en el instante `ms` (0 a 1): sube y
 * baja dentro de cada fase de esfuerzo. En un isométrico late todo el ciclo.
 */
export function esfuerzoEn(ej: Pick<Ejercicio, 'esfuerzo' | 'cicloMs' | 'tipo'>, ms: number): number {
  'worklet';
  const t = ((ms % ej.cicloMs) + ej.cicloMs) % ej.cicloMs;
  if (ej.tipo === 'isometrico') return 0.5 - 0.5 * Math.cos((t / ej.cicloMs) * Math.PI * 2);
  for (let i = 0; i < ej.esfuerzo.length; i++) {
    const f = ej.esfuerzo[i];
    if (t >= f.desde && t <= f.hasta) return Math.pow(Math.sin(((t - f.desde) / (f.hasta - f.desde)) * Math.PI), 0.6);
  }
  return 0;
}

/** viewBox del SVG a partir del encuadre (el mundo va con y hacia arriba). */
export function viewBox(ej: Pick<Ejercicio, 'encuadre'>): string {
  const { x, y, ancho, alto } = ej.encuadre;
  return `${x} ${-(y + alto)} ${ancho} ${alto}`;
}

// ── Mapa de cuerpo entero ────────────────────────────────────────────────

const DE_PIE: Pose = {
  ms: 0,
  cuello: 0,
  cerca: { cadera: 4, rodilla: 0, tobillo: 0, hombro: 9, codo: 6 },
};
const ANCLA_MAPA: Ancla = { punto: 'cadera', x: 0, y: 52, segmento: 'tronco', angulo: 90 };

/**
 * El mapa muscular de cuerpo entero (vista frontal de pie): `cara` 'ant' es
 * por delante; 'post', por detrás (la pantalla lo pinta en espejo).
 */
export function capasMapa(musculos: Musculos, cara: 'ant' | 'post'): string[] {
  const ej = { ancla: ANCLA_MAPA } as Pick<Ejercicio, 'ancla'>;
  const e = construirEsqueleto(angulosDePose(ej as Ejercicio, DE_PIE), ANCLA_MAPA, 'frontal');
  return capasDe(e, 'frontal', musculos, undefined, undefined, cara);
}

export const ENCUADRE_MAPA = { x: -34, y: -2, ancho: 68, alto: 108 } as const;

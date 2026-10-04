// NIVL · Arena: la geometría de los motivos (puro, con test).
//
// Solo cadenas `d` de SVG. Todo es un trazo sin relleno, extremos redondos: el
// mismo lenguaje que la galea y las coronas (Crown.tsx). Las coordenadas salen
// ya escaladas al tamaño pedido para que el grosor del trazo se quede en pt
// (1,5 a 20 pt de alto igual que a 120).

/** Número con dos decimales como mucho, sin ceros de cola («12.5», «8»). */
const f = (n: number): string => {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
};

// ── Laurel ────────────────────────────────────────────────────────────
// Rama vertical en una retícula de 24 × 64 (la de Perfil.dc puesta en pie).
// El tallo se curva hacia la izquierda: es la rama izquierda de la corona del
// vencedor. La derecha es su espejo (Motivos.tsx la voltea con scaleX: -1).
//
// Cada hoja es una almendra cerrada (dos cuadráticas de punta a punta, solo
// contorno). Salen alternas, una por fuera y otra por dentro, inclinadas hacia
// la punta y cada vez más pequeñas; la rama remata con una hoja en el eje del
// tallo. El número de hojas depende del alto: a 20 pt caben pocas y grandes, a
// 88 pt la rama se llena.

/** Ancho de la retícula del laurel. */
export const LAUREL_ANCHO = 24;
/** Alto de la retícula del laurel. */
export const LAUREL_ALTO = 64;

/** Tallo: cúbica de la base (16, 63) a la punta (14, 12), combada a la izquierda. */
const TALLO: [number, number][] = [
  [16, 63],
  [8.5, 49],
  [8, 26],
  [14, 12],
];

/** Ángulo de la hoja respecto al tallo (rad): apunta hacia la punta de la rama. */
const ANGULO_HOJA = 0.62;
/** Ancho de la almendra respecto a su largo (desvío del control de la cuadrática). */
const PANZA = 0.42;
/** La hoja más alta mide esta fracción de la más baja. */
const MENGUA = 0.5;
/** Las de dentro, algo más cortas: la corona se cierra hacia el centro. */
const HOJA_DENTRO = 0.85;
/** Largo de la hoja de la punta (retícula). */
const HOJA_PUNTA = 11;
/** Margen (retícula) que ninguna hoja pisa: el trazo no se corta en el borde. */
const MARGEN_LAUREL = 1;

function bezier(t: number, eje: 0 | 1): number {
  const [p0, p1, p2, p3] = TALLO.map((p) => p[eje]);
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

function tangente(t: number, eje: 0 | 1): number {
  const [p0, p1, p2, p3] = TALLO.map((p) => p[eje]);
  const u = 1 - t;
  return 3 * u * u * (p1 - p0) + 6 * u * t * (p2 - p1) + 3 * t * t * (p3 - p2);
}

/** x del tallo a la altura y (la y del tallo baja monótona con t: bisección). */
export function xDelTallo(y: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (bezier(mid, 1) > y) lo = mid;
    else hi = mid;
  }
  return bezier((lo + hi) / 2, 0);
}

/** Pares de hojas (una por fuera y otra por dentro) según el alto en pt: 2 a 20, 4 a 44, 7 a 88. */
export function paresLaurel(alto: number): number {
  return Math.max(2, Math.min(7, Math.round(alto / 12)));
}

/** Una hoja: punto del tallo donde nace, dirección unitaria y largo, en la retícula. */
interface Hoja {
  x: number;
  y: number;
  ux: number;
  uy: number;
  largo: number;
}

/** Dentro de la retícula con margen (control incluido: la curva queda dentro). */
function cabe(h: Hoja): boolean {
  const nx = -h.uy;
  const ny = h.ux;
  const mx = h.x + (h.ux * h.largo) / 2;
  const my = h.y + (h.uy * h.largo) / 2;
  const c = PANZA * h.largo;
  const puntos = [
    [h.x + h.ux * h.largo, h.y + h.uy * h.largo],
    [mx + nx * c, my + ny * c],
    [mx - nx * c, my - ny * c],
  ];
  return puntos.every(
    ([px, py]) =>
      px >= MARGEN_LAUREL && px <= LAUREL_ANCHO - MARGEN_LAUREL && py >= MARGEN_LAUREL && py <= LAUREL_ALTO - MARGEN_LAUREL,
  );
}

/** Acorta la hoja lo justo para que quepa (bisección sobre el largo). */
function encajar(h: Hoja): Hoja {
  if (cabe(h)) return h;
  let lo = 0;
  let hi = h.largo;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (cabe({ ...h, largo: mid })) lo = mid;
    else hi = mid;
  }
  return { ...h, largo: lo };
}

/** Hojas de la rama en la retícula de 24 × 64 (de la base a la punta). */
function hojas(pares: number): Hoja[] {
  // Las hojas nacen entre t = 0,1 y t = 0,92; la punta lleva la suya en t = 1.
  const t0 = 0.1;
  const t1 = 0.92;
  const paso = (t1 - t0) / (pares * 2 - 1);
  // Más pares, hojas más cortas: se solapan como en la rama real sin taparse.
  const largoBase = Math.min(17, 7 + 40 / pares);
  const out: Hoja[] = [];
  for (let i = 0; i < pares * 2; i++) {
    const t = t0 + paso * i;
    const fuera = i % 2 === 0;
    let tx = tangente(t, 0);
    let ty = tangente(t, 1);
    const n = Math.hypot(tx, ty) || 1;
    tx /= n;
    ty /= n;
    // Normal hacia fuera (izquierda en pantalla): (ty, -tx). Dentro, la contraria.
    const s = fuera ? 1 : -1;
    const ox = ty * s;
    const oy = -tx * s;
    const ux = Math.cos(ANGULO_HOJA) * tx + Math.sin(ANGULO_HOJA) * ox;
    const uy = Math.cos(ANGULO_HOJA) * ty + Math.sin(ANGULO_HOJA) * oy;
    const avance = i / (pares * 2 - 1);
    const largo = largoBase * (1 - (1 - MENGUA) * avance) * (fuera ? 1 : HOJA_DENTRO);
    out.push(encajar({ x: bezier(t, 0), y: bezier(t, 1), ux, uy, largo }));
  }
  const tx = tangente(1, 0);
  const ty = tangente(1, 1);
  const n = Math.hypot(tx, ty) || 1;
  out.push(encajar({ x: bezier(1, 0), y: bezier(1, 1), ux: tx / n, uy: ty / n, largo: HOJA_PUNTA }));
  return out;
}

/** Almendra cerrada de la base a la punta: dos cuadráticas con el control a cada lado. */
function almendra(h: Hoja, k: number): string {
  const px = h.x + h.ux * h.largo;
  const py = h.y + h.uy * h.largo;
  const mx = h.x + (h.ux * h.largo) / 2;
  const my = h.y + (h.uy * h.largo) / 2;
  const c = PANZA * h.largo;
  const nx = -h.uy * c;
  const ny = h.ux * c;
  return (
    `M${f(h.x * k)} ${f(h.y * k)}` +
    `Q${f((mx + nx) * k)} ${f((my + ny) * k)} ${f(px * k)} ${f(py * k)}` +
    `Q${f((mx - nx) * k)} ${f((my - ny) * k)} ${f(h.x * k)} ${f(h.y * k)}Z`
  );
}

/**
 * Rama de laurel de `alto` pt; su ancho es `alto · 24 / 64`. Tallo, `paresLaurel(alto)`
 * pares de hojas alternas (fuera y dentro, decrecientes) y la hoja de la punta.
 * Todo en coordenadas absolutas.
 */
export function pathLaurel(alto: number): string {
  if (!(alto > 0)) return '';
  const k = alto / LAUREL_ALTO;
  const [a, b, c, d] = TALLO;
  let out = `M${f(a[0] * k)} ${f(a[1] * k)}C${f(b[0] * k)} ${f(b[1] * k)} ${f(c[0] * k)} ${f(c[1] * k)} ${f(d[0] * k)} ${f(d[1] * k)}`;
  for (const h of hojas(paresLaurel(alto))) out += almendra(h, k);
  return out;
}

// ── Columna dórica ───────────────────────────────────────────────────
// Retícula de 24 de ancho: capitel de dos líneas, fuste de dos, dos estrías y
// basa de dos. El alto es libre (podio: 72 · 96 · 128).

/** Columna de `alto` pt y `ancho` pt (24 por defecto; la x se escala). */
export function pathColumna(alto: number, ancho = 24): string {
  const h = Math.max(alto, 20);
  const kx = ancho / 24;
  const x = (n: number) => f(n * kx);
  return [
    `M${x(2)} 4H${x(22)}M${x(4)} 8H${x(20)}`, // capitel
    `M${x(6)} 8V${f(h - 10)}M${x(18)} 8V${f(h - 10)}`, // fuste
    `M${x(10)} 12V${f(h - 14)}M${x(14)} 12V${f(h - 14)}`, // estrías
    `M${x(4)} ${f(h - 8)}H${x(20)}M${x(2)} ${f(h - 4)}H${x(22)}`, // basa
  ].join('');
}

// ── Arena ─────────────────────────────────────────────────────────────
// `arco`: el graderío visto de frente, semielipses concéntricas apoyadas en el
// borde inferior y 15 arcadas sobre la grada exterior. `ovalo`: la planta, dos
// elipses y el eje.

/** Arcadas sobre la grada exterior del arco. */
export const ARCADAS = 15;
/** Largo de cada arcada (pt). */
export const LARGO_ARCADA = 8;
/** Medio trazo de margen para que el borde no se corte. */
const MARGEN = 1;

function semielipse(cx: number, base: number, rx: number, ry: number): string {
  return `M${f(cx - rx)} ${f(base)}A${f(rx)} ${f(ry)} 0 0 1 ${f(cx + rx)} ${f(base)}`;
}

function elipse(cx: number, cy: number, rx: number, ry: number): string {
  return (
    `M${f(cx - rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 1 ${f(cx + rx)} ${f(cy)}` +
    `A${f(rx)} ${f(ry)} 0 1 1 ${f(cx - rx)} ${f(cy)}`
  );
}

/** Gradas que caben antes de que el radio se haga cero (rx y ry > 0). */
export function gradasUtiles(gradas: number): number {
  // ry = alto · (0,92 − 0,18·i) > 0 → i ≤ 5; rx = ancho · (0,47 − 0,08·i) > 0 → i ≤ 5.
  return Math.max(1, Math.min(Math.floor(gradas), 5));
}

export function pathArena(ancho: number, alto: number, gradas: number, variante: 'arco' | 'ovalo'): string {
  if (ancho <= 0 || alto <= 0) return '';
  const cx = ancho / 2;
  if (variante === 'ovalo') {
    const rx = cx - MARGEN;
    const ry = alto / 2 - MARGEN;
    const cy = alto / 2;
    const rxDentro = rx * 0.62;
    const ryDentro = ry * 0.56;
    return (
      elipse(cx, cy, rx, ry) +
      elipse(cx, cy, rxDentro, ryDentro) +
      `M${f(cx - rxDentro)} ${f(cy)}H${f(cx + rxDentro)}`
    );
  }
  const base = alto - MARGEN;
  let out = '';
  const n = gradasUtiles(gradas);
  for (let i = 0; i < n; i++) {
    out += semielipse(cx, base, ancho * (0.47 - 0.08 * i), alto * (0.92 - 0.18 * i));
  }
  // Arcadas: marcas radiales hacia el centro desde la grada exterior.
  const rx = ancho * 0.47;
  const ry = alto * 0.92;
  for (let k = 0; k < ARCADAS; k++) {
    const th = (Math.PI * (k + 0.5)) / ARCADAS;
    const x = cx - rx * Math.cos(th);
    const y = base - ry * Math.sin(th);
    const vx = cx - x;
    const vy = base - y;
    const largo = Math.hypot(vx, vy) || 1;
    const l = Math.min(LARGO_ARCADA, largo);
    out += `M${f(x)} ${f(y)}L${f(x + (vx / largo) * l)} ${f(y + (vy / largo) * l)}`;
  }
  return out;
}

// ── Meandro (greca) ──────────────────────────────────────────────────
// Unidad de 10 × 10 que se repite en un Pattern: línea de base y el gancho.

export const MEANDRO_UNIDAD = 10;
export const PATH_MEANDRO = 'M0 9.5H10 M0.5 9.5V0.5H8.5V6.5H3.5V3.5H6';

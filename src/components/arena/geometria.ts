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
// El tallo se curva hacia la izquierda: es la rama izquierda de una corona.
// La derecha es su espejo (Motivos.tsx la voltea con scaleX: -1).

/** Ancho de la retícula del laurel. */
export const LAUREL_ANCHO = 24;
/** Alto de la retícula del laurel. */
export const LAUREL_ALTO = 64;

/** Tallo: cúbica de (18, 62) a (16, 2) con los controles a x = 6. */
const TALLO: [number, number][] = [
  [18, 62],
  [6, 48],
  [6, 20],
  [16, 2],
];

/** Hojas por fuera (hacia la izquierda): altura en el tallo y vector de la hoja. */
const HOJAS: { y: number; dx: number; dy: number }[] = [
  { y: 50, dx: -7, dy: -3 },
  { y: 38, dx: -7, dy: -4 },
  { y: 26, dx: -6, dy: -5 },
  { y: 14, dx: -4, dy: -6 },
];

/** Las de dentro son el espejo, más cortas. */
const HOJA_DENTRO = 0.6;

function bezier(t: number, eje: 0 | 1): number {
  const [p0, p1, p2, p3] = TALLO.map((p) => p[eje]);
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
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

/**
 * Rama de laurel de `alto` pt; su ancho es `alto · 24 / 64`. Tallo más cuatro
 * pares de hojas (por fuera y, más cortas, por dentro).
 */
export function pathLaurel(alto: number): string {
  const k = alto / LAUREL_ALTO;
  const [a, b, c, d] = TALLO;
  let out = `M${f(a[0] * k)} ${f(a[1] * k)}C${f(b[0] * k)} ${f(b[1] * k)} ${f(c[0] * k)} ${f(c[1] * k)} ${f(d[0] * k)} ${f(d[1] * k)}`;
  for (const h of HOJAS) {
    const x = xDelTallo(h.y) * k;
    const y = h.y * k;
    out += `M${f(x)} ${f(y)}l${f(h.dx * k)} ${f(h.dy * k)}`;
    out += `M${f(x)} ${f(y)}l${f(-h.dx * HOJA_DENTRO * k)} ${f(h.dy * HOJA_DENTRO * k)}`;
  }
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

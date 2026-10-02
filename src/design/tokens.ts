// NIVL · Sistema de diseño v2 «Mármol y tinta». Fuente única de tokens.
// Documento: docs/design-v2/SISTEMA.md. Solo blanco y negro: el significado va
// en inversión, trazo, trama y grano, nunca en color.
//
// Puro (sin imports de React Native) para poder testearlo.

export const ink = {
  ink0: '#000000', // fondo
  ink1: '#0B0B0B', // superficie
  ink2: '#161616', // superficie elevada, campo
  ink3: '#242424', // hairline
  ink4: '#3A3A3A', // pista, borde de control (no es texto)
  ink6: '#8C8C8C', // texto terciario
  ink8: '#BDBDBD', // texto secundario
  ink9: '#EDEDED', // texto principal
  ink10: '#FFFFFF', // acento: inversión, CTA, nivel
} as const;

export type InkToken = keyof typeof ink;

/** Escala de espaciado (pt). Base 4. */
export const space = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s8: 32, s10: 40, s14: 56, s20: 80 } as const;

/** Trazos: la jerarquía y el rango se dicen con el peso, no con el color. */
export const stroke = { hairline: 1, rule: 2, frame: 3 } as const;

export const type = {
  display: { family: 'Cinzel_700Bold', size: 56, lineHeight: 60, tracking: 2 },
  rank: { family: 'Cinzel_700Bold', size: 32, lineHeight: 36, tracking: 4 },
  title: { family: 'Outfit_700Bold', size: 30, lineHeight: 34, tracking: -0.6 },
  headline: { family: 'Outfit_700Bold', size: 20, lineHeight: 26, tracking: -0.2 },
  body: { family: 'Outfit_500Medium', size: 16, lineHeight: 24, tracking: 0 },
  bodySm: { family: 'Outfit_500Medium', size: 14, lineHeight: 20, tracking: 0 },
  label: { family: 'Outfit_700Bold', size: 12, lineHeight: 16, tracking: 2 },
  number: { family: 'Cinzel_600SemiBold', size: 24, lineHeight: 28, tracking: 0 },
  micro: { family: 'Outfit_600SemiBold', size: 11, lineHeight: 14, tracking: 1 },
} as const;

export const motion = { instant: 100, quick: 180, base: 260, slow: 420, ceremony: 1600 } as const;

// ── Clases de tamaño ──────────────────────────────────────────────────
export type SizeClass = 'compact' | 'medium' | 'expanded';

export function sizeClass(width: number): SizeClass {
  if (width >= 1024) return 'expanded';
  if (width >= 600) return 'medium';
  return 'compact';
}

export const layout = {
  compact: { gutter: 20, maxContent: 560, nav: 'tabs' },
  medium: { gutter: 32, maxContent: 640, nav: 'rail' },
  expanded: { gutter: 48, maxContent: 720, nav: 'sidebar' },
} as const;

/** Anchos en los que se verifica cada pantalla. */
export const VERIFY_WIDTHS = [375, 430, 744, 1024, 1440] as const;

// ── Rango → tema ──────────────────────────────────────────────────────
export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export interface RankTheme {
  /** Marco del contrato de progresión (Chat 5, progression.ts → cosmeticosDe). */
  marco: 'liso' | 'doble' | 'remachado' | 'laurel_simple' | 'laurel_doble' | 'laurel_corona';
  /** Grosor del aro del avatar (pt). */
  ring: number;
  /** Segundo aro concéntrico. */
  doubleRing: boolean;
  /** Muescas del marco (0 = ninguna). */
  notches: number;
  /** Desde B, el casco; S, la corona de laurel. */
  crown: 'none' | 'casco' | 'corona';
  /** Grano en cabecera/tarjeta de nivel: 0 nada · 1 suave · 2 marcado. */
  grain: 0 | 1 | 2;
  /** Brillo animado del marco (solo S; quieto con reducir movimiento). */
  shimmer: boolean;
  /** Título por defecto (el vigente lo da tituloVigente() del Chat 5). */
  defaultTitle: string;
  /** Nivel en que se entra al rango (contrato del Chat 5; el rango no baja). */
  desdeNivel: number;
}

// Rangos y umbrales: contrato del Chat 5 (docs/game-v2/CONTRATO-PROGRESION.md).
// Aquí solo vive cómo se ven; los datos los da progression.ts.
export const RANK_THEME: Record<Rank, RankTheme> = {
  E: { marco: 'liso', ring: 1, doubleRing: false, notches: 0, crown: 'none', grain: 0, shimmer: false, defaultTitle: 'Tiro', desdeNivel: 1 },
  D: { marco: 'doble', ring: 2, doubleRing: true, notches: 0, crown: 'none', grain: 0, shimmer: false, defaultTitle: 'Gladiador', desdeNivel: 5 },
  C: { marco: 'remachado', ring: 2, doubleRing: true, notches: 8, crown: 'none', grain: 0, shimmer: false, defaultTitle: 'Veterano', desdeNivel: 10 },
  B: { marco: 'laurel_simple', ring: 3, doubleRing: true, notches: 8, crown: 'casco', grain: 1, shimmer: false, defaultTitle: 'Campeón', desdeNivel: 15 },
  A: { marco: 'laurel_doble', ring: 3, doubleRing: true, notches: 12, crown: 'casco', grain: 2, shimmer: false, defaultTitle: 'Héroe de la arena', desdeNivel: 22 },
  S: { marco: 'laurel_corona', ring: 3, doubleRing: true, notches: 12, crown: 'corona', grain: 2, shimmer: true, defaultTitle: 'Leyenda', desdeNivel: 30 },
};

// ── Contraste WCAG (para tests y para comprobar combinaciones nuevas) ──
function canal(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminancia(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

export function contraste(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

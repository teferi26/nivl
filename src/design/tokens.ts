// NIVL · Sistema de diseño «Ónix» (1.1). Fuente única de tokens.
// Documento: docs/design-v2/SISTEMA.md. Fondo casi negro, texto y botón color
// hueso, tarjetas redondeadas y el oro solo como hilo en cifras y detalles.
//
// Puro (sin imports de React Native) para poder testearlo.

export const ink = {
  ink0: '#09090B', // fondo
  ink1: '#151517', // superficie opaca (hojas, modales)
  ink2: '#1D1D1F', // superficie elevada
  ink3: '#2A2A2C', // hairline
  ink4: '#4A494C', // pista, borde de control (no es texto)
  ink6: '#8F8C85', // texto terciario
  ink8: '#B8B4AB', // texto secundario
  ink9: '#F5F2EC', // texto principal
  ink10: '#EDEAE3', // hueso: inversión, CTA
} as const;

export type InkToken = keyof typeof ink;

/** El oro de Ónix: un hilo en cifras, rótulos y marcos. Nunca un relleno de botón. */
export const oro = {
  hilo: '#C9A961',
  claro: '#EAD9AE',
  fondo: 'rgba(201, 169, 97, 0.09)',
  tenue: 'rgba(201, 169, 97, 0.14)',
  borde: 'rgba(201, 169, 97, 0.32)',
} as const;

/** Superficies translúcidas sobre el fondo degradado. */
export const vidrio = {
  tarjeta: 'rgba(255, 255, 255, 0.05)',
  suave: 'rgba(255, 255, 255, 0.03)',
  campo: 'rgba(255, 255, 255, 0.08)',
  borde: 'rgba(255, 255, 255, 0.13)',
  linea: 'rgba(255, 255, 255, 0.10)',
  pista: 'rgba(255, 255, 255, 0.14)',
} as const;

/** El fondo de pantalla, de arriba a abajo. */
export const FONDO_ONIX = ['#121214', '#09090B', '#050506'] as const;
export const FONDO_ONIX_PARADAS = [0, 0.55, 1] as const;

/** Radios: la tarjeta manda; lo que va dentro, menos. */
export const radio = { tarjeta: 22, control: 18, chip: 14, hoja: 28, pastilla: 999 } as const;

/**
 * Modos: en Ónix los cuatro mundos comparten el hilo de oro y se distinguen
 * por su nombre y su contenido, no por un color propio (decisión del rediseño
 * 1.1, cierra P46). Todos llegan a AA (4,5:1) sobre ink0, y el texto ink0
 * sobre el acento también (test en __tests__/tokens.test.ts).
 */
export const modoAcento = {
  general: oro.claro,
  iron: oro.claro,
  focus: oro.claro,
  work: oro.claro,
  founder: oro.claro,
} as const;

export type ModoAcento = keyof typeof modoAcento;

/** La rueda de modos: el mismo hilo, con NIVL (la base) en el oro más intenso. */
export const acentoRueda = { ...modoAcento, general: oro.hilo } as const;

/** Escala de espaciado (pt). Base 4. */
export const space = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s8: 32, s10: 40, s14: 56, s20: 80 } as const;

/** Trazos: la jerarquía y el rango se dicen con el peso, no con el color. */
export const stroke = { hairline: 1, rule: 2, frame: 3 } as const;

export const type = {
  display: { family: 'PlayfairDisplay_700Bold', size: 44, lineHeight: 50, tracking: 0 },
  rank: { family: 'PlayfairDisplay_700Bold', size: 32, lineHeight: 38, tracking: 0 },
  title: { family: 'PlayfairDisplay_700Bold', size: 29, lineHeight: 34, tracking: 0 },
  headline: { family: 'Outfit_700Bold', size: 20, lineHeight: 26, tracking: -0.2 },
  body: { family: 'Outfit_500Medium', size: 16, lineHeight: 24, tracking: 0 },
  bodySm: { family: 'Outfit_500Medium', size: 14, lineHeight: 20, tracking: 0 },
  label: { family: 'Outfit_700Bold', size: 12, lineHeight: 16, tracking: 2 },
  number: { family: 'PlayfairDisplay_700Bold', size: 24, lineHeight: 30, tracking: 0 },
  micro: { family: 'Outfit_600SemiBold', size: 11, lineHeight: 14, tracking: 1 },
  // Arena (SISTEMA.md §5 bis): la piedra grande. El monumento es el nivel del
  // Hero; la cifra, los números de una franja; la inscripción, los rótulos
  // grabados («RANGO A · HÉROE DE LA ARENA»).
  monumento: { family: 'PlayfairDisplay_700Bold', size: 112, lineHeight: 120, tracking: 0 },
  monumentoSm: { family: 'PlayfairDisplay_700Bold', size: 72, lineHeight: 80, tracking: 0 },
  cifra: { family: 'PlayfairDisplay_700Bold', size: 32, lineHeight: 38, tracking: 0 },
  inscripcion: { family: 'Outfit_700Bold', size: 12, lineHeight: 16, tracking: 2 },
} as const;

/** Duraciones (ms). `escalon`: retraso entre bloques consecutivos de una entrada en cascada. */
export const motion = { instant: 100, quick: 180, base: 260, slow: 420, ceremony: 1600, escalon: 55 } as const;

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

/**
 * Anchos en los que se verifica cada pantalla. 768 (iPad mini / 9,7" vertical)
 * y 1366 (iPad Pro 12,9" apaisado) solo para la galería: los dos iPad que se
 * escapaban entre 744 y 1440. 466 y 669: el iPhone Duo plegado (pantalla
 * exterior, compact) y abierto (interior, medium con barra inferior).
 */
export const VERIFY_WIDTHS = [375, 430, 466, 669, 744, 768, 1024, 1366, 1440] as const;

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
  /** Contrato del Chat 5 (cosmeticosDe): B casco, A laurel, S corona_arena. */
  crown: 'none' | 'casco' | 'laurel' | 'corona_arena';
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
  A: { marco: 'laurel_doble', ring: 3, doubleRing: true, notches: 12, crown: 'laurel', grain: 2, shimmer: false, defaultTitle: 'Héroe de la arena', desdeNivel: 22 },
  S: { marco: 'laurel_corona', ring: 3, doubleRing: true, notches: 12, crown: 'corona_arena', grain: 2, shimmer: true, defaultTitle: 'Leyenda', desdeNivel: 30 },
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

// NIVL · Marco responsive (SISTEMA.md §3). Puro: sin React Native, para poder
// testearlo. De un ancho en pt salen la clase de tamaño, el margen lateral, el
// ancho máximo del contenido y el tipo de navegación. Los números viven en
// tokens.ts (`sizeClass` y `layout`); aquí solo se juntan.

import { layout, sizeClass, type SizeClass } from './tokens';

export type NavKind = (typeof layout)[SizeClass]['nav'];

export interface Marco {
  sizeClass: SizeClass;
  /** Margen lateral del contenido: 20 · 32 · 48. */
  gutter: number;
  /** Ancho máximo del contenido, sin contar los márgenes: 560 · 640 · 720. */
  maxContent: number;
  /** Barra inferior, raíl de 72 o barra lateral de 240. */
  nav: NavKind;
}

/** Ancho de la columna contextual (coach, rango, amigos) en `expanded`. */
export const ANCHO_ASIDE = 320;
/** Ancho del raíl de navegación en `medium`. */
export const ANCHO_RAIL = 72;
/** Ancho de la barra lateral en `expanded`. */
export const ANCHO_SIDEBAR = 240;

/**
 * «Medium estrecho»: por debajo de este ancho de VENTANA el raíl de 72 no
 * compensa y se queda la barra inferior. Es el iPhone Duo abierto (669), el
 * Split View de un iPad a dos tercios (678, 694) y Stage Manager estrecho:
 * con raíl el hueco caía a 597 (compact) y el contenido se quedaba en la
 * columna del móvil con un raíl al lado. Con la barra inferior el contenido
 * tiene la ventana entera y entra en `medium` (dos columnas, dos paneles).
 * El iPad mini en vertical (744) conserva el raíl (hueco 672, medium).
 */
export const ANCHO_MIN_RAIL = 720;

function navPara(w: number, clase: SizeClass): NavKind {
  if (clase === 'medium' && w < ANCHO_MIN_RAIL) return 'tabs';
  return layout[clase].nav;
}

export function marcoDe(width: number): Marco {
  // Un ancho no finito (0 en el primer render de la web, NaN) se trata como
  // móvil: es el caso más estrecho y el que no rompe nada.
  const w = Number.isFinite(width) && width > 0 ? width : 0;
  const clase = sizeClass(w);
  const l = layout[clase];
  return { sizeClass: clase, gutter: l.gutter, maxContent: l.maxContent, nav: navPara(w, clase) };
}

/** Ancho que ocupa la navegación principal de cada tipo (sin la safe area). */
export function anchoNavegacion(nav: NavKind): number {
  return nav === 'rail' ? ANCHO_RAIL : nav === 'sidebar' ? ANCHO_SIDEBAR : 0;
}

/**
 * Lo mínimo que tiene que quedarle al contenido para que quepa el panel
 * contextual: la columna de lectura de 560 más dos márgenes de 32.
 */
export const MIN_CONTENIDO_CON_ASIDE = layout.compact.maxContent + 2 * layout.medium.gutter;

export interface Hueco {
  /** Ancho real que le queda a la pantalla tras el raíl o la barra lateral. */
  ancho: number;
  /** Clase de tamaño de ese hueco (no la de la ventana). */
  sizeClass: SizeClass;
  /** Si a la derecha cabe el panel de 320 sin bajar el contenido de 560 + 2·32. */
  cabeAside: boolean;
}

/** ¿Cabe el panel contextual en un hueco de este ancho? Solo en `expanded`. */
export function cabeAside(ancho: number): boolean {
  const w = Number.isFinite(ancho) && ancho > 0 ? ancho : 0;
  return sizeClass(w) === 'expanded' && w - ANCHO_ASIDE >= MIN_CONTENIDO_CON_ASIDE;
}

/**
 * Hueco del contenido dentro de las pestañas: el ancho de la ventana menos la
 * navegación que le toca (raíl de 72 en `medium`, barra lateral de 240 en
 * `expanded`) y menos el inset izquierdo, que la navegación absorbe. A 1024 la
 * pantalla mide 784 (`medium`), no 1024: así no se queda en 368 pt al restar
 * barra, panel y márgenes.
 */
export function huecoContenido(ventana: number, insetIzquierdo = 0): Hueco {
  const { nav } = marcoDe(ventana);
  const resta = nav === 'tabs' ? 0 : anchoNavegacion(nav) + Math.max(0, insetIzquierdo);
  const base = Number.isFinite(ventana) && ventana > 0 ? ventana : 0;
  const ancho = Math.max(0, base - resta);
  return { ancho, sizeClass: marcoDe(ancho).sizeClass, cabeAside: cabeAside(ancho) };
}

/**
 * Navegación que pintan (tabs)/_layout.tsx y LayoutMundo para una ventana de
 * este ancho. Se decide con la VENTANA, no con el hueco: el hueco es lo que
 * queda tras la navegación y no sabe qué navegación hay. Por debajo de
 * `ANCHO_MIN_RAIL` (720) es la barra inferior aunque la ventana sea `medium`.
 */
export function navDeVentana(ventana: number): NavKind {
  return marcoDe(ventana).nav;
}

/**
 * Segmentos raíz que en la web NO llevan la navegación lateral de la pila: el
 * acceso y la galería no son de la app con sesión, y los grupos de pestañas y
 * los mundos ya pintan la suya.
 */
const SEGMENTOS_SIN_NAV_LATERAL: ReadonlySet<string> = new Set(['login', 'auth', 'c', 'onboarding', 'kit', '(tabs)', '(iron)', '(focus)', '(work)', '(founder)']);

/** ¿Una pantalla de la pila con este primer segmento lleva barra lateral o raíl en la web? */
export function segmentoConNavLateral(segmento: string | undefined): boolean {
  return !!segmento && !SEGMENTOS_SIN_NAV_LATERAL.has(segmento);
}

// ── Ventanas de iPadOS ─────────────────────────────────────────────────

/**
 * Lo que hay que bajar la cabecera y la navegación en una ventana de iPadOS:
 * los controles de ventana (los tres puntos) se pintan encima de la app, entre
 * 20 y 42 pt desde arriba, y no cuentan en la safe area.
 */
export const ALTO_CONTROLES_VENTANA = 26;

/** ¿Es una ventana que no llena la pantalla? Solo entonces salen los controles. */
export function ventanaFlotante(ventanaW: number, ventanaH: number, pantallaW: number, pantallaH: number): boolean {
  if (!(ventanaW > 0 && ventanaH > 0 && pantallaW > 0 && pantallaH > 0)) return false;
  // La rotación puede dejar la pantalla con los lados cruzados un instante.
  const llena = (ventanaW === pantallaW && ventanaH === pantallaH) || (ventanaW === pantallaH && ventanaH === pantallaW);
  return !llena;
}

/**
 * Aire arriba cuando la ventana llena su espacio y no hay barra de estado: el
 * Vision Pro y el Mac con la app de iPad dan un inset superior de 0 y, sin
 * esto, la cabecera queda a 8 pt del borde redondeado de la ventana.
 */
export const MARGEN_SIN_BARRA_ESTADO = 12;

/** Lo que se baja lo de arriba en iPadOS (y en lo que se hace pasar por iPad). */
export function huecoSuperiorVentana(flotante: boolean, insetSuperior: number): number {
  if (flotante) return ALTO_CONTROLES_VENTANA;
  return insetSuperior === 0 ? MARGEN_SIN_BARRA_ESTADO : 0;
}

// ── Dos paneles (iPhone Duo abierto, iPad, Mac, Vision Pro) ────────────

/**
 * Hueco mínimo para partir una pantalla en dos paneles (lista | detalle, chat
 * | plan). 640: el iPhone Duo abierto (669) entra; el plegado (466) y
 * cualquier iPhone, no. Es el mismo número para `MaestroDetalle` y `Paneles`.
 */
export const UMBRAL_DOS_PANELES = 640;
/**
 * Por debajo de este hueco el reparto `lista` es a mitades (como un libro: el
 * Duo abierto, el iPad mini en vertical). Por encima, la lista va con ancho
 * acotado y el detalle se lleva el resto.
 */
export const HUECO_REPARTO_FIJO = 900;
/** La lista de un maestro-detalle ancho: el 36 % del hueco, entre 320 y 400. */
export const LISTA_MIN = 320;
export const LISTA_MAX = 400;
/** El filete que separa los dos paneles. */
export const FILETE_PANELES = 1;
/** Por encima de esta escala de texto no caben dos paneles: uno solo. */
export const ESCALA_MAX_DOS_PANELES = 1.35;

/** `mitad`: 50/50 siempre. `lista`: 50/50 hasta 900, luego lista acotada. */
export type Proporcion = 'mitad' | 'lista';

export interface Reparto {
  /** Ancho del panel izquierdo (lista, conversación). */
  izquierda: number;
  /** Ancho del panel derecho (detalle, plan), ya sin el filete. */
  derecha: number;
}

function finito(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** ¿Cabe la pantalla partida en dos? Por ancho y por escala de texto. */
export function cabenDosPaneles(hueco: number, fontScale = 1): boolean {
  const escala = Number.isFinite(fontScale) ? fontScale : 1;
  return finito(hueco) >= UMBRAL_DOS_PANELES && escala <= ESCALA_MAX_DOS_PANELES;
}

/**
 * Reparto de un hueco en dos paneles, o null si no caben (entonces se apila o
 * se navega, como en el iPhone). No depende del modelo: el Duo abierto y un
 * iPad en Split View con el mismo ancho se reparten igual.
 */
export function repartoPaneles(hueco: number, proporcion: Proporcion = 'lista', fontScale = 1): Reparto | null {
  if (!cabenDosPaneles(hueco, fontScale)) return null;
  const w = Math.floor(finito(hueco));
  const util = w - FILETE_PANELES;
  const izquierda =
    proporcion === 'mitad' || w < HUECO_REPARTO_FIJO
      ? Math.floor(util / 2)
      : Math.min(LISTA_MAX, Math.max(LISTA_MIN, Math.round(w * 0.36)));
  return { izquierda, derecha: util - izquierda };
}

/**
 * Columnas de una rejilla: tantas celdas de al menos `ladoMin` como quepan con
 * `separacion` entre ellas, acotadas a [min, max]. Es la cuenta de los módulos
 * de Hoy, aquí para el catálogo de IRON, la vitrina de logros y las fotos.
 */
export function columnasRejilla(ancho: number, ladoMin: number, separacion: number, min = 1, max = 8): number {
  const w = finito(ancho);
  if (w === 0 || ladoMin <= 0) return Math.max(1, min);
  const cuantas = Math.floor((w + separacion) / (ladoMin + separacion));
  return Math.max(min, Math.min(max, cuantas));
}

/** Lado de cada celda con `columnas` columnas en `ancho` y `separacion` entre ellas. */
export function ladoCelda(ancho: number, columnas: number, separacion: number): number {
  const w = finito(ancho);
  if (w === 0 || columnas <= 0) return 0;
  return Math.floor((w - separacion * (columnas - 1)) / columnas);
}

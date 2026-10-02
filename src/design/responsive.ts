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

export function marcoDe(width: number): Marco {
  // Un ancho no finito (0 en el primer render de la web, NaN) se trata como
  // móvil: es el caso más estrecho y el que no rompe nada.
  const w = Number.isFinite(width) && width > 0 ? width : 0;
  const clase = sizeClass(w);
  const l = layout[clase];
  return { sizeClass: clase, gutter: l.gutter, maxContent: l.maxContent, nav: l.nav };
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

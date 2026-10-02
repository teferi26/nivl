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

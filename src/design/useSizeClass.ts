// NIVL · Clase de tamaño en caliente. `useWindowDimensions` se vuelve a emitir
// al rotar, al cambiar el tamaño de la ventana (iPadOS 26, Stage Manager, Split
// View, la web) y al abrir un plegable, así que todo lo que lea este hook se
// recoloca solo, sin recargar.

import { createContext, useContext } from 'react';
import { useWindowDimensions } from 'react-native';
import { marcoDe, type Marco } from './responsive';

/**
 * Tope de ancho impuesto por un contenedor: la columna de 560 de la web fuera
 * de las pestañas, o el hueco que deja el raíl o la barra lateral dentro de
 * ellas ((tabs)/_layout.tsx). Sin él, una pantalla creería tener todo el ancho
 * de la ventana y aplicaría márgenes y panel de `expanded`.
 */
export const TopeAncho = createContext<number | null>(null);

/** Ancho real disponible: el de la ventana, acotado por el contenedor. */
export function useAnchoUtil(): number {
  const { width } = useWindowDimensions();
  const tope = useContext(TopeAncho);
  return tope == null ? width : Math.min(width, tope);
}

export function useSizeClass(): Marco {
  return marcoDe(useAnchoUtil());
}

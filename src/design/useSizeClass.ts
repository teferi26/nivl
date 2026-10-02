// NIVL · Clase de tamaño en caliente. `useWindowDimensions` se vuelve a emitir
// al rotar, al cambiar el tamaño de la ventana (iPadOS 26, Stage Manager, Split
// View, la web) y al abrir un plegable, así que todo lo que lea este hook se
// recoloca solo, sin recargar.

import { createContext, useContext } from 'react';
import { useWindowDimensions } from 'react-native';
import { marcoDe, type Marco } from './responsive';

/**
 * Tope de ancho impuesto por un contenedor (la columna de 560 de la web fuera
 * de las pestañas). Sin él, una pantalla dentro de esa columna creería tener
 * los 1440 de la ventana y aplicaría márgenes de `expanded`.
 */
export const TopeAncho = createContext<number | null>(null);

export function useSizeClass(): Marco {
  const { width } = useWindowDimensions();
  const tope = useContext(TopeAncho);
  return marcoDe(tope == null ? width : Math.min(width, tope));
}

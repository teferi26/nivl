// NIVL · Clase de tamaño en caliente. `useWindowDimensions` se vuelve a emitir
// al rotar, al cambiar el tamaño de la ventana (iPadOS 26, Stage Manager, Split
// View, la web) y al abrir un plegable, así que todo lo que lea este hook se
// recoloca solo, sin recargar.

import { createContext, useContext } from 'react';
import { Dimensions, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { huecoSuperiorVentana, marcoDe, navDeVentana, ventanaFlotante, type Marco, type NavKind } from './responsive';

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

/**
 * Navegación que hay de verdad en pantalla: barra inferior, raíl o barra
 * lateral. Sale del ancho de la ventana, como en (tabs)/_layout.tsx, y no del
 * hueco: entre 600 y 671 `useSizeClass()` devuelve `compact` (el hueco tras el
 * raíl) mientras se pinta el raíl. Úsalo para decidir lo que depende de la
 * navegación (p. ej. una flecha de vuelta que solo hace falta sin raíl).
 */
export function useNavActual(): NavKind {
  return navDeVentana(useWindowDimensions().width);
}

/**
 * Lo que hay que bajar lo de arriba a la izquierda (cabecera, raíl, barra
 * lateral) por los controles de ventana de iPadOS, o el aire que falta donde
 * no hay barra de estado. 0 en el iPad a pantalla completa y en el iPhone.
 *
 * Ojo: la app de iPad en el Vision Pro y en el Mac se hace pasar por iPad
 * (medido en el simulador de visionOS: `isPad` true, `isVision` false,
 * `systemName` iPadOS), así que `Platform.isVision` solo vale en un binario
 * nativo de visionOS. Si en esos sistemas la ventana no llena la «pantalla»,
 * sale el hueco de 26 aunque no haya controles: solo es aire de más.
 */
export function useHuecoControlesVentana(): number {
  const { width, height } = useWindowDimensions();
  const { top } = useSafeAreaInsets();
  if (Platform.OS !== 'ios' || !Platform.isPad) return 0;
  const pantalla = Dimensions.get('screen');
  const flotante = !Platform.isVision && ventanaFlotante(width, height, pantalla.width, pantalla.height);
  return huecoSuperiorVentana(flotante, top);
}

// NIVL · La pulsación larga en la web.
//
// Mantener pulsado (borrar, quitar, reactivar) es un gesto de móvil: con ratón
// nadie lo prueba y con teclado no existe. En la web esa misma acción sale con
// el clic derecho y con la tecla de menú contextual (o Mayús+F10), que disparan
// el mismo evento. En nativo no añade nada.
//
// Se reparte sobre el Pressable que lleva `onLongPress`:
//   <Pressable onLongPress={borrar} {...menuContextualWeb(borrar)} />

import { Platform } from 'react-native';

/** Props para que el menú contextual del navegador haga lo que la pulsación larga. */
export function menuContextualWeb(accion: (() => void) | undefined): object {
  if (Platform.OS !== 'web' || !accion) return {};
  return {
    onContextMenu: (e: { preventDefault: () => void }) => {
      e.preventDefault();
      accion();
    },
  };
}

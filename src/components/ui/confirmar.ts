// NIVL · Confirmar y avisar en todas las plataformas.
//
// En react-native-web `Alert.alert` no pinta nada: un botón cuya acción iba
// dentro de los botones de un Alert era un botón muerto en la web (borrar la
// cuenta, bloquear a alguien). Aquí la web usa los diálogos del navegador y el
// móvil sigue con el Alert nativo de siempre.

import { Alert, Platform } from 'react-native';

interface Confirmacion {
  titulo: string;
  mensaje?: string;
  /** Texto del botón que confirma ("Eliminar", "Bloquear"…). */
  confirmar: string;
  cancelar?: string;
  destructivo?: boolean;
}

/** Pide confirmación. Resuelve true solo si se acepta. */
export function confirmar({ titulo, mensaje, confirmar: ok, cancelar = 'Cancelar', destructivo }: Confirmacion): Promise<boolean> {
  if (Platform.OS === 'web') {
    const texto = mensaje ? `${titulo}\n\n${mensaje}` : titulo;
    return Promise.resolve(typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(texto) : false);
  }
  return new Promise((resolve) => {
    Alert.alert(
      titulo,
      mensaje,
      [
        { text: cancelar, style: 'cancel', onPress: () => resolve(false) },
        { text: ok, style: destructivo ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/** Un aviso de un solo botón que también se ve en la web. */
export function avisar(titulo: string, mensaje?: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(mensaje ? `${titulo}\n\n${mensaje}` : titulo);
    }
    return;
  }
  Alert.alert(titulo, mensaje);
}

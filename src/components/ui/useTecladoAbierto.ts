// NIVL · ¿Está el teclado a la vista? Solo escucha: quien aparta el contenido
// sigue siendo el KeyboardAvoidingView de cada pantalla (un solo mecanismo de
// teclado). Sirve para quitar el margen inferior seguro mientras el teclado
// tapa el indicador de inicio: con él sumado, el pie flotaba sobre el teclado.
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export function useTecladoAbierto(): boolean {
  const [abierto, setAbierto] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    // iOS avisa antes de moverse (el margen cambia a la vez que sube el
    // teclado); Android solo avisa después.
    const sale = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const entra = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(sale, () => setAbierto(true));
    const b = Keyboard.addListener(entra, () => setAbierto(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  return abierto;
}

// NIVL · El hueco del teclado en Android.
//
// Con targetSdk 36 la app es siempre de borde a borde y `adjustResize` ya no
// encoge la ventana: el teclado se pintaba encima y tapaba media pantalla,
// incluido el botón de continuar del onboarding. Este hueco en la raíz devuelve
// a toda la app el comportamiento de antes, sin tocar pantalla por pantalla:
// las `KeyboardAvoidingView` sin `behavior` en Android, los `ScrollView` y los
// pies fijos se colocan solos encima del teclado. En iOS y en la web no pinta
// nada: allí cada pantalla aparta su contenido.

import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ES_ANDROID = Platform.OS === 'android';

function AndroidConHueco({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [alto, setAlto] = useState(0);
  useEffect(() => {
    const sale = Keyboard.addListener('keyboardDidShow', (e) => setAlto(e.endCoordinates.height));
    const entra = Keyboard.addListener('keyboardDidHide', () => setAlto(0));
    return () => {
      sale.remove();
      entra.remove();
    };
  }, []);
  // React Native descuenta la barra del sistema de la altura que notifica.
  return <View style={[styles.raiz, { paddingBottom: alto > 0 ? alto + insets.bottom : 0 }]}>{children}</View>;
}

export function HuecoTecladoAndroid({ children }: { children: ReactNode }) {
  return ES_ANDROID ? <AndroidConHueco>{children}</AndroidConHueco> : <>{children}</>;
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
});

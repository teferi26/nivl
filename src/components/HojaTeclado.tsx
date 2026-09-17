import { useEffect, useRef } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { colors } from '@/lib/theme';

/**
 * La hoja inferior de las pantallas con formulario, a prueba de teclado.
 *
 * El problema que resuelve, tal cual se sufre: abres el formulario del gimnasio,
 * tocas un campo y el teclado tapa justo lo que estás escribiendo. No puedes
 * leerlo, y como el fondo no responde al toque tampoco puedes cerrar el teclado
 * ni el formulario: te quedas atascado y solo se sale matando la app.
 *
 * Tres piezas, y las tres hacen falta:
 *
 *  1. `KeyboardAvoidingView` con 'padding' en iOS levanta la hoja por encima
 *     del teclado. Sin esto, la hoja se queda debajo.
 *  2. `keyboardShouldPersistTaps="handled"` permite pulsar un botón de la hoja
 *     con el teclado abierto. Sin esto, el primer toque solo cierra el teclado
 *     y el botón parece muerto.
 *  3. El fondo cierra el teclado al tocarlo, y si ya estaba cerrado, cierra la
 *     hoja. Esa es la salida que faltaba.
 */
export function HojaTeclado({
  visible,
  onClose,
  children,
  style,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const entrada = useRef(new Animated.Value(0)).current;
  const tecladoAbierto = useRef(false);

  useEffect(() => {
    const abrir = Keyboard.addListener('keyboardDidShow', () => {
      tecladoAbierto.current = true;
    });
    const cerrar = Keyboard.addListener('keyboardDidHide', () => {
      tecladoAbierto.current = false;
    });
    return () => {
      abrir.remove();
      cerrar.remove();
    };
  }, []);

  useEffect(() => {
    Animated.spring(entrada, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 220,
    }).start();
  }, [visible, entrada]);

  const salir = () => {
    // Un toque cierra el teclado; el siguiente cierra la hoja. Cerrar las dos
    // cosas de golpe hace que se pierda lo escrito por un roce sin querer.
    if (tecladoAbierto.current) {
      Keyboard.dismiss();
      return;
    }
    onClose();
  };

  return (
    <KeyboardAvoidingView
      style={styles.backdrop}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={salir}
        accessibilityRole="button"
        accessibilityLabel="Cerrar"
      />
      <Animated.View
        style={[
          styles.sheet,
          style,
          {
            transform: [
              { translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
            ],
          },
        ]}
      >
        <View style={styles.asa} />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 14, 0.85)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.panel,
    borderTopWidth: 1.5,
    borderTopColor: colors.accentDim,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
    // Tope de altura: con el teclado abierto en un móvil pequeño, una hoja sin
    // límite empuja su propio contenido fuera de la pantalla.
    maxHeight: '85%',
  },
  asa: {
    alignSelf: 'center',
    width: 42,
    height: 3,
    backgroundColor: colors.accentFaint,
    marginBottom: 14,
  },
});

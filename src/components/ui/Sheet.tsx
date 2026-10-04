// NIVL · La hoja (SISTEMA.md §5): asa, eyebrow, título, cuerpo con scroll y pie
// fijo con la safe area real. En móvil sale desde abajo; en tablet (medium y
// expanded) es un modal centrado de 560 como máximo, nunca de ancho completo.
//
// Teclado: el mismo patrón que src/components/HojaTeclado.tsx.
//   1. KeyboardAvoidingView levanta la hoja: 'padding' en iOS y 'height' en
//      Android. Con edge-to-edge (SDK 54) y `statusBarTranslucent` la ventana
//      ya no se redimensiona sola al abrir el teclado, así que sin
//      comportamiento en Android el pie quedaba debajo del teclado.
//   2. keyboardShouldPersistTaps="handled": los botones responden con el
//      teclado abierto.
//   3. Tocar el fondo cierra primero el teclado y, al siguiente toque, la hoja.
//
// `onClose` se llama siempre que la hoja se cierra por sí misma. `onDismiss`,
// además, cuando la cierra el usuario sin decidir (arrastre del asa, toque en el
// fondo, botón atrás de Android, X de la cabecera o el gesto de escape del
// lector de pantalla), para que quien la abrió pueda anotar «cerrada» (p. ej.
// la oferta del Chat 2).

import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, type ReactNode } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ink, motion, sizeClass, space, stroke, type } from '@/design/tokens';
import { useMovimientoReducido } from './motion';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Cierre sin decidir: arrastre, fondo, X, escape o atrás de Android. Se llama antes que onClose. */
  onDismiss?: () => void;
  eyebrow?: string;
  title?: string;
  children: ReactNode;
  /** Pie fijo (acciones). Queda por encima de la safe area inferior. */
  footer?: ReactNode;
  /** Cuerpo con scroll (por defecto). Con false, el cuerpo crece con su contenido. */
  scroll?: boolean;
}

/** Arrastre del asa hacia abajo a partir del cual la hoja se cierra. */
const UMBRAL_ARRASTRE = 80;

export function Sheet({ visible, onClose, onDismiss, eyebrow, title, children, footer, scroll = true }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tablet = sizeClass(width) !== 'compact';
  const reducido = useMovimientoReducido();
  const entrada = useRef(new Animated.Value(0)).current;
  const arrastre = useRef(new Animated.Value(0)).current;
  const tecladoAbierto = useRef(false);

  // Refs para que el PanResponder (creado una vez) vea siempre las props vivas.
  const cerrarRef = useRef<() => void>(() => {});
  cerrarRef.current = () => {
    onDismiss?.();
    onClose();
  };

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
    if (!visible) return;
    arrastre.setValue(0);
    if (reducido) {
      entrada.setValue(1);
      return;
    }
    entrada.setValue(0);
    const anim = Animated.timing(entrada, { toValue: 1, duration: motion.base, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [visible, reducido, entrada, arrastre]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => arrastre.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_e, g) => {
        if (g.dy > UMBRAL_ARRASTRE || g.vy > 1.2) {
          cerrarRef.current();
        } else {
          Animated.spring(arrastre, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 220 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(arrastre, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 220 }).start();
      },
    }),
  ).current;

  const tocarFondo = () => {
    // Un toque cierra el teclado; el siguiente cierra la hoja. Cerrar las dos
    // cosas de golpe hace perder lo escrito por un roce sin querer.
    if (tecladoAbierto.current) {
      Keyboard.dismiss();
      return;
    }
    cerrarRef.current();
  };

  const desplazamiento = tablet ? 16 : 40;
  const transform = [
    { translateY: Animated.add(entrada.interpolate({ inputRange: [0, 1], outputRange: [desplazamiento, 0] }), arrastre) },
  ];
  // En tablet la hoja es un modal centrado: no toca el borde inferior y no
  // necesita la safe area.
  const abajo = tablet ? space.s4 : Math.max(insets.bottom, space.s4);

  const cabecera = (
    <View {...pan.panHandlers}>
      <View style={styles.asaZona} accessible={false}>
        <View style={styles.asa} />
      </View>
      <View style={styles.cabecera}>
        <View style={styles.cabeceraTexto}>
          {eyebrow ? (
            <Text maxFontSizeMultiplier={1.35} style={styles.eyebrow}>
              {eyebrow}
            </Text>
          ) : null}
          {title ? (
            <Text maxFontSizeMultiplier={1.35} accessibilityRole="header" style={styles.titulo}>
              {title}
            </Text>
          ) : null}
        </View>
        {/* Cierre explícito de 44: el arrastre del asa y el toque en el fondo
            no los encuentra un lector de pantalla ni un teclado. */}
        <Pressable
          onPress={() => cerrarRef.current()}
          style={({ pressed }) => [styles.cerrar, pressed && styles.cerrarPulsado]}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        >
          <Ionicons name="close" size={22} color={ink.ink9} />
        </Pressable>
      </View>
    </View>
  );

  const cuerpo = scroll ? (
    <ScrollView
      style={styles.flexible}
      contentContainerStyle={[styles.cuerpo, !footer && { paddingBottom: abajo }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.cuerpo, !footer && { paddingBottom: abajo }]}>{children}</View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => cerrarRef.current()}
    >
      <KeyboardAvoidingView
        style={[styles.fondo, tablet ? styles.fondoCentrado : styles.fondoAbajo]}
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={tocarFondo}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        />
        <Animated.View
          accessibilityViewIsModal
          onAccessibilityEscape={() => cerrarRef.current()}
          style={[styles.hoja, tablet ? styles.hojaTablet : styles.hojaMovil, { transform }]}
        >
          {cabecera}
          {cuerpo}
          {footer ? <View style={[styles.pie, { paddingBottom: abajo }]}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)' },
  fondoAbajo: { justifyContent: 'flex-end' },
  fondoCentrado: { justifyContent: 'center', alignItems: 'center', padding: space.s8 },
  hoja: { backgroundColor: ink.ink1, maxHeight: '85%' },
  hojaMovil: { width: '100%', borderTopWidth: stroke.hairline, borderTopColor: ink.ink3 },
  hojaTablet: { width: '100%', maxWidth: 560, borderWidth: stroke.hairline, borderColor: ink.ink3 },
  asaZona: { alignItems: 'center', paddingTop: space.s3, paddingBottom: space.s2 },
  asa: { width: 40, height: 4, backgroundColor: ink.ink4 },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.s2,
    paddingLeft: space.s5,
    paddingRight: space.s2,
    paddingBottom: space.s3,
  },
  cabeceraTexto: { flex: 1, minWidth: 0, gap: space.s1, paddingTop: space.s2 },
  cerrar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  cerrarPulsado: { backgroundColor: ink.ink2 },
  eyebrow: {
    fontFamily: type.label.family,
    fontSize: type.label.size,
    lineHeight: type.label.lineHeight,
    letterSpacing: type.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
  titulo: {
    fontFamily: type.headline.family,
    fontSize: type.headline.size,
    lineHeight: type.headline.lineHeight,
    letterSpacing: type.headline.tracking,
    color: ink.ink9,
  },
  flexible: { flexGrow: 0, flexShrink: 1 },
  cuerpo: { paddingHorizontal: space.s5, paddingBottom: space.s4 },
  pie: {
    paddingHorizontal: space.s5,
    paddingTop: space.s3,
    borderTopWidth: stroke.hairline,
    borderTopColor: ink.ink3,
    gap: space.s2,
  },
});

// NIVL · Toast v2 (SISTEMA.md §5): pastilla invertida arriba, «+50 XP · FUE».
// Entra en 180 ms (motion.quick), se queda un momento y se va. Se anuncia al
// lector de pantalla UNA vez, con announceForAccessibility (con además
// accessibilityLiveRegion, Android lo leía dos veces).
// Va en el `overlay` de Screen, hijo absoluto de su SafeAreaView: un `top`
// explícito se mide desde el borde del padding, no desde debajo de la safe
// area, así que aquí sí hay que sumar insets.top (no se cuenta dos veces). Con «reducir movimiento» no se desplaza: solo aparece y
// se apaga. Sustituirá a XpToast cuando se migren las pantallas.

import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ink, motion, space, type } from '@/design/tokens';
import { useMovimientoReducido } from './motion';

interface Props {
  /** Texto del aviso. null = no hay toast. Un mensaje nuevo reinicia el ciclo. */
  message: string | null;
  onDone: () => void;
}

const VISIBLE_MS = 1600;

export function Toast({ message, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const reducido = useMovimientoReducido();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  // onDone por ref: si fuera dependencia del efecto, cada render del padre
  // reiniciaría la animación a mitad de vuelo (mismo patrón que XpToast).
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const reducidoRef = useRef(reducido);
  reducidoRef.current = reducido;

  useEffect(() => {
    if (message === null) return;
    AccessibilityInfo.announceForAccessibility(message);
    const quieto = reducidoRef.current;
    opacity.setValue(0);
    translateY.setValue(quieto ? 0 : -12);
    const anim = Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: motion.quick, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: quieto ? 0 : motion.quick, useNativeDriver: true }),
      ]),
      Animated.delay(VISIBLE_MS),
      Animated.timing(opacity, { toValue: 0, duration: motion.quick, useNativeDriver: true }),
    ]);
    anim.start(({ finished }) => {
      if (finished) onDoneRef.current();
    });
    return () => anim.stop();
  }, [message, opacity, translateY]);

  if (message === null) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { top: insets.top + space.s3, opacity, transform: [{ translateY }] }]}
    >
      <Text maxFontSizeMultiplier={1.35} numberOfLines={2} style={styles.texto}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '90%',
    backgroundColor: ink.ink10,
    borderRadius: 999,
    paddingHorizontal: space.s5,
    paddingVertical: space.s2,
    zIndex: 20,
  },
  texto: {
    fontFamily: type.label.family,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: ink.ink0,
  },
});

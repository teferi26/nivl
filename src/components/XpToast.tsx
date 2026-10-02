import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text } from 'react-native';
import { useMovimientoReducido } from '@/components/ui/motion';
import { colors, fonts } from '@/lib/theme';

interface Props {
  xp: number | null;
  bonus?: boolean;
  unit?: 'XP' | 'PB';
  onDone: () => void;
}

// "+62 XP" flotante que asciende y se desvanece al completar una misión.
export function XpToast({ xp, bonus, unit = 'XP', onDone }: Props) {
  const reducido = useMovimientoReducido();
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  // onDone por ref: si fuera dependencia del efecto, cada render del padre
  // (varios setState al completar) reiniciaba la animación a mitad de vuelo.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (xp === null) return;
    // El aviso flota y se va: quien usa lector de pantalla lo oye.
    AccessibilityInfo.announceForAccessibility(`+${xp} ${unit}`);
    translateY.setValue(0);
    opacity.setValue(0);
    const anim = Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: reducido ? 0 : 180, useNativeDriver: true }),
        // Con "reducir movimiento" no sube: aparece, se queda y se apaga.
        Animated.timing(translateY, { toValue: reducido ? 0 : -26, duration: 900, useNativeDriver: true }),
      ]),
      Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]);
    anim.start(({ finished }) => {
      if (finished) onDoneRef.current();
    });
    // Cancela la animación anterior antes de arrancar la nueva (toasts encadenados).
    return () => anim.stop();
    // `unit` y `reducido` no reinician el aviso: solo cuenta un xp nuevo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xp, translateY, opacity]);

  if (xp === null) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { opacity, transform: [{ translateY }] }]}>
      <Text style={[styles.text, unit === 'PB' && styles.textBonus]}>
        +{xp} {unit}
        {bonus ? '  · evidencia ×1,25' : ''}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 110,
    alignSelf: 'center',
    backgroundColor: colors.accentFaint,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    zIndex: 10,
  },
  text: {
    fontFamily: fonts.heading,
    fontSize: 16,
    letterSpacing: 1,
    color: colors.accent,
  },
  textBonus: {
    color: colors.gold,
  },
});

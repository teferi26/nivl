import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { colors, fonts } from '@/lib/theme';

interface Props {
  xp: number | null;
  bonus?: boolean;
  onDone: () => void;
}

// "+62 XP" flotante que asciende y se desvanece al completar una misión.
export function XpToast({ xp, bonus, onDone }: Props) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  // onDone por ref: si fuera dependencia del efecto, cada render del padre
  // (varios setState al completar) reiniciaba la animación a mitad de vuelo.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (xp === null) return;
    translateY.setValue(0);
    opacity.setValue(0);
    const anim = Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -26, duration: 900, useNativeDriver: true }),
      ]),
      Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]);
    anim.start(({ finished }) => {
      if (finished) onDoneRef.current();
    });
    // Cancela la animación anterior antes de arrancar la nueva (toasts encadenados).
    return () => anim.stop();
  }, [xp, translateY, opacity]);

  if (xp === null) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { opacity, transform: [{ translateY }] }]}>
      <Text style={styles.text}>
        +{xp} XP{bonus ? '  · evidencia ×1,25' : ''}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 110,
    alignSelf: 'center',
    backgroundColor: colors.cyanFaint,
    borderWidth: 1,
    borderColor: colors.cyan,
    paddingHorizontal: 16,
    paddingVertical: 8,
    zIndex: 10,
  },
  text: {
    fontFamily: fonts.heading,
    fontSize: 16,
    letterSpacing: 1,
    color: colors.cyan,
  },
});

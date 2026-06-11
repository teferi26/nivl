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

  useEffect(() => {
    if (xp === null) return;
    translateY.setValue(0);
    opacity.setValue(0);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -26, duration: 900, useNativeDriver: true }),
      ]),
      Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start(() => onDone());
  }, [xp, translateY, opacity, onDone]);

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

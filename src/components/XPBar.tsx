import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { colors } from '@/lib/theme';

interface Props {
  ratio: number;
  color?: string;
  trackColor?: string;
  height?: number;
  /** Marcas verticales (p. ej. 21 para los días de un hábito). */
  segments?: number;
}

// Toda barra de progreso de NIVL. El relleno se anima al cambiar: subir de XP
// se ve, no solo se lee.
export function XPBar({ ratio, color = colors.accent, trackColor = colors.track, height = 6, segments }: Props) {
  const pct = Math.min(100, Math.max(0, ratio * 100));
  const width = useRef(new Animated.Value(pct)).current;

  useEffect(() => {
    Animated.timing(width, { toValue: pct, duration: 500, useNativeDriver: false }).start();
  }, [pct, width]);

  return (
    <View style={{ height, backgroundColor: trackColor, overflow: 'hidden' }}>
      <Animated.View
        style={{
          height,
          backgroundColor: color,
          width: width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
        }}
      />
      {segments && segments > 1 ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' }} pointerEvents="none">
          {Array.from({ length: segments - 1 }, (_, i) => (
            <View key={i} style={{ flex: 1, borderRightWidth: 1, borderRightColor: colors.bg }} />
          ))}
          <View style={{ flex: 1 }} />
        </View>
      ) : null}
    </View>
  );
}

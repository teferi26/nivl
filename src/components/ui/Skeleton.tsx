// NIVL · El hueco mientras carga.
//
// Un bloque de `panel` que respira entre 0,4 y 0,8 de opacidad. Sustituye al
// spinner suelto y, sobre todo, al estado vacío pintado antes de tiempo: una
// pantalla que dice "Nada programado" medio segundo y luego enseña seis
// misiones miente dos veces. Con "reducir movimiento" activado se queda quieto.
//
// Uso: <Skeleton height={86} /> para una tarjeta, <SkeletonRows rows={4} />
// para una lista de filas. Siempre dentro de un contenedor con
// accessibilityRole="progressbar" y una etiqueta: el bloque en sí es mudo.

import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '@/lib/theme';

interface SkeletonProps {
  height?: number;
  width?: DimensionValue;
  /** Círculo (avatar, anillo): `height` es el diámetro. */
  round?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ height = 16, width = '100%', round, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    let vivo = true;
    let bucle: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((quieto) => {
        if (!vivo || quieto) return;
        opacity.setValue(0.4);
        bucle = Animated.loop(
          Animated.sequence([
            Animated.timing(opacity, { toValue: 0.8, duration: 700, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
          ]),
        );
        bucle.start();
      });
    return () => {
      vivo = false;
      bucle?.stop();
    };
  }, [opacity]);

  return (
    <Animated.View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.block,
        { height, width: round ? height : width, opacity },
        round && { borderRadius: height / 2 },
        style,
      ]}
    />
  );
}

/** Una lista de filas en hueco: marca redonda a la izquierda y dos líneas. */
export function SkeletonRows({ rows = 3, style }: { rows?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={[styles.row, i > 0 && styles.sep]}>
          <Skeleton round height={26} />
          <View style={styles.lines}>
            <Skeleton height={13} width={i % 2 === 0 ? '72%' : '58%'} />
            <Skeleton height={10} width="36%" style={styles.second} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.panel },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  sep: { borderTopWidth: 1, borderTopColor: colors.line },
  lines: { flex: 1, minWidth: 0 },
  second: { marginTop: 7 },
});

// NIVL · El hueco mientras carga.
//
// Un bloque ink2 que respira hasta ink3 y vuelve (SISTEMA §6). Sustituye al
// spinner suelto y, sobre todo, al estado vacío pintado antes de tiempo: una
// pantalla que dice "Nada programado" medio segundo y luego enseña seis
// misiones miente dos veces. Con "reducir movimiento" se queda quieto en ink2,
// también si el ajuste cambia con la pantalla abierta (useMovimientoReducido).
// La respiración es una capa ink3 encima cuya opacidad va de 0 a 1 (driver
// nativo: el color de fondo no se puede animar en el hilo de UI).
//
// Uso: <Skeleton height={86} /> para una tarjeta, <SkeletonRows rows={4} />
// para una lista de filas. Siempre dentro de un contenedor con
// accessibilityRole="progressbar" y una etiqueta: el bloque en sí es mudo.

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { ink, stroke } from '@/design/tokens';
import { useMovimientoReducido } from './motion';

interface SkeletonProps {
  height?: number;
  width?: DimensionValue;
  /** Círculo (avatar, anillo): `height` es el diámetro. */
  round?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ height = 16, width = '100%', round, style }: SkeletonProps) {
  const reducido = useMovimientoReducido();
  const aliento = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducido) {
      aliento.setValue(0);
      return;
    }
    aliento.setValue(0);
    const bucle = Animated.loop(
      Animated.sequence([
        Animated.timing(aliento, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(aliento, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    bucle.start();
    return () => bucle.stop();
  }, [reducido, aliento]);

  const radio = round ? { borderRadius: height / 2 } : null;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.block, { height, width: round ? height : width }, radio, style]}
    >
      <Animated.View pointerEvents="none" style={[styles.aliento, radio, { opacity: aliento }]} />
    </View>
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
  block: { backgroundColor: ink.ink2, overflow: 'hidden' },
  aliento: { ...StyleSheet.absoluteFillObject, backgroundColor: ink.ink3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  sep: { borderTopWidth: stroke.hairline, borderTopColor: ink.ink3 },
  lines: { flex: 1, minWidth: 0 },
  second: { marginTop: 7 },
});

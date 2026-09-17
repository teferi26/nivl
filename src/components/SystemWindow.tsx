import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { colors } from '@/lib/theme';

interface Props {
  color?: string;
  fill?: string;
  /**
   * Esquinas cortadas en diagonal (superior-izquierda e inferior-derecha).
   * Por defecto 0: la arena es piedra recta, un marco de un píxel. El corte
   * queda disponible para momentos épicos (level-up, botín).
   */
  cut?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
}

// Ventana del sistema: el panel de NIVL. Marco de hierro sobre negro.
export function SystemWindow({
  color = colors.accentDim,
  fill = colors.panel,
  cut = 0,
  style,
  contentStyle,
  children,
}: Props) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || Math.abs(size.w - width) > 1 || Math.abs(size.h - height) > 1) {
      setSize({ w: width, h: height });
    }
  };

  if (cut <= 0) {
    return (
      <View style={[styles.box, styles.frame, { borderColor: color, backgroundColor: fill }, style]}>
        <View style={[styles.content, contentStyle]}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[styles.box, style]} onLayout={onLayout}>
      {size ? (
        <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Polygon
            points={`${cut},0 ${size.w},0 ${size.w},${size.h - cut} ${size.w - cut},${size.h} 0,${size.h} 0,${cut}`}
            fill={fill}
            stroke={color}
            strokeWidth={1.5}
          />
        </Svg>
      ) : null}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginBottom: 12,
  },
  frame: {
    borderWidth: 1,
  },
  content: {
    padding: 14,
  },
});

import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { colors } from '@/lib/theme';

interface Props {
  color?: string;
  fill?: string;
  cut?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
}

// Ventana del sistema: panel con esquinas cortadas en diagonal
// (superior-izquierda e inferior-derecha), el sello visual de NIVL.
export function SystemWindow({
  color = colors.cyanDim,
  fill = colors.panel,
  cut = 14,
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
  content: {
    padding: 14,
  },
});

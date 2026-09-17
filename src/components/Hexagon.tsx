import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { colors } from '@/lib/theme';

interface Props {
  size: number;
  color?: string;
  fill?: string;
  children?: ReactNode;
}

export function Hexagon({ size, color = colors.accent, fill = colors.accentFaint, children }: Props) {
  const w = size;
  const h = size;
  const points = [
    [w * 0.5, 0],
    [w * 0.93, h * 0.25],
    [w * 0.93, h * 0.75],
    [w * 0.5, h],
    [w * 0.07, h * 0.75],
    [w * 0.07, h * 0.25],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(' ');

  return (
    <View style={{ width: w, height: h }}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Polygon points={points} fill={fill} stroke={color} strokeWidth={1.5} />
      </Svg>
      <View style={styles.center}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// NIVL · Anillo de progreso: el día de hoy, el nivel, una campaña. SVG puro,
// sin dependencias nuevas. Anima el trazo al cambiar de valor.

import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, fonts } from '@/lib/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  /** 0..1 */
  ratio: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  /** Texto grande en el centro. Si no se pasa, el porcentaje. */
  label?: string;
  /** Rótulo pequeño bajo el texto grande. */
  sublabel?: string;
  children?: ReactNode;
}

export function ProgressRing({
  ratio,
  size = 84,
  stroke = 5,
  color = colors.accent,
  track = colors.track,
  label,
  sublabel,
  children,
}: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, ratio));
  const progress = useRef(new Animated.Value(clamped)).current;

  useEffect(() => {
    Animated.timing(progress, { toValue: clamped, duration: 600, useNativeDriver: false }).start();
  }, [clamped, progress]);

  const dashOffset = progress.interpolate({ inputRange: [0, 1], outputRange: [c, 0] });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="butt"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.center}>
        {children ?? (
          <>
            <Text style={[styles.label, { fontSize: size * 0.26 }]}>{label ?? `${Math.round(clamped * 100)}%`}</Text>
            {sublabel ? <Text style={[styles.sublabel, { fontSize: Math.max(8, size * 0.1) }]}>{sublabel}</Text> : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.number, color: colors.text },
  sublabel: {
    fontFamily: fonts.heading,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.textFaint,
    marginTop: 1,
  },
});

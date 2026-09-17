import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts } from '@/lib/theme';

interface Props {
  title: string;
  onPress: () => void;
  /** solid: blanco con texto negro (la acción principal, una por pantalla).
   *  outline: marco de hierro. ghost: solo texto. danger: rojo. */
  variant?: 'solid' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function SystemButton({ title, onPress, variant = 'solid', size = 'md', icon, disabled, loading, style }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const solid = variant === 'solid';
  const danger = variant === 'danger';
  const ghost = variant === 'ghost';
  const fg = solid ? colors.bg : danger ? colors.red : colors.accent;
  const animar = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 4 }).start();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      onPressIn={() => animar(0.97)}
      onPressOut={() => animar(1)}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
    >
      <Animated.View
        style={[
          styles.base,
          size === 'sm' && styles.sm,
          size === 'lg' && styles.lg,
          solid && styles.solid,
          danger && styles.danger,
          ghost && styles.ghost,
          (disabled || loading) && styles.disabled,
          style,
          { transform: [{ scale }] },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={fg} size="small" />
        ) : (
          <>
            {icon ? <Ionicons name={icon} size={size === 'sm' ? 14 : 17} color={fg} /> : null}
            <Text style={[styles.label, size === 'sm' && styles.labelSm, size === 'lg' && styles.labelLg, { color: fg }]}>
              {title}
            </Text>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.accent,
    minHeight: 50,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: { minHeight: 38, paddingVertical: 8, paddingHorizontal: 14 },
  lg: { minHeight: 56, paddingVertical: 15 },
  solid: { backgroundColor: colors.accent },
  danger: { borderColor: colors.redDim, backgroundColor: 'transparent' },
  ghost: { borderColor: 'transparent', backgroundColor: 'transparent', minHeight: 40 },
  disabled: { opacity: 0.4 },
  label: {
    fontFamily: fonts.heading,
    fontSize: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  labelSm: { fontSize: 12, letterSpacing: 1.5 },
  labelLg: { fontSize: 15, letterSpacing: 2.5 },
});

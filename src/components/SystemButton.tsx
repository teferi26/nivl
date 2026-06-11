import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts } from '@/lib/theme';

interface Props {
  title: string;
  onPress: () => void;
  variant?: 'solid' | 'outline' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function SystemButton({ title, onPress, variant = 'solid', disabled, loading, style }: Props) {
  const solid = variant === 'solid';
  const danger = variant === 'danger';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        solid && styles.solid,
        danger && styles.danger,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={solid ? colors.bg : colors.cyan} size="small" />
      ) : (
        <Text
          style={[
            styles.label,
            solid && styles.labelSolid,
            danger && styles.labelDanger,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1.5,
    borderColor: colors.cyan,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solid: {
    backgroundColor: colors.cyan,
  },
  danger: {
    borderColor: colors.redDim,
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.75,
  },
  label: {
    fontFamily: fonts.heading,
    fontSize: 15,
    letterSpacing: 2,
    color: colors.cyan,
    textTransform: 'uppercase',
  },
  labelSolid: {
    color: colors.bg,
  },
  labelDanger: {
    color: colors.red,
  },
});

// NIVL · La tarjeta: una unidad con superficie propia.
//
// Tres variantes y un solo significado cada una:
//   · raised  → superficie elevada sin borde (lo normal para listas de cosas).
//   · outline → marco de hierro sobre el negro (avisos y bloques secundarios).
//   · tinted  → relleno tenue del color de acento; para "activo" o "hecho".
// Con `onPress` responde al dedo encogiéndose (PressScale).

import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '@/lib/theme';
import { PressScale } from './motion';

interface Props {
  variant?: 'raised' | 'outline' | 'tinted';
  /** Color del borde (outline) o de una barra lateral izquierda de 2 px. */
  accent?: string;
  padded?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

export function Card({
  variant = 'raised',
  accent,
  padded = true,
  onPress,
  onLongPress,
  disabled,
  accessibilityLabel,
  style,
  children,
}: Props) {
  const base = [
    styles.card,
    variant === 'raised' && styles.raised,
    variant === 'outline' && [styles.outline, accent ? { borderColor: accent } : null],
    variant === 'tinted' && styles.tinted,
    accent && variant !== 'outline' ? { borderLeftWidth: 2, borderLeftColor: accent } : null,
    padded && styles.padded,
    style,
  ];

  if (onPress || onLongPress) {
    return (
      <PressScale
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={base}
      >
        {children}
      </PressScale>
    );
  }
  return <View style={base}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { marginBottom: 10 },
  raised: { backgroundColor: colors.panel },
  outline: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg },
  tinted: { backgroundColor: colors.accentFaint },
  padded: { padding: 16 },
});

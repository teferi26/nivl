// NIVL · Sección editorial: un rótulo, opcionalmente un dato o una acción a la
// derecha, y debajo el contenido SIN caja. La caja (Card) se reserva para lo
// que de verdad es una unidad: una misión, una campaña, un aviso.

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts } from '@/lib/theme';

interface Props {
  title: string;
  /** Dato a la derecha del rótulo: "2/6", "12 días". */
  meta?: string;
  /** Acción a la derecha: "Ver todo", "Editar". */
  action?: { label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap };
  tone?: 'dim' | 'accent' | 'gold' | 'red' | 'steel';
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

const TONE = {
  dim: colors.textFaint,
  accent: colors.accentText,
  gold: colors.gold,
  red: colors.red,
  steel: colors.steel,
} as const;

export function Section({ title, meta, action, tone = 'dim', style, children }: Props) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: TONE[tone] }]}>{title}</Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        {action ? (
          <Pressable onPress={action.onPress} hitSlop={8} style={styles.action} accessibilityRole="button" accessibilityLabel={action.label}>
            <Text style={styles.actionText}>{action.label}</Text>
            <Ionicons name={action.icon ?? 'chevron-forward'} size={13} color={colors.accentText} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Separador fino entre bloques de una misma sección. */
export function Rule({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.rule, style]} />;
}

const styles = StyleSheet.create({
  section: { marginBottom: 26 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  title: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  meta: { fontFamily: fonts.number, fontSize: 13, color: colors.text },
  action: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  actionText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.accentText },
  rule: { height: 1, backgroundColor: colors.line },
});

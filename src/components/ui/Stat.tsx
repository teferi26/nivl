// NIVL · Cifras: la piedra tallada (Cinzel) con su rótulo debajo.

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts } from '@/lib/theme';

interface StatProps {
  value: string | number;
  label: string;
  /** Sufijo pequeño pegado al valor: "XP", "%", "kg". */
  unit?: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'text' | 'accent' | 'gold' | 'steel' | 'red';
  align?: 'left' | 'center';
  style?: StyleProp<ViewStyle>;
}

const TONE = {
  text: colors.text,
  accent: colors.accent,
  gold: colors.gold,
  steel: colors.steel,
  red: colors.red,
} as const;

const SIZE = { sm: 20, md: 28, lg: 44 } as const;

export function Stat({ value, label, unit, size = 'md', tone = 'text', align = 'left', style }: StatProps) {
  return (
    <View style={[align === 'center' && styles.center, style]}>
      <View style={[styles.valueRow, align === 'center' && styles.center]}>
        <Text style={[styles.value, { fontSize: SIZE[size], color: TONE[tone] }]}>{value}</Text>
        {unit ? <Text style={[styles.unit, { color: TONE[tone] }]}>{unit}</Text> : null}
      </View>
      <Text style={[styles.label, align === 'center' && styles.labelCenter]}>{label}</Text>
    </View>
  );
}

/** Rejilla de cifras en una fila, separadas por líneas verticales. */
export function StatRow({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  value: { fontFamily: fonts.number, letterSpacing: 0.5 },
  unit: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 1, opacity: 0.8 },
  label: {
    fontFamily: fonts.heading,
    fontSize: 10.5,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.textFaint,
    marginTop: 4,
  },
  labelCenter: { textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
});

// NIVL · Chips: selección (rango, stat, día) y etiquetas de estado.

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { ink, space, type as tipo } from '@/design/tokens';
import { colors, fonts } from '@/lib/theme';
import { Grano, Trama } from './Texture';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: 'accent' | 'steel' | 'gold' | 'red';
  small?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const TONE = { accent: colors.accent, steel: colors.steel, gold: colors.gold, red: colors.red } as const;

export function Chip({ label, selected, onPress, icon, tone = 'accent', small, disabled, accessibilityLabel, style }: ChipProps) {
  const c = TONE[tone];
  const content = (
    <>
      {icon ? <Ionicons name={icon} size={small ? 12 : 14} color={selected ? colors.bg : colors.textDim} /> : null}
      <Text style={[styles.text, small && styles.textSmall, selected && { color: colors.bg }]}>{label}</Text>
    </>
  );
  const box = [
    styles.chip,
    small && styles.chipSmall,
    selected && { backgroundColor: c, borderColor: c },
    disabled && styles.disabled,
    style,
  ];
  if (!onPress) return <View style={box}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={selected === undefined ? 'button' : 'radio'}
      accessibilityState={selected === undefined ? undefined : { selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [box, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

/**
 * Fila de chips que se desplaza en horizontal sin cortar el padding de la
 * pantalla. En la web envuelve como `ChipWrap`: con ratón no hay gesto lateral
 * y los chips del final quedaban inalcanzables.
 */
export function ChipRow({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  if (Platform.OS === 'web') return <View style={[styles.wrap, style]}>{children}</View>;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={[styles.rowScroll, style]}
      contentContainerStyle={styles.rowContent}
    >
      {children}
    </ScrollView>
  );
}

/** Chips que envuelven en varias líneas (formularios). */
export function ChipWrap({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.wrap, style]}>{children}</View>;
}

export type TagTone = 'dim' | 'accent' | 'gold' | 'red' | 'steel' | 'alerta' | 'logro';

/**
 * Etiqueta de estado, sin interacción: "PENALIZACIÓN", "JEFE", "HOY".
 * Tonos v2 (SISTEMA §5): `alerta` = pastilla con borde de trama y `logro` =
 * pastilla con borde de grano; el texto va en micro ink9 sobre una placa ink0
 * por dentro, así la textura no pasa por debajo de las letras. Los tonos de
 * color se conservan hasta que se migren las pantallas (L2).
 */
export function Tag({ children, tone = 'dim' }: { children: ReactNode; tone?: TagTone }) {
  if (tone === 'alerta' || tone === 'logro') {
    return (
      <View style={styles.tagMarco}>
        {tone === 'alerta' ? <Trama color={ink.ink6} /> : <Grano />}
        <View style={styles.tagPlaca}>
          <Text maxFontSizeMultiplier={1.35} style={styles.tagTextoV2}>
            {children}
          </Text>
        </View>
      </View>
    );
  }
  const color =
    tone === 'accent' ? colors.accent : tone === 'gold' ? colors.gold : tone === 'red' ? colors.red : tone === 'steel' ? colors.steel : colors.textFaint;
  return (
    <View style={[styles.tag, { borderColor: color }]}>
      <Text style={[styles.tagText, { color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.accentDim,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipSmall: { paddingHorizontal: 10, paddingVertical: 6 },
  text: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  textSmall: { fontSize: 12 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  rowScroll: { marginHorizontal: -20 },
  rowContent: { paddingHorizontal: 20, gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  tagText: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
  // Pastilla completa: la textura hace de borde de 3 pt alrededor de la placa.
  tagMarco: { alignSelf: 'flex-start', borderRadius: 999, overflow: 'hidden', padding: 3, backgroundColor: ink.ink0 },
  tagPlaca: { borderRadius: 999, backgroundColor: ink.ink0, paddingHorizontal: space.s2, paddingVertical: 2 },
  tagTextoV2: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    textTransform: 'uppercase',
    color: ink.ink9,
  },
});

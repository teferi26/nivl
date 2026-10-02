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

const HITSLOP_SMALL = { top: 7, bottom: 7, left: 0, right: 0 };

/**
 * Seleccionado SIN invertir (SISTEMA §0: una sola inversión por pantalla, y la
 * gastan los botones primarios): marco de 2 pt en ink10, texto ink10 y placa
 * ink1. El no seleccionado lleva marco de 1 pt ink4 y texto ink9: se distingue
 * por el grosor y el brillo del marco, no por un relleno blanco. `tone` se
 * conserva por compatibilidad; en v2 el seleccionado es siempre monocromo.
 */
export function Chip({ label, selected, onPress, icon, small, disabled, accessibilityLabel, style }: ChipProps) {
  const content = (
    <>
      {icon ? <Ionicons name={icon} size={small ? 12 : 14} color={disabled ? ink.ink6 : selected ? ink.ink10 : colors.textDim} /> : null}
      <Text style={[styles.text, small && styles.textSmall, selected && styles.textSelected, disabled && styles.textDisabled]}>{label}</Text>
    </>
  );
  const box = [
    styles.chip,
    small && styles.chipSmall,
    selected && (small ? styles.selectedSmall : styles.selected),
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
      // El pequeño mide ~30 de alto: el hitSlop lo lleva a 44 de zona táctil.
      hitSlop={small ? HITSLOP_SMALL : undefined}
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
  // Marco de 2: se resta 1 al relleno para que el chip no crezca al elegirlo.
  selected: { borderWidth: 2, borderColor: ink.ink10, backgroundColor: ink.ink1, paddingHorizontal: 13, paddingVertical: 8 },
  selectedSmall: { borderWidth: 2, borderColor: ink.ink10, backgroundColor: ink.ink1, paddingHorizontal: 9, paddingVertical: 5 },
  textSelected: { color: ink.ink10 },
  text: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  textSmall: { fontSize: 12 },
  // Desactivado sin opacidad (SISTEMA v2): marco ink4 y texto ink6.
  disabled: { borderColor: ink.ink4 },
  textDisabled: { color: ink.ink6 },
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

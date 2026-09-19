// NIVL · La fila: un elemento de lista con marca a la izquierda, título y
// detalle en el centro, y un valor a la derecha. Sirve para misiones, reglas,
// tareas de campaña, movimientos de dinero, entradas del diario.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts } from '@/lib/theme';

interface CheckProps {
  checked: boolean;
  busy?: boolean;
  tone?: 'accent' | 'red' | 'gold' | 'steel';
  size?: number;
}

const TONE = { accent: colors.accent, red: colors.red, gold: colors.gold, steel: colors.steel } as const;

/** Marca de completar: círculo de hierro que se rellena de blanco. */
export function Check({ checked, busy, tone = 'accent', size = 26 }: CheckProps) {
  const c = TONE[tone];
  // El momento de marcar: la marca se encoge, rebota un punto por encima y se
  // asienta. Solo cuando `checked` CAMBIA a true estando en pantalla; una fila
  // que ya llega hecha no celebra nada.
  const scale = useRef(new Animated.Value(1)).current;
  const antes = useRef(checked);
  useEffect(() => {
    if (checked && !antes.current) {
      scale.setValue(0.8);
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.15, useNativeDriver: true, speed: 38, bounciness: 10 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }),
      ]).start();
    }
    antes.current = checked;
  }, [checked, scale]);

  return (
    <Animated.View
      style={[
        styles.check,
        { width: size, height: size, borderRadius: size / 2 },
        checked && { backgroundColor: c, borderColor: c },
        !checked && tone !== 'accent' && { borderColor: c },
        { transform: [{ scale }] },
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.accent} />
      ) : checked ? (
        <Ionicons name="checkmark" size={size * 0.6} color={colors.bg} />
      ) : null}
    </Animated.View>
  );
}

interface RowProps {
  /** Lo que va a la izquierda: un Check, un icono, una letra. */
  leading?: ReactNode;
  title: string;
  detail?: string | ReactNode;
  /** Lo que va a la derecha: un valor, una flecha. */
  trailing?: ReactNode;
  /** Texto tachado y atenuado. */
  done?: boolean;
  /** Título atenuado sin tachar (perdido, inactivo). */
  muted?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  /** Sin línea superior (primera fila de un grupo). */
  first?: boolean;
  chevron?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'checkbox';
  accessibilityState?: { checked?: boolean; selected?: boolean; disabled?: boolean };
  style?: StyleProp<ViewStyle>;
}

export function Row({
  leading,
  title,
  detail,
  trailing,
  done,
  muted,
  onPress,
  onLongPress,
  disabled,
  first,
  chevron,
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  style,
}: RowProps) {
  // Al pasar a hecha, la fila entera se enciende un instante (accentFaint) y
  // se apaga: el ojo encuentra qué ha cambiado sin leer.
  const flash = useRef(new Animated.Value(0)).current;
  const eraHecha = useRef(!!done);
  useEffect(() => {
    if (done && !eraHecha.current) {
      flash.setValue(1);
      Animated.timing(flash, { toValue: 0, duration: 320, delay: 80, useNativeDriver: true }).start();
    }
    eraHecha.current = !!done;
  }, [done, flash]);

  const body = (
    <>
      <Animated.View pointerEvents="none" style={[styles.flash, { opacity: flash }]} />
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.body}>
        <Text style={[styles.title, done && styles.titleDone, muted && styles.titleMuted]} numberOfLines={2}>
          {title}
        </Text>
        {detail ? (
          typeof detail === 'string' ? (
            <Text style={styles.detail} numberOfLines={2}>
              {detail}
            </Text>
          ) : (
            <View style={styles.detailWrap}>{detail}</View>
          )
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      {chevron ? <Ionicons name="chevron-forward" size={16} color={colors.textFaint} /> : null}
    </>
  );

  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled}
        accessibilityRole={accessibilityRole ?? 'button'}
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityState={accessibilityState}
        style={({ pressed }) => [styles.row, !first && styles.sep, pressed && styles.pressed, style]}
      >
        {body}
      </Pressable>
    );
  }
  return <View style={[styles.row, !first && styles.sep, style]}>{body}</View>;
}

/** Valor a la derecha de una fila: "+55 XP", "18 días". */
export function RowValue({ children, tone = 'dim', strong }: { children: ReactNode; tone?: 'dim' | 'accent' | 'gold' | 'red' | 'steel'; strong?: boolean }) {
  const color =
    tone === 'accent' ? colors.accent : tone === 'gold' ? colors.gold : tone === 'red' ? colors.red : tone === 'steel' ? colors.steel : colors.textFaint;
  return <Text style={[styles.value, { color }, strong && styles.valueStrong]}>{children}</Text>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  sep: { borderTopWidth: 1, borderTopColor: colors.line },
  // Sangra 16 a cada lado: es el padding de las tarjetas-lista, así el destello
  // llega a sus bordes.
  flash: { position: 'absolute', top: 0, bottom: 0, left: -16, right: -16, backgroundColor: colors.accentFaint },
  pressed: { opacity: 0.6 },
  leading: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.text },
  titleDone: { color: colors.textFaint, textDecorationLine: 'line-through' },
  titleMuted: { color: colors.textDim },
  detail: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: colors.textFaint, marginTop: 2 },
  detailWrap: { marginTop: 3 },
  trailing: { alignItems: 'flex-end', justifyContent: 'center' },
  value: { fontFamily: fonts.number, fontSize: 13, letterSpacing: 0.3 },
  valueStrong: { fontSize: 14 },
  check: {
    borderWidth: 1.5,
    borderColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

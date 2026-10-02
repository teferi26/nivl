// NIVL · Botón v2 (SISTEMA.md §5). Sustituye a SystemButton, que ahora lo envuelve.
//
//   · primary   → blanco sólido con texto negro: la acción principal, una por pantalla.
//   · secondary → contorno blanco de 1,5.
//   · ghost     → solo texto.
//   · danger    → contorno con trama y texto blanco: el peligro es la trama, no el rojo.
// Alto 52 (lg), 44 (md), 36 (sm; con hitSlop para llegar a 44 de zona táctil).
// Dentro de una Card inverse (SuperficieContext) se invierten los colores.
// Desactivado: sin opacidad (rompe el contraste del texto); borde ink4 y texto
// ink6 sobre el fondo, en cualquier variante.
// Rótulo: Outfit 700 en mayúsculas, 15 · 14 · 12 (lg · md · sm). Es el único
// texto del kit fuera de la escala `type`; está documentado en SISTEMA §5.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useContext, useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { ink, type as tipo } from '@/design/tokens';
import { SuperficieContext } from './Card';
import { splitStyle, useMovimientoReducido } from './motion';
import { Trama } from './Texture';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

const ALTO: Record<ButtonSize, number> = { sm: 36, md: 44, lg: 52 };
const ZONA_TACTIL = 44;

export function Button({ title, onPress, variant = 'primary', size = 'md', icon, disabled, loading, style }: ButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const reducido = useMovimientoReducido();
  const invertida = useContext(SuperficieContext) === 'inverse';
  // Sobre blanco, el «blanco» del botón pasa a ser negro y viceversa.
  const claro = invertida ? ink.ink0 : ink.ink10;
  const oscuro = invertida ? ink.ink10 : ink.ink0;
  const primary = variant === 'primary';
  const danger = variant === 'danger';
  const ghost = variant === 'ghost';
  const apagado = !!disabled && !loading;
  const fg = apagado ? ink.ink6 : primary ? oscuro : claro;
  // El layout (márgenes, alignSelf, flex, ancho) va al Pressable, que es quien
  // ocupa sitio en el padre; lo visual, a la vista que escala.
  const { outer, inner } = splitStyle(style);
  const animar = (v: number) => {
    if (reducido) return;
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  };
  const alto = ALTO[size];
  const extra = Math.max(0, Math.ceil((ZONA_TACTIL - alto) / 2));
  const hitSlop = extra > 0 ? { top: extra, bottom: extra, left: 0, right: 0 } : undefined;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      onPressIn={() => animar(0.97)}
      onPressOut={() => animar(1)}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={outer}
    >
      <Animated.View
        style={[
          styles.base,
          { minHeight: alto, borderColor: claro },
          size === 'sm' && styles.sm,
          size === 'lg' && styles.lg,
          primary && { backgroundColor: claro },
          ghost && styles.ghost,
          danger && [styles.danger, { backgroundColor: oscuro }],
          // La ghost apagada solo cambia el texto: un borde la convertiría en otra variante.
          apagado && !ghost && [styles.apagado, { backgroundColor: oscuro }],
          inner,
          { transform: [{ scale }] },
        ]}
      >
        {danger && !apagado ? (
          <>
            {/* ink6 sobre negro: con ink4 un borde de 3 pt no se distingue de un botón apagado. */}
            <Trama color={invertida ? ink.ink4 : ink.ink6} />
            <View pointerEvents="none" style={[styles.dangerDentro, { backgroundColor: oscuro }]} />
          </>
        ) : null}
        {loading ? (
          <ActivityIndicator color={fg} size="small" />
        ) : (
          <>
            {icon ? <Ionicons name={icon} size={size === 'sm' ? 14 : 17} color={fg} /> : null}
            <Text
              maxFontSizeMultiplier={1.35}
              style={[styles.label, size === 'sm' && styles.labelSm, size === 'lg' && styles.labelLg, { color: fg }]}
            >
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
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: { paddingVertical: 6, paddingHorizontal: 14 },
  lg: { paddingVertical: 14 },
  ghost: { borderColor: 'transparent', backgroundColor: 'transparent' },
  // La trama hace de borde: 3 pt de rayado alrededor del fondo.
  danger: { borderWidth: 0, overflow: 'hidden' },
  dangerDentro: { position: 'absolute', top: 3, left: 3, right: 3, bottom: 3 },
  // Gana a primary y danger: sin relleno blanco, sin trama, borde ink4.
  apagado: { borderWidth: 1.5, borderColor: ink.ink4 },
  label: {
    fontFamily: tipo.label.family,
    fontSize: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  labelSm: { fontSize: 12, letterSpacing: 1.5 },
  labelLg: { fontSize: 15, letterSpacing: 2.5 },
});

// NIVL · Barra lateral (clase `expanded`, ≥ 1024: iPad horizontal, iPad Pro,
// Mac, PC). SISTEMA.md §3.
//
// 240 pt: la marca NIVL en Cinzel arriba, filas de 44 con icono y rótulo, y
// abajo el lema entre dos laureles (o el rango del gladiador si se pasa). La
// fila activa habla como el raíl: regla de 2 pegada a la izquierda, fondo ink2,
// icono sólido y rótulo en ink10. No se invierte: la inversión queda para la
// acción principal de cada pantalla.

import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Laurel } from '@/components/arena';
import { ANCHO_SIDEBAR } from '@/design/responsive';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { fonts } from '@/lib/theme';
import { navItemDe, pulsarDestino } from './navItems';

interface NavSidebarProps extends BottomTabBarProps {
  /** Hueco del pie: si no se pasa nada, el lema entre laureles. */
  rango?: ReactNode;
}

// El lema en dos líneas fijas: en una no cabe en 240 ni a 11 (≈194 de 188
// útiles, `anchoInscripcion`), y partido a mano no queda «DÍA» huérfano. La
// línea larga, «UN 1 % MEJOR», mide ≈162 a 14/3.
const LEMA = 'UN 1 % MEJOR\nCADA DÍA';
const LAUREL_LEMA = 16;

export function NavSidebar({ state, descriptors, navigation, rango }: NavSidebarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.barra,
        {
          width: ANCHO_SIDEBAR + insets.left,
          paddingLeft: insets.left,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <Text style={styles.marca} accessibilityRole="header" maxFontSizeMultiplier={1}>
        NIVL
      </Text>
      <ScrollView
        style={styles.flex}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.lista}
        accessibilityRole="tablist"
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const meta = navItemDe(route, descriptors);
          return (
            <Pressable
              key={route.key}
              onPress={() => pulsarDestino(navigation, route, focused)}
              style={({ pressed }) => [styles.fila, (focused || pressed) && styles.filaOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={meta.label}
            >
              {focused ? <View style={styles.indicador} /> : null}
              <Ionicons name={focused ? meta.on : meta.off} size={20} color={focused ? ink.ink10 : ink.ink8} />
              <Text style={[styles.rotulo, focused && styles.rotuloOn]} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.pie}>
        {rango ?? (
          <View style={styles.lema} accessible accessibilityLabel="Un 1 % mejor cada día">
            <Laurel alto={LAUREL_LEMA} lado="izq" />
            <Text style={styles.lemaTexto} maxFontSizeMultiplier={1} numberOfLines={2}>
              {LEMA}
            </Text>
            <Laurel alto={LAUREL_LEMA} lado="der" />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  barra: {
    backgroundColor: ink.ink0,
    borderRightWidth: stroke.hairline,
    borderRightColor: ink.ink3,
  },
  marca: {
    fontFamily: fonts.brand,
    fontSize: tipo.rank.size,
    lineHeight: tipo.rank.lineHeight,
    letterSpacing: 8,
    color: ink.ink10,
    paddingHorizontal: space.s6,
    paddingTop: space.s8,
    paddingBottom: space.s6,
  },
  lista: { paddingHorizontal: space.s3, gap: space.s1 },
  fila: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingHorizontal: space.s3,
  },
  filaOn: { backgroundColor: ink.ink2 },
  indicador: {
    position: 'absolute',
    left: 0,
    top: space.s2,
    bottom: space.s2,
    width: stroke.rule,
    backgroundColor: ink.ink10,
  },
  rotulo: {
    flex: 1,
    minWidth: 0,
    fontFamily: tipo.body.family,
    fontSize: tipo.body.size,
    color: ink.ink8,
  },
  rotuloOn: { fontFamily: tipo.headline.family, color: ink.ink10 },
  pie: {
    marginHorizontal: space.s3,
    marginBottom: space.s4,
    borderTopWidth: stroke.hairline,
    borderTopColor: ink.ink3,
    paddingTop: space.s4,
  },
  lema: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s2,
  },
  lemaTexto: {
    flexShrink: 1,
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    lineHeight: tipo.inscripcion.lineHeight,
    letterSpacing: 3,
    color: ink.ink6,
    textAlign: 'center',
  },
});

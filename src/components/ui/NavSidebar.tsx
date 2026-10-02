// NIVL · Barra lateral (clase `expanded`, ≥ 1024: iPad horizontal, iPad Pro,
// Mac, PC). SISTEMA.md §3.
//
// 240 pt: la marca NIVL en Cinzel arriba, filas de 44 con icono y rótulo, y
// abajo un hueco reservado para el rango del gladiador (lote L3). La fila
// activa va invertida (blanco con texto negro): es la única superficie blanca
// de la navegación.

import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ANCHO_SIDEBAR } from '@/design/responsive';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { fonts } from '@/lib/theme';
import { navItemDe, pulsarDestino } from './navItems';

interface NavSidebarProps extends BottomTabBarProps {
  /** Hueco del rango (L3: avatar con su marco, título y nivel). */
  rango?: ReactNode;
}

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
              style={({ pressed }) => [styles.fila, focused ? styles.filaOn : pressed && styles.pressed]}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={meta.label}
            >
              <Ionicons name={focused ? meta.on : meta.off} size={20} color={focused ? ink.ink0 : ink.ink8} />
              <Text style={[styles.rotulo, focused && styles.rotuloOn]} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {/* Reservado para el rango (L3). Mantiene su alto aunque esté vacío para
          que la navegación no salte cuando llegue. */}
      <View style={styles.rango}>{rango}</View>
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
  filaOn: { backgroundColor: ink.ink10 },
  pressed: { backgroundColor: ink.ink2 },
  rotulo: {
    flex: 1,
    minWidth: 0,
    fontFamily: tipo.body.family,
    fontSize: tipo.body.size,
    color: ink.ink8,
  },
  rotuloOn: { fontFamily: tipo.headline.family, color: ink.ink0 },
  rango: {
    minHeight: 88,
    marginHorizontal: space.s3,
    marginBottom: space.s4,
    borderTopWidth: stroke.hairline,
    borderTopColor: ink.ink3,
    paddingTop: space.s4,
  },
});

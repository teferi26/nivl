// NIVL · Raíl de navegación (clase `medium`, 600–1023: iPad mini, iPad
// vertical, plegable abierto, iPhone en horizontal). SISTEMA.md §3.
//
// 72 pt a la izquierda, icono de 24 con su rótulo de 11 debajo. El destino
// activo lleva el icono sólido y una regla vertical blanca de 2 pt pegada al
// borde: el estado se dice con forma, no con color. Va dentro de un scroll por
// si la ventana es muy baja (iPhone en horizontal, ventanas de iPadOS).

import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ANCHO_RAIL } from '@/design/responsive';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { navItemDe, pulsarDestino } from './navItems';

export function NavRail({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.rail, { width: ANCHO_RAIL + insets.left, paddingLeft: insets.left }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        accessibilityRole="tablist"
        contentContainerStyle={[
          styles.lista,
          { paddingTop: insets.top + space.s4, paddingBottom: insets.bottom + space.s4 },
        ]}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const meta = navItemDe(route, descriptors);
          return (
            <Pressable
              key={route.key}
              onPress={() => pulsarDestino(navigation, route, focused)}
              style={({ pressed }) => [styles.item, pressed && !focused && styles.pressed]}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={meta.label}
            >
              {focused ? <View style={styles.indicador} /> : null}
              <Ionicons name={focused ? meta.on : meta.off} size={24} color={focused ? ink.ink10 : ink.ink6} />
              <Text style={[styles.rotulo, focused && styles.rotuloOn]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    backgroundColor: ink.ink0,
    borderRightWidth: stroke.hairline,
    borderRightColor: ink.ink3,
  },
  lista: { gap: space.s1 },
  item: {
    width: ANCHO_RAIL - stroke.hairline,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s1,
    paddingVertical: space.s2,
  },
  pressed: { backgroundColor: ink.ink2 },
  indicador: {
    position: 'absolute',
    left: 0,
    top: space.s2,
    bottom: space.s2,
    width: stroke.rule,
    backgroundColor: ink.ink10,
  },
  rotulo: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    color: ink.ink6,
    paddingHorizontal: space.s1,
  },
  rotuloOn: { color: ink.ink10 },
});

// NIVL · Barra de pestañas propia.
//
// La de serie pintaba seis iconos grises sobre una franja. Esta marca la activa
// con una línea blanca arriba (la misma gramática que un separador editorial),
// el icono relleno y la etiqueta en blanco, y responde al dedo con háptica.
// Solo en `compact`; en `medium` va NavRail y en `expanded`, NavSidebar. Los
// iconos y rótulos son los de navItems.ts.

import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@/lib/theme';
import { navItemDe, pulsarDestino } from './navItems';

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 8 : 6) }]}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const meta = navItemDe(route, descriptors);
        const label = meta.label;
        const onPress = () => pulsarDestino(navigation, route, focused);
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={styles.item}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
          >
            <View style={[styles.indicator, focused && styles.indicatorOn]} />
            <Ionicons name={focused ? meta.on : meta.off} size={21} color={focused ? colors.accent : colors.textFaint} />
            {/* La barra no crece con el texto: con tamaño dinámico alto, seis
                rótulos no caben en 375. El nombre completo va en el label. */}
            <Text style={[styles.label, focused && styles.labelOn]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.tabBar,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  item: { flex: 1, alignItems: 'center', paddingTop: 10, gap: 4 },
  indicator: {
    position: 'absolute',
    top: -1,
    width: 28,
    height: 2,
    backgroundColor: 'transparent',
  },
  indicatorOn: { backgroundColor: colors.accent },
  label: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textFaint, letterSpacing: 0 },
  labelOn: { color: colors.accent },
});

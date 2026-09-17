// NIVL · Barra de pestañas propia.
//
// La de serie pintaba seis iconos grises sobre una franja. Esta marca la activa
// con una línea blanca arriba (la misma gramática que un separador editorial),
// el icono relleno y la etiqueta en blanco, y responde al dedo con háptica.

import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@/lib/theme';

type Icon = keyof typeof Ionicons.glyphMap;

const ICONS: Record<string, { off: Icon; on: Icon; label: string }> = {
  index: { off: 'today-outline', on: 'today', label: 'Hoy' },
  coach: { off: 'chatbubble-ellipses-outline', on: 'chatbubble-ellipses', label: 'Coach' },
  habitos: { off: 'repeat-outline', on: 'repeat', label: 'Hábitos' },
  mazmorras: { off: 'flag-outline', on: 'flag', label: 'Campañas' },
  agenda: { off: 'calendar-outline', on: 'calendar', label: 'Agenda' },
  perfil: { off: 'person-outline', on: 'person', label: 'Perfil' },
};

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 8 : 6) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const meta = ICONS[route.name] ?? { off: 'ellipse-outline', on: 'ellipse', label: route.name };
        const { options } = descriptors[route.key]!;
        const label = typeof options.title === 'string' ? options.title : meta.label;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            Haptics.selectionAsync().catch(() => {});
            navigation.navigate(route.name);
          }
        };
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
            <Text style={[styles.label, focused && styles.labelOn]} numberOfLines={1}>
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
  label: { fontFamily: fonts.semibold, fontSize: 10.5, color: colors.textFaint, letterSpacing: 0.2 },
  labelOn: { color: colors.accent },
});

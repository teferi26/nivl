// NIVL · Barra de pestañas propia.
//
// La de serie pintaba seis iconos grises sobre una franja. Esta marca la activa
// con una línea blanca arriba (la misma gramática que un separador editorial),
// el icono relleno y la etiqueta en blanco, y responde al dedo con háptica.
// Solo en `compact`; en `medium` va NavRail y en `expanded`, NavSidebar. Los
// iconos y rótulos son los de navItems.ts.
//
// Pinta 5 destinos (`destinosDe(…, 'tabs')`): la Agenda vive debajo de Hoy. Por
// eso la activa se decide por NOMBRE con `destinoActivo` y no por índice: en la
// Agenda, Hoy sigue marcada.

import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ink, stroke } from '@/design/tokens';
import { fonts } from '@/lib/theme';
import { destinoActivo, destinosDe, navItemDe, pulsarDestino } from './navItems';

/**
 * `acento`: el color de lo activo. Por defecto ink10 (NIVL); en los mundos de
 * cada modo, su acento de `modoAcento` (solo con `modos_activos`).
 * `centro`: lo que va en medio de la barra, levantado sobre ella (Modos: el
 * emblema que abre la rueda, P01). Sin él, la barra de siempre.
 */
export function TabBar({ state, descriptors, navigation, acento = ink.ink10, centro }: BottomTabBarProps & { acento?: string; centro?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const activo = destinoActivo(state.routes, state.index, 'tabs');
  const enfocada = state.routes[state.index]?.name;
  const pestanas = destinosDe(state.routes, 'tabs').map((route) => {
    const focused = route.name === activo;
    const meta = navItemDe(route, descriptors);
    const label = meta.label;
    // Marcada no es lo mismo que enfocada: desde la Agenda, tocar Hoy
    // (marcada) tiene que volver a Hoy.
    const onPress = () => pulsarDestino(navigation, route, route.name === enfocada);
    const pestana = (
      <Pressable
        key={route.key}
        onPress={onPress}
        style={styles.item}
        accessibilityRole="tab"
        // Para el lector, seleccionada es la pantalla ENFOCADA: en la Agenda
        // no puede anunciar «Hoy, seleccionada», aunque Hoy siga marcada.
        accessibilityState={{ selected: route.name === enfocada }}
        accessibilityLabel={label}
      >
        <View style={[styles.indicator, focused && { backgroundColor: acento }]} />
        <Ionicons name={focused ? meta.on : meta.off} size={21} color={focused ? acento : ink.ink6} />
        {/* La barra no crece con el texto: con tamaño dinámico alto, cinco
            rótulos no caben en 375. El nombre completo va en el label. */}
        <Text style={[styles.label, focused && styles.labelOn, focused && { color: acento }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {label}
        </Text>
      </Pressable>
    );
    return pestana;
  });
  // Con `centro`, las pestañas se reparten a los dos lados en dos mitades
  // iguales: el centro queda en el centro aunque el número de pestañas sea impar.
  const mitad = Math.floor(pestanas.length / 2);
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 8 : 6) }]}
    >
      {centro ? (
        <>
          <View style={styles.lado}>{pestanas.slice(0, mitad)}</View>
          <View style={styles.centro}>{centro}</View>
          <View style={styles.lado}>{pestanas.slice(mitad)}</View>
        </>
      ) : (
        pestanas
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: ink.ink0,
    borderTopWidth: stroke.hairline,
    borderTopColor: ink.ink3,
  },
  item: { flex: 1, alignItems: 'center', paddingTop: 10, gap: 4 },
  centro: { width: 76, alignItems: 'center', marginTop: -24 },
  lado: { flex: 1, flexDirection: 'row' },
  indicator: {
    position: 'absolute',
    top: -1,
    width: 28,
    height: stroke.rule,
    backgroundColor: 'transparent',
  },
  label: { fontFamily: fonts.semibold, fontSize: 11, color: ink.ink6, letterSpacing: 0 },
  labelOn: { color: ink.ink10 },
});

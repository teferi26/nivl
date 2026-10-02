// NIVL · Destinos de la navegación principal: un solo sitio para los iconos y
// los rótulos, que comparten la barra inferior (compact), el raíl (medium) y la
// barra lateral (expanded). El estado activo usa la variante sólida del icono,
// no un color (SISTEMA.md §4).

import type Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { vibrar } from '@/design/haptics';

type Icon = keyof typeof Ionicons.glyphMap;

export interface NavItem {
  off: Icon;
  on: Icon;
  label: string;
}

export const NAV_ITEMS: Record<string, NavItem> = {
  index: { off: 'today-outline', on: 'today', label: 'Hoy' },
  coach: { off: 'chatbubble-ellipses-outline', on: 'chatbubble-ellipses', label: 'Coach' },
  habitos: { off: 'repeat-outline', on: 'repeat', label: 'Hábitos' },
  mazmorras: { off: 'flag-outline', on: 'flag', label: 'Campañas' },
  agenda: { off: 'calendar-outline', on: 'calendar', label: 'Agenda' },
  perfil: { off: 'person-outline', on: 'person', label: 'Perfil' },
};

type Route = BottomTabBarProps['state']['routes'][number];

/** Icono y rótulo de una pestaña. El `title` de la pantalla gana al rótulo. */
export function navItemDe(route: Route, descriptors: BottomTabBarProps['descriptors']): NavItem {
  const meta = NAV_ITEMS[route.name] ?? { off: 'ellipse-outline', on: 'ellipse', label: route.name };
  const title = descriptors[route.key]?.options.title;
  return typeof title === 'string' ? { ...meta, label: title } : meta;
}

/**
 * Pulsar un destino: emite `tabPress` (para que una pantalla pueda impedirlo o
 * volver arriba) y, si no está activo, vibra (mapa único de SISTEMA §9, que
 * respeta el ajuste de Perfil) y navega.
 */
export function pulsarDestino(navigation: BottomTabBarProps['navigation'], route: Route, focused: boolean): void {
  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
  if (!focused && !event.defaultPrevented) {
    vibrar('seleccion');
    navigation.navigate(route.name);
  }
}

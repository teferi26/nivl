// NIVL · Destinos de la navegación principal: un solo sitio para los iconos y
// los rótulos, que comparten la barra inferior (compact), el raíl (medium) y la
// barra lateral (expanded). El estado activo usa la variante sólida del icono,
// no un color (SISTEMA.md §4).
//
// En `compact` la barra inferior lleva 5 destinos (SISTEMA §3): la Agenda deja
// de ser pestaña y pasa a destino secundario de Hoy (se entra desde su
// cabecera). En el raíl y la barra lateral siguen los 6.

import type Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { vibrar } from '@/design/haptics';
import type { NavKind } from '@/design/responsive';
import { t } from '@/i18n';

type Icon = keyof typeof Ionicons.glyphMap;

/** Los destinos con nombre en `comun:destino.*` (también los títulos de (tabs)/_layout). */
export type Destino = 'hoy' | 'agenda' | 'coach' | 'habitos' | 'campanas' | 'perfil';

/** El nombre visible de un destino, en el idioma actual (al pintar, nunca al cargar). */
export function nombreDestino(destino: Destino): string {
  return t(`comun:destino.${destino}`);
}

export interface NavDestino {
  off: Icon;
  on: Icon;
  /** Clave del rótulo: se traduce al pintar (`navItemDe`). */
  destino: Destino;
  /** Si sale en la barra inferior de `compact`. Por defecto, sí. */
  compact?: boolean;
  /** Destino que se marca como activo cuando se está en este (p. ej. Agenda → Hoy). */
  padre?: string;
}

export interface NavItem {
  off: Icon;
  on: Icon;
  label: string;
  /** Si sale en la barra inferior de `compact`. Por defecto, sí. */
  compact?: boolean;
  /** Destino que se marca como activo cuando se está en este (p. ej. Agenda → Hoy). */
  padre?: string;
}

export const NAV_ITEMS: Record<string, NavDestino> = {
  index: { off: 'today-outline', on: 'today', destino: 'hoy' },
  coach: { off: 'chatbubble-ellipses-outline', on: 'chatbubble-ellipses', destino: 'coach' },
  habitos: { off: 'repeat-outline', on: 'repeat', destino: 'habitos' },
  mazmorras: { off: 'flag-outline', on: 'flag', destino: 'campanas' },
  agenda: { off: 'calendar-outline', on: 'calendar', destino: 'agenda', compact: false, padre: 'index' },
  perfil: { off: 'person-outline', on: 'person', destino: 'perfil' },
};

/**
 * Los iconos de las barras de cada mundo (Modos: `src/modos/rutasModo.ts`).
 * El rótulo llega siempre por el `title` del layout del mundo.
 */
export const NAV_MUNDO: Record<string, { off: Icon; on: Icon }> = {
  'iron-hoy': { off: 'today-outline', on: 'today' },
  'iron-rutinas': { off: 'list-outline', on: 'list' },
  'iron-pesos': { off: 'trending-up-outline', on: 'trending-up' },
  'iron-coach': { off: 'chatbubble-ellipses-outline', on: 'chatbubble-ellipses' },
  'focus-hoy': { off: 'today-outline', on: 'today' },
  'focus-temario': { off: 'book-outline', on: 'book' },
  'focus-examenes': { off: 'calendar-outline', on: 'calendar' },
  'focus-coach': { off: 'chatbubble-ellipses-outline', on: 'chatbubble-ellipses' },
  'work-hoy': { off: 'today-outline', on: 'today' },
  'work-agenda': { off: 'calendar-outline', on: 'calendar' },
  'work-economia': { off: 'wallet-outline', on: 'wallet' },
  'work-coach': { off: 'chatbubble-ellipses-outline', on: 'chatbubble-ellipses' },
  'founder-hoy': { off: 'today-outline', on: 'today' },
  'founder-agenda': { off: 'calendar-outline', on: 'calendar' },
  'founder-economia': { off: 'wallet-outline', on: 'wallet' },
  'founder-coach': { off: 'chatbubble-ellipses-outline', on: 'chatbubble-ellipses' },
};

type Route = BottomTabBarProps['state']['routes'][number];

/** Los destinos que pinta una navegación: en la barra inferior, sin los que no son de `compact`. */
export function destinosDe<R extends { name: string }>(routes: readonly R[], nav: NavKind): R[] {
  if (nav !== 'tabs') return [...routes];
  return routes.filter((r) => NAV_ITEMS[r.name]?.compact !== false);
}

/**
 * Nombre del destino que se marca como activo. Si la ruta enfocada no se pinta
 * en esta navegación y tiene padre (la Agenda en la barra inferior), se marca
 * el padre: estando en la Agenda, Hoy sigue encendida. En el raíl y la barra
 * lateral la Agenda es un destino más y se marca ella.
 */
export function destinoActivo(
  routes: readonly { name: string }[],
  index: number,
  nav: NavKind = 'tabs',
): string | undefined {
  const nombre = routes[index]?.name;
  if (nombre === undefined) return undefined;
  const item = NAV_ITEMS[nombre];
  const visible = nav !== 'tabs' || item?.compact !== false;
  return !visible && item?.padre ? item.padre : nombre;
}

/** Icono y rótulo de una pestaña. El `title` de la pantalla gana al rótulo. */
export function navItemDe(route: Route, descriptors: BottomTabBarProps['descriptors']): NavItem {
  const d = NAV_ITEMS[route.name];
  const title = descriptors[route.key]?.options.title;
  const label = typeof title === 'string' ? title : d ? nombreDestino(d.destino) : route.name;
  if (d) return { off: d.off, on: d.on, label, compact: d.compact, padre: d.padre };
  const m = NAV_MUNDO[route.name];
  return m ? { off: m.off, on: m.on, label } : { off: 'ellipse-outline', on: 'ellipse', label };
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

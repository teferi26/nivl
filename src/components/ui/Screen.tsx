// NIVL · La pantalla y su cabecera editorial.
//
// Antes cada pantalla llevaba una fila con el título en mayúsculas espaciadas y
// debajo una pila de cajas. Ahora la cabecera es la protagonista: un rótulo
// pequeño (eyebrow), un título grande con tracking negativo, una línea de
// contexto y, si hace falta, una acción a la derecha. Es la misma gramática que
// la web y la app de Franky.

import Ionicons from '@expo/vector-icons/Ionicons';
import type { Router } from 'expo-router';
import { createContext, type ReactNode } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ink, space, stroke } from '@/design/tokens';
import { ANCHO_ASIDE, cabeAside, marcoDe } from '@/design/responsive';
import { useAnchoUtil } from '@/design/useSizeClass';
import { colors, fonts } from '@/lib/theme';

/**
 * Volver atrás sin quedarse en blanco: en la web (recarga, enlace directo) o
 * tras una notificación no hay historial y `router.back()` no hace nada.
 * Entonces se va a las pestañas.
 */
export function volver(router: Pick<Router, 'canGoBack' | 'back' | 'replace'>): void {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)');
}

interface ScreenProps extends Omit<ScrollViewProps, 'style' | 'contentContainerStyle'> {
  /** Sin scroll: la pantalla gestiona su propio contenido (chat, listas largas). */
  plain?: boolean;
  /**
   * Solo con `plain`: ocupa todo el ancho, sin la columna centrada (mapas,
   * tablas, lo que necesite el lienzo entero).
   */
  wide?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Se aplica al final: gana a los márgenes del marco. */
  contentStyle?: StyleProp<ViewStyle>;
  /**
   * Panel contextual (coach, rango, amigos). Solo se pinta en `expanded` y si
   * al contenido le quedan al menos 560 + 2·32 tras la columna de 320 (con un
   * hairline a la izquierda). Si no cabe, o en `compact` y `medium`, no
   * existe: lo esencial tiene que estar en el cuerpo.
   */
  aside?: ReactNode;
  /**
   * Lo que flota SOBRE la pantalla y no debe irse con el scroll: el aviso de
   * XP, una celebración. Se pinta como hermano del ScrollView; dentro de él,
   * un `position: 'absolute'` se ancla al contenido y, con la lista desplazada,
   * queda fuera de la vista.
   */
  overlay?: ReactNode;
  children: ReactNode;
}

/** Margen lateral cuando la pantalla traía panel pero no le cabe. */
const MARGEN_SIN_PANEL = space.s8;

/**
 * Margen lateral que `Screen` aplica de verdad a su cuerpo (20 · 32 · 48, o el
 * de 32 si el panel no cabe). Lo leen las piezas que van a sangre (ASangre,
 * HeroRango) para salir hasta el borde con un margen negativo exacto. Con
 * `plain` vale 0: esas pantallas ponen su propio margen y Screen no añade nada.
 * Fuera de una Screen, 20 (el del móvil).
 */
export const GutterContext = createContext<number>(20);

/**
 * La pantalla se recoloca en caliente (rotación, ventanas de iPadOS, la web):
 * el margen y el ancho máximo salen de la clase de tamaño de `useSizeClass`.
 * El contenido es una columna centrada de `maxContent` más sus márgenes.
 */
export function Screen({ plain, wide, refreshing, onRefresh, style, contentStyle, aside, overlay, children, ...rest }: ScreenProps) {
  // El ancho útil es el hueco real (dentro de las pestañas, la ventana menos el
  // raíl o la barra lateral: lo publica (tabs)/_layout.tsx en TopeAncho).
  const ancho = useAnchoUtil();
  const marco = marcoDe(ancho);
  const conAside = aside != null && cabeAside(ancho);
  // Si había panel pero no cabe, el contenido usa el margen medio de 32.
  const gutter = aside != null && !conAside && marco.sizeClass === 'expanded' ? MARGEN_SIN_PANEL : marco.gutter;
  const { maxContent } = marco;
  const columna: ViewStyle = { width: '100%', maxWidth: maxContent + 2 * gutter, alignSelf: 'center' };

  // `plain` no recibe margen lateral: esas pantallas (coach, diario) ya llevan
  // el suyo y se duplicaría. Sí se centran y se acotan.
  const cuerpo = plain ? (
    <View style={[styles.flex, !wide && columna, contentStyle]}>
      <GutterContext.Provider value={0}>{children}</GutterContext.Provider>
    </View>
  ) : (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, columna, { paddingHorizontal: gutter }, contentStyle]}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        ) : undefined
      }
      {...rest}
    >
      <GutterContext.Provider value={gutter}>{children}</GutterContext.Provider>
    </ScrollView>
  );

  return (
    // Arriba y a los lados: en horizontal la isla o el notch quedan a un lado.
    // Junto al raíl o la barra lateral el inset izquierdo ya es 0.
    <SafeAreaView style={[styles.screen, style]} edges={['top', 'left', 'right']}>
      {conAside ? (
        <View style={styles.fila}>
          <View style={styles.flex}>{cuerpo}</View>
          <View style={styles.aside}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.asideContent}>
              {aside}
            </ScrollView>
          </View>
        </View>
      ) : (
        cuerpo
      )}
      {/* El overlay es hijo absoluto del SafeAreaView: con `top` explícito se
          mide desde el borde del padding (Yoga y la web), no desde debajo de la
          safe area. Por eso Toast suma él el inset superior. */}
      {overlay}
    </SafeAreaView>
  );
}

interface HeaderAction {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  /** Botón sólido (blanco) en vez de solo icono. */
  solid?: boolean;
}

interface ScreenHeaderProps {
  /** Rótulo pequeño encima del título: fecha, sección, contexto. */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: HeaderAction;
  /** Volver atrás (pantallas fuera de las pestañas). */
  onBack?: () => void;
  /** Contenido a la derecha cuando no basta un botón (un contador, un anillo). */
  right?: ReactNode;
  /** Título compacto para pantallas densas. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ScreenHeader({ eyebrow, title, subtitle, action, onBack, right, compact, style }: ScreenHeaderProps) {
  return (
    <View style={[styles.header, style]}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={12}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>
      ) : null}
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
        {action ? (
          <Pressable
            onPress={action.onPress}
            hitSlop={8}
            style={({ pressed }) => [styles.action, action.solid && styles.actionSolid, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <Ionicons name={action.icon} size={20} color={action.solid ? colors.bg : colors.text} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Rótulo pequeño en mayúsculas: abre secciones y cabeceras. */
export function Eyebrow({ children, tone = 'dim', style }: { children: ReactNode; tone?: 'dim' | 'accent' | 'gold' | 'red' | 'steel'; style?: StyleProp<ViewStyle> }) {
  const color =
    tone === 'accent' ? colors.accentText : tone === 'gold' ? colors.gold : tone === 'red' ? colors.red : tone === 'steel' ? colors.steel : colors.textFaint;
  return <Text style={[styles.eyebrow, { color }, style as never]}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  fila: { flex: 1, flexDirection: 'row' },
  content: { paddingTop: 8, paddingBottom: 40 },
  aside: { width: ANCHO_ASIDE, borderLeftWidth: stroke.hairline, borderLeftColor: ink.ink3 },
  asideContent: { padding: space.s6, paddingBottom: space.s10 },
  header: { marginBottom: 18 },
  back: { alignSelf: 'flex-start', marginBottom: 12, marginLeft: -4, padding: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  headerText: { flex: 1, minWidth: 0 },
  right: { alignItems: 'flex-end' },
  eyebrow: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: colors.textFaint,
    marginBottom: 6,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.8,
    color: colors.text,
  },
  titleCompact: { fontSize: 22, lineHeight: 26, letterSpacing: -0.4 },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textDim,
    marginTop: 6,
  },
  action: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  actionSolid: { backgroundColor: colors.accent, borderColor: colors.accent },
  pressed: { opacity: 0.7 },
});

// NIVL · La pantalla y su cabecera editorial.
//
// Antes cada pantalla llevaba una fila con el título en mayúsculas espaciadas y
// debajo una pila de cajas. Ahora la cabecera es la protagonista: un rótulo
// pequeño (eyebrow), un título grande con tracking negativo, una línea de
// contexto y, si hace falta, una acción a la derecha. Es la misma gramática que
// la web y la app de Franky.

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
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
import { colors, fonts } from '@/lib/theme';

interface ScreenProps extends Omit<ScrollViewProps, 'style' | 'contentContainerStyle'> {
  /** Sin scroll: la pantalla gestiona su propio contenido (chat, listas largas). */
  plain?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /**
   * Lo que flota SOBRE la pantalla y no debe irse con el scroll: el aviso de
   * XP, una celebración. Se pinta como hermano del ScrollView; dentro de él,
   * un `position: 'absolute'` se ancla al contenido y, con la lista desplazada,
   * queda fuera de la vista.
   */
  overlay?: ReactNode;
  children: ReactNode;
}

export function Screen({ plain, refreshing, onRefresh, style, contentStyle, overlay, children, ...rest }: ScreenProps) {
  if (plain) {
    return (
      <SafeAreaView style={[styles.screen, style]} edges={['top']}>
        {children}
        {overlay}
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={[styles.screen, style]} edges={['top']}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, contentStyle]}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          ) : undefined
        }
        {...rest}
      >
        {children}
      </ScrollView>
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
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
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

// NIVL · Sección editorial: un rótulo, opcionalmente un dato o una acción a la
// derecha, y debajo el contenido SIN caja. La caja (Card) se reserva para lo
// que de verdad es una unidad: una misión, una campaña, un aviso.
//
// Tono (SISTEMA.md §5): sin color. El significado va en la regla que sigue al
// rótulo hasta el borde:
//   · default → hairline de vidrio.
//   · alerta  → banda de trama (rayado ink6). Sustituye al antiguo 'red'.
//   · logro   → hilo de oro. Sustituye al antiguo 'gold'.
// Se aceptan los valores viejos para que la migración sea mecánica.

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { ink, oro, space, stroke, type as tipo, vidrio } from '@/design/tokens';
import { Trama } from './Texture';

export type SectionTone =
  | 'default'
  | 'alerta'
  | 'logro'
  /** @deprecated Usa 'default'. */
  | 'dim'
  /** @deprecated Usa 'default'. */
  | 'accent'
  /** @deprecated Usa 'default'. */
  | 'steel'
  /** @deprecated Usa 'logro'. */
  | 'gold'
  /** @deprecated Usa 'alerta'. */
  | 'red';

type ToneV2 = 'default' | 'alerta' | 'logro';

/** Tono v2 de un valor viejo o nuevo: red → alerta, gold → logro, el resto → default. */
export function toneV2(tone: SectionTone | undefined): ToneV2 {
  if (tone === 'red' || tone === 'alerta') return 'alerta';
  if (tone === 'gold' || tone === 'logro') return 'logro';
  return 'default';
}

interface Props {
  title: string;
  /** Dato a la derecha del rótulo: "2/6", "12 días". */
  meta?: string;
  /** Acción a la derecha: "Ver todo", "Editar". */
  action?: { label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap };
  tone?: SectionTone;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/** Alto de la banda de trama que sigue al rótulo en alerta. */
const BANDA = 6;

export function Section({ title, meta, action, tone, style, children }: Props) {
  const t = toneV2(tone);
  return (
    <View style={[styles.section, style]}>
      <View style={styles.head}>
        <Text
          maxFontSizeMultiplier={1.35}
          accessibilityRole="header"
          style={[styles.title, t === 'alerta' && styles.titleMarcado, t === 'logro' && styles.titleOro]}
          numberOfLines={2}
        >
          {title}
        </Text>
        <View style={styles.reglaZona} accessible={false} importantForAccessibility="no-hide-descendants">
          {t === 'alerta' ? (
            <View style={styles.banda}>
              <Trama color={ink.ink6} />
            </View>
          ) : (
            <View style={[styles.regla, t === 'logro' && styles.reglaOro]} />
          )}
        </View>
        {meta ? (
          <Text maxFontSizeMultiplier={1.35} style={styles.meta}>
            {meta}
          </Text>
        ) : null}
        {action ? (
          <Pressable
            onPress={action.onPress}
            hitSlop={12}
            style={styles.action}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <Text maxFontSizeMultiplier={1.35} style={styles.actionText}>
              {action.label}
            </Text>
            <Ionicons name={action.icon ?? 'chevron-forward'} size={13} color={ink.ink9} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Separador fino entre bloques de una misma sección. */
export function Rule({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.rule, style]} />;
}

const styles = StyleSheet.create({
  section: { marginBottom: 26 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    marginBottom: space.s3,
  },
  title: {
    flexShrink: 1,
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink8,
  },
  titleMarcado: { color: ink.ink9 },
  titleOro: { color: oro.claro },
  reglaZona: { flexGrow: 1, flexShrink: 0, flexBasis: space.s6, justifyContent: 'center' },
  regla: { height: stroke.hairline, backgroundColor: vidrio.linea },
  reglaOro: { backgroundColor: oro.borde },
  banda: { height: BANDA, overflow: 'hidden' },
  meta: { fontFamily: tipo.number.family, fontSize: 13, color: ink.ink9 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 24 },
  actionText: { fontFamily: tipo.micro.family, fontSize: tipo.label.size, color: ink.ink9 },
  rule: { height: stroke.hairline, backgroundColor: vidrio.linea },
});

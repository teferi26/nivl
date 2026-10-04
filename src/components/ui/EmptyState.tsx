// NIVL · Estado vacío: un icono suelto, un título, una frase y el camino.
// Nunca un párrafo de disculpa dentro de una caja.
//
// v2 (SISTEMA §6): icono ink6, título `headline` ink9, cuerpo `bodySm` ink8
// (14, legible) y la acción en Button `secondary` sm: no gasta la inversión
// de la pantalla. `variant: 'solid'` la pide expresamente (primary).

import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { ink, space, type as tipo } from '@/design/tokens';
import { Button } from './Button';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void; variant?: 'solid' | 'outline' };
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({ icon, title, body, action, compact, style }: Props) {
  return (
    <View style={[styles.wrap, compact && styles.compact, style]}>
      <Ionicons name={icon} size={compact ? 22 : 30} color={ink.ink6} accessibilityElementsHidden importantForAccessibility="no" />
      <Text style={[styles.title, compact && styles.titleCompact]} accessibilityRole="header">
        {title}
      </Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {action ? (
        <Button
          title={action.label}
          onPress={action.onPress}
          variant={action.variant === 'solid' ? 'primary' : 'secondary'}
          size="sm"
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: space.s4 },
  compact: { paddingVertical: space.s5 },
  title: {
    fontFamily: tipo.headline.family,
    fontSize: tipo.headline.size,
    lineHeight: tipo.headline.lineHeight,
    letterSpacing: tipo.headline.tracking,
    color: ink.ink9,
    textAlign: 'center',
    marginTop: space.s3,
  },
  titleCompact: { fontSize: 17, lineHeight: 22, marginTop: space.s2 },
  body: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 320,
  },
  action: { marginTop: space.s4, alignSelf: 'center' },
});

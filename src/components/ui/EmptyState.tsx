// NIVL · Estado vacío: un icono suelto, un título, una frase y el camino.
// Nunca un párrafo de disculpa dentro de una caja.

import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SystemButton } from '@/components/SystemButton';
import { colors, fonts } from '@/lib/theme';

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
      <Ionicons name={icon} size={compact ? 22 : 30} color={colors.accentDim} />
      <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {action ? (
        <SystemButton
          title={action.label}
          onPress={action.onPress}
          variant={action.variant ?? 'outline'}
          size="sm"
          style={{ marginTop: 16, alignSelf: 'center' }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 16 },
  compact: { paddingVertical: 20 },
  title: {
    fontFamily: fonts.heading,
    fontSize: 17,
    letterSpacing: -0.2,
    color: colors.text,
    textAlign: 'center',
    marginTop: 12,
  },
  titleCompact: { fontSize: 15, marginTop: 8 },
  body: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 300,
  },
});

// NIVL · Aviso de Amigos (SISTEMA §5): un error va con marco de trama ink6 de
// 3 pt alrededor de una placa ink1 —el texto nunca encima del rayado— y se
// anuncia al lector de pantalla. Lo que no es error es una línea tranquila.

import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Trama } from '@/components/ui';
import { ink } from '@/design/tokens';
import { fonts } from '@/lib/theme';

export function Aviso({ texto, error, style }: { texto: string; error?: boolean; style?: StyleProp<ViewStyle> }) {
  if (!error) {
    return (
      <Text style={[styles.linea, style as StyleProp<TextStyle>]} accessibilityLiveRegion="polite">
        {texto}
      </Text>
    );
  }
  return (
    <View style={[styles.marco, style]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Trama color={ink.ink6} />
      <View style={styles.placa}>
        <Text style={styles.textoError}>{texto}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  linea: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: ink.ink8, marginTop: 10 },
  marco: { marginTop: 10, padding: 3, backgroundColor: ink.ink0, overflow: 'hidden' },
  placa: { backgroundColor: ink.ink1, paddingHorizontal: 12, paddingVertical: 10 },
  textoError: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: ink.ink9 },
});

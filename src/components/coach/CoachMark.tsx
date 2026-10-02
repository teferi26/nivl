// NIVL · La marca del coach (L4, A1): la galea en negro dentro de un círculo
// blanco. Es decoración: el texto de al lado ya dice quién habla, así que el
// lector de pantalla la salta.

import { StyleSheet, View } from 'react-native';
import { Crown } from '@/components/ui';
import { ink } from '@/design/tokens';

export type CoachMarkSize = 16 | 24 | 48;

/** El casco ocupa algo más de la mitad del círculo: se lee sin tocar el borde. */
const CASCO: Record<CoachMarkSize, number> = { 16: 11, 24: 16, 48: 30 };

export function CoachMark({ size }: { size: CoachMarkSize }) {
  return (
    <View
      style={[styles.circulo, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Crown kind="casco" size={CASCO[size]} color={ink.ink0} />
    </View>
  );
}

const styles = StyleSheet.create({
  circulo: { backgroundColor: ink.ink10, alignItems: 'center', justifyContent: 'center' },
});

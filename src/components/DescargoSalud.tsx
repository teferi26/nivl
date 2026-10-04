// NIVL · El descargo de salud (Guideline 1.4.1), al pie de las pantallas de
// cuerpo: gimnasio, cardio, nutrición y dieta. Una línea, sin alarma.

import { StyleSheet, Text } from 'react-native';
import { DESCARGO_SALUD } from '@/lib/consentmath';
import { ink, type as tipo } from '@/design/tokens';

export function DescargoSalud() {
  return <Text style={styles.texto} maxFontSizeMultiplier={1.6}>{DESCARGO_SALUD}</Text>;
}

const styles = StyleSheet.create({
  texto: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink6, marginTop: 8, marginBottom: 8 },
});

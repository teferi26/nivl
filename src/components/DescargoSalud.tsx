// NIVL · El descargo de salud (Guideline 1.4.1), al pie de las pantallas de
// cuerpo: gimnasio, cardio, nutrición y dieta. Una línea, sin alarma.

import { StyleSheet, Text } from 'react-native';
import { DESCARGO_SALUD } from '@/lib/consentmath';
import { colors, fonts } from '@/lib/theme';

export function DescargoSalud() {
  return <Text style={styles.texto}>{DESCARGO_SALUD}</Text>;
}

const styles = StyleSheet.create({
  texto: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textFaint, marginTop: 8, marginBottom: 8 },
});

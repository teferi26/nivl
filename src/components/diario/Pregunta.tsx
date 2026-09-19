// NIVL · Diario — una pregunta del cierre del día.
//
// El fallo del diario viejo era no saber qué iba en cada caja. Aquí cada
// sección es UNA pregunta con su número romano: la estructura se lee de un
// vistazo (I · cómo me sentí, II · cómo dormí…) y una marca discreta dice
// cuáles están ya respondidas. Ninguna es obligatoria.

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/lib/theme';

interface Props {
  /** "I", "II"… Cinzel no tiene minúsculas: los romanos le sientan bien. */
  numeral: string;
  title: string;
  /** Una línea que dice qué se espera ahí. */
  hint?: string;
  /** Respondida: enciende el rótulo y pinta la marca. */
  done?: boolean;
  children: ReactNode;
}

export function Pregunta({ numeral, title, hint, done, children }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.head} accessibilityRole="header" accessible accessibilityLabel={`${title}${done ? ', respondida' : ''}`}>
        <Text style={[styles.numeral, done && styles.encendido]}>{numeral}</Text>
        <View style={styles.raya} />
        <Text style={[styles.title, done && styles.encendido]} numberOfLines={1}>
          {title}
        </Text>
        {done ? <Ionicons name="checkmark" size={14} color={colors.accentText} /> : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 30 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  numeral: { fontFamily: fonts.number, fontSize: 13, letterSpacing: 1, color: colors.textFaint, minWidth: 18 },
  raya: { width: 10, height: 1, backgroundColor: colors.accentDim },
  title: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.heading,
    fontSize: 11.5,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  encendido: { color: colors.accentText },
  hint: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textDim, marginBottom: 12 },
});

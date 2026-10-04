// NIVL · Diario: una pregunta del cierre del día (FASE3 Lote D).
//
// Cada sección es UNA pregunta con su número romano grabado en una columna de
// 48: la estructura se lee de un vistazo (I · cómo me sentí, II · cómo
// dormí...). Respondida, el numeral pasa a ink10 con una regla de 2 debajo;
// sin responder, ink6. El título en headline, la pista en bodySm ink8 y, entre
// pregunta y pregunta, una hairline: nada de tarjetas. Ninguna es obligatoria.

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ink, space, stroke, type as tipo } from '@/design/tokens';

interface Props {
  /** "I", "II"... Cinzel no tiene minúsculas: los romanos le sientan bien. */
  numeral: string;
  title: string;
  /** Una línea que dice qué se espera ahí. */
  hint?: string;
  /** Respondida: enciende el numeral y pinta su regla. */
  done?: boolean;
  /** La primera no lleva hairline encima. */
  primera?: boolean;
  children: ReactNode;
}

/** Ancho de la columna del numeral. */
export const COL_NUMERAL = 48;

export function Pregunta({ numeral, title, hint, done, primera, children }: Props) {
  return (
    <View style={[styles.wrap, !primera && styles.conRegla]}>
      <View style={styles.cabeza}>
        <View style={styles.col} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {/* Sin numberOfLines: en la web no hay adjustsFontSizeToFit y «VIII» se cortaba en «VI…». */}
          <Text style={[styles.numeral, done && styles.encendido]} maxFontSizeMultiplier={1}>
            {numeral}
          </Text>
          <View style={[styles.regla, done && styles.reglaOn]} />
        </View>
        <View style={styles.textos}>
          <Text
            style={styles.title}
            accessibilityRole="header"
            accessibilityLabel={`${numeral}. ${title}${done ? ', respondida' : ''}`}
            maxFontSizeMultiplier={1.35}
          >
            {title}
          </Text>
          {hint ? (
            <Text style={styles.hint} maxFontSizeMultiplier={1.6}>
              {hint}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.cuerpo}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: space.s6 },
  conRegla: { borderTopWidth: stroke.hairline, borderTopColor: ink.ink3 },
  cabeza: { flexDirection: 'row', alignItems: 'flex-start' },
  col: { width: COL_NUMERAL, paddingTop: 2 },
  numeral: {
    fontFamily: tipo.number.family,
    // 18 y sin tracking: «VIII», el más ancho, cabe en la columna de 48.
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: 0,
    color: ink.ink6,
    alignSelf: 'flex-start',
  },
  encendido: { color: ink.ink10 },
  // Sin responder no hay regla, pero el hueco se guarda: el título no salta.
  regla: { width: 20, height: stroke.rule, marginTop: space.s1, backgroundColor: 'transparent' },
  reglaOn: { backgroundColor: ink.ink10 },
  textos: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: tipo.headline.family,
    fontSize: tipo.headline.size,
    lineHeight: tipo.headline.lineHeight,
    letterSpacing: tipo.headline.tracking,
    color: ink.ink9,
  },
  hint: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    marginTop: space.s1,
  },
  // El cuerpo va bajo el título, alineado con él (no bajo el numeral).
  cuerpo: { marginTop: space.s4, marginLeft: COL_NUMERAL },
});

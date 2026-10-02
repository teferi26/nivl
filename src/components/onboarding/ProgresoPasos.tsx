// NIVL · Onboarding: el progreso por pasos (L-RADICAL §B.5).
//
// Sustituye a los puntos: una barra de 4 pt cortada en tantos segmentos como
// pasos, y encima «PASO III DE VII» en romanos, como la numeración de una
// inscripción. Al lector le llega un solo elemento: «Paso 3 de 7».

import { StyleSheet, Text, View } from 'react-native';
import { Barra, romano } from '@/components/arena';
import { ink, space, type as tipo } from '@/design/tokens';

export interface ProgresoPasosProps {
  /** Paso actual, de 1 a `total`. */
  paso: number;
  total: number;
}

export function ProgresoPasos({ paso, total }: ProgresoPasosProps) {
  const n = Math.max(1, Math.floor(total));
  const actual = Math.min(Math.max(1, Math.floor(paso)), n);
  const etiqueta = `Paso ${actual} de ${n}`;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={etiqueta}
      accessibilityValue={{ min: 1, max: n, now: actual }}
      style={styles.wrap}
    >
      <Text style={styles.texto} maxFontSizeMultiplier={1.35} numberOfLines={1}>
        PASO {romano(actual)} DE {romano(n)}
      </Text>
      <Barra ratio={actual / n} alto={4} segmentos={n} etiqueta={etiqueta} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.s2 },
  texto: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    color: ink.ink6,
  },
});

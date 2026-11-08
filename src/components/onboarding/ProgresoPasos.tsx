// NIVL · Onboarding: el progreso por pasos (L-RADICAL §B.5).
//
// Sustituye a los puntos: una barra de 4 pt cortada en tantos segmentos como
// pasos, y encima «PASO III DE VII» en romanos, como la numeración de una
// inscripción. Al lector le llega un solo elemento: «Paso 3 de 7».

import { StyleSheet, Text, View } from 'react-native';
import { Barra } from '@/components/arena';
import { ink, oro, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { mayus } from '@/i18n/formato';

export interface ProgresoPasosProps {
  /** Paso actual, de 1 a `total`. */
  paso: number;
  total: number;
}

export function ProgresoPasos({ paso, total }: ProgresoPasosProps) {
  const n = Math.max(1, Math.floor(total));
  const actual = Math.min(Math.max(1, Math.floor(paso)), n);
  const pct = Math.round(84 + (actual / n) * 16);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('onboarding:embudo.tuPerfilA11y', { pct })}
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={styles.wrap}
    >
      <View style={styles.fila}>
        <Text style={styles.texto} maxFontSizeMultiplier={1.35} numberOfLines={1}>
          {mayus(t('onboarding:embudo.tuPerfil'))}
        </Text>
        <Text style={styles.pct} maxFontSizeMultiplier={1.35}>{pct} %</Text>
      </View>
      <Barra ratio={pct / 100} alto={8} etiqueta={t('onboarding:embudo.tuPerfilA11y', { pct })} enGrupo />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.s2 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  texto: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    color: ink.ink8,
  },
  pct: { fontFamily: tipo.number.family, fontSize: 20, lineHeight: 26, color: oro.claro },
});

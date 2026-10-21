// NIVL · Mundo IRON: el coach por fuera. El chat es el mismo de NIVL (no se
// toca por dentro); IRON le pone su marco: el fondo con el brillo del acento,
// la franja «COACH IRON · ● EN LÍNEA» con la mancuerna en el círculo del
// acento (la tarjeta de la lámina 2) y su piel para botones, chips y campos.

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '@/i18n';
import { PielIron } from './piel';
import { AvatarIron, FondoIron } from './piezas';
import { A, C, F, fs, M, px } from './tema';

export function CoachIronMarco({ children }: { children: ReactNode }) {
  return (
    <View style={styles.lleno}>
      <FondoIron />
      <SafeAreaView edges={['top', 'left', 'right']}>
        <View style={styles.franja} accessible accessibilityRole="header" accessibilityLabel={t('ironmundo:coach.marcoA11y')}>
          <AvatarIron lado={px(34)} />
          <View style={styles.textos}>
            <Text style={styles.nombre} maxFontSizeMultiplier={1.2}>
              {t('ironmundo:coach.rotulo').toUpperCase()}
            </Text>
            <Text style={styles.sub} numberOfLines={1} maxFontSizeMultiplier={1.35}>
              {t('ironmundo:coach.marcoSub')}
            </Text>
          </View>
          <Text style={styles.enLinea} maxFontSizeMultiplier={1.2}>
            {t('ironmundo:coach.enLinea').toUpperCase()}
          </Text>
        </View>
      </SafeAreaView>
      <View style={styles.lleno}>
        <PielIron cubreArriba>{children}</PielIron>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lleno: { flex: 1, backgroundColor: 'transparent' },
  franja: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: px(10),
    marginHorizontal: M.margen,
    marginTop: px(4),
    marginBottom: px(2),
    paddingVertical: px(9),
    paddingHorizontal: px(12),
    borderRadius: M.radio,
    borderWidth: 1,
    borderColor: C.filete,
    backgroundColor: C.tarjeta,
  },
  textos: { flex: 1, minWidth: 0 },
  nombre: { fontFamily: F.cinzel, fontSize: fs(15), letterSpacing: fs(15) * 0.08, color: C.blanco },
  sub: { fontFamily: F.r, fontSize: fs(9.5), color: C.mudo, marginTop: px(1) },
  enLinea: { fontFamily: F.b, fontSize: fs(8.5), letterSpacing: fs(8.5) * 0.1, color: A },
});

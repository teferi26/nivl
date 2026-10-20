// NIVL · Modos: el glifo de cada modo (dentro del emblema y en la recarga).
//
// NIVL es el escudo con la N; los modos, un icono de trazo: IRON la barra,
// FOCUS la diana, WORK el maletín y FOUNDER el cohete. Decorativo: el lector
// lee el nombre del modo en el contenedor.

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type as tipo } from '@/design/tokens';
import type { ModoId } from '@/modos/tipos';

type Icono = ComponentProps<typeof Ionicons>['name'];

const ICONO: Record<ModoId, Icono> = {
  general: 'shield-outline',
  iron: 'barbell-outline',
  focus: 'locate-outline',
  work: 'briefcase-outline',
  founder: 'rocket-outline',
};

export function GlifoModo({ modo, tamano, color }: { modo: ModoId; tamano: number; color: string }) {
  return (
    <View
      style={[styles.caja, { width: tamano, height: tamano }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Ionicons name={ICONO[modo]} size={tamano} color={color} />
      {modo === 'general' ? (
        <View style={styles.centro} pointerEvents="none">
          <Text
            maxFontSizeMultiplier={1}
            style={[styles.n, { color, fontSize: Math.round(tamano * 0.4), lineHeight: Math.round(tamano * 0.46), marginTop: -tamano * 0.06 }]}
          >
            {'N' /* i18n-ok: la N del escudo es marca */}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { alignItems: 'center', justifyContent: 'center' },
  centro: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  n: { fontFamily: tipo.rank.family, textAlign: 'center' },
});

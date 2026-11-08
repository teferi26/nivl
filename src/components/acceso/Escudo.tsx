// NIVL · Acceso: el escudo con la N, la única imagen de las pantallas de
// entrada (Ónix). La N es texto de React Native y no de SVG: las fuentes
// cargadas con expo-font no llegan igual al SVG en todas las plataformas.
// Es adorno: la marca la dice el texto «NIVL» que lo acompaña.

import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ink, oro, type as tipo } from '@/design/tokens';

const ANCHO_LIENZO = 120;
const ALTO_LIENZO = 138;
/** Cuerpo de la N respecto al ancho del escudo. */
const PROPORCION_N = 56 / ANCHO_LIENZO;

export function Escudo({ ancho = 104 }: { ancho?: number }) {
  const alto = Math.round((ancho * ALTO_LIENZO) / ANCHO_LIENZO);
  const cuerpo = Math.round(ancho * PROPORCION_N);
  return (
    <View
      style={{ width: ancho, height: alto }}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={ancho} height={alto} viewBox={`0 0 ${ANCHO_LIENZO} ${ALTO_LIENZO}`}>
        <Path
          d="M60 4 L114 20 V62 C114 100 88 122 60 134 C32 122 6 100 6 62 V20 Z"
          fill={ink.ink1}
          stroke={oro.hilo}
          strokeWidth={3}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.centro]}>
        <Text style={[styles.letra, { fontSize: cuerpo, lineHeight: Math.round(cuerpo * 1.25) }]} maxFontSizeMultiplier={1}>{/* i18n-ok: la inicial de la marca */}
          N
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { alignItems: 'center', justifyContent: 'center' },
  letra: { fontFamily: tipo.display.family, color: oro.claro },
});

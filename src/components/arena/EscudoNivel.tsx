// NIVL · Arena: el escudo de Ónix con el nivel dentro. Lo comparten el Hero
// del rango y la cabecera de la base. Es decorado: el nivel lo lee el bloque
// que lo contiene.

import type { ReactNode } from 'react';
import { StyleSheet, View, type TextStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ink, oro, type as tipo } from '@/design/tokens';

const TRAZADO = 'M60 4 L114 20 V62 C114 100 88 122 60 134 C32 122 6 100 6 62 V20 Z';
const VB_ANCHO = 120;
const VB_ALTO = 138;

/** El número del nivel a la medida del escudo: con tres cifras, más pequeño. */
export function estiloNivelEscudo(lado: number, nivel: number | string): TextStyle {
  const fontSize = Math.round(lado * (String(nivel).length > 2 ? 0.34 : 0.47));
  return { fontFamily: tipo.number.family, fontSize, lineHeight: Math.round(fontSize * 1.25), color: oro.claro, textAlign: 'center' };
}

export function EscudoNivel({ lado = 62, children }: { lado?: number; children: ReactNode }) {
  const alto = (lado * VB_ALTO) / VB_ANCHO;
  return (
    <View style={{ width: lado, height: alto }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={lado} height={alto} viewBox={`0 0 ${VB_ANCHO} ${VB_ALTO}`}>
        <Path d={TRAZADO} fill={ink.ink1} stroke={oro.hilo} strokeWidth={3} strokeLinejoin="round" />
      </Svg>
      <View style={styles.dentro}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  dentro: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});

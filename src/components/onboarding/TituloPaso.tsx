// NIVL · Onboarding: el título de un paso (L-RADICAL §B.5).
//
// Una inscripción grabada encima («EL NOMBRE», en Cinzel) y la pregunta en
// Outfit grande debajo: la piedra dice dónde estás, la voz pregunta. Debajo,
// si hace falta, la explicación en ink8.

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ink, space, type as tipo } from '@/design/tokens';

export interface TituloPasoProps {
  /** Rótulo grabado, en mayúsculas: «EL NOMBRE». */
  inscripcion: string;
  titulo: string;
  /** Explicación bajo el título (texto o nodos). */
  pista?: ReactNode;
}

export function TituloPaso({ inscripcion, titulo, pista }: TituloPasoProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.inscripcion} maxFontSizeMultiplier={1.35} numberOfLines={1}>
        {inscripcion.toUpperCase()}
      </Text>
      <Text style={styles.titulo} accessibilityRole="header" maxFontSizeMultiplier={1.35}>
        {titulo}
      </Text>
      {pista ? (
        <Text style={styles.pista} maxFontSizeMultiplier={1.35}>
          {pista}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: space.s5 },
  inscripcion: {
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    lineHeight: tipo.inscripcion.lineHeight,
    letterSpacing: tipo.inscripcion.tracking,
    // El tracking también se suma tras la última letra: se compensa para centrar.
    marginRight: -tipo.inscripcion.tracking,
    color: ink.ink6,
    textAlign: 'center',
    marginBottom: space.s3,
  },
  titulo: {
    fontFamily: tipo.title.family,
    fontSize: tipo.title.size,
    lineHeight: tipo.title.lineHeight,
    letterSpacing: tipo.title.tracking,
    color: ink.ink10,
    textAlign: 'center',
  },
  pista: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    textAlign: 'center',
    marginTop: space.s3,
  },
});

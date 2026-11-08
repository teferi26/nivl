// NIVL · Modos F1: las etiquetas de modo de una misión (selección múltiple, pura).
//
// Una fila de casillas con forma de chip: marco de vidrio; marcada, marco y velo
// de oro con un punto lleno a la izquierda. La misión se marca
// una vez y cuenta en todos los modos que lleve. Sin ninguna, solo en General.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { vibrar } from '@/design/haptics';
import { ink, modoAcento, oro, radio, space, stroke, type as tipo, vidrio } from '@/design/tokens';
import { t } from '@/i18n';
import { alternarModo, NOMBRE_MODO, type ModoEtiqueta } from '@/modos/tipos';

export interface EtiquetasModoProps {
  valor: readonly ModoEtiqueta[];
  opciones: readonly ModoEtiqueta[];
  alCambiar: (modos: ModoEtiqueta[]) => void;
}

export function EtiquetasModo({ valor, opciones, alCambiar }: EtiquetasModoProps) {
  return (
    <View style={styles.fila}>
      {opciones.map((m) => {
        const on = valor.includes(m);
        return (
          <Pressable
            key={m}
            onPress={() => {
              vibrar('seleccion');
              alCambiar(alternarModo(valor, m));
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={t('modos:form.a11y', { modo: NOMBRE_MODO[m] })}
            style={({ pressed }) => [styles.etiqueta, on && styles.etiquetaOn, pressed && styles.pulsada]}
          >
            <View style={[styles.marca, on && { backgroundColor: modoAcento[m], borderColor: modoAcento[m] }]} />
            <Text style={[styles.texto, on && styles.textoOn]} maxFontSizeMultiplier={1.35}>
              {NOMBRE_MODO[m]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
  etiqueta: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    paddingHorizontal: space.s3,
    borderWidth: stroke.hairline,
    borderColor: vidrio.borde,
    borderRadius: radio.chip,
    backgroundColor: vidrio.suave,
  },
  etiquetaOn: { borderColor: oro.borde, backgroundColor: oro.tenue },
  pulsada: { opacity: 0.7 },
  marca: { width: 10, height: 10, borderRadius: radio.pastilla, borderWidth: stroke.hairline, borderColor: ink.ink6 },
  texto: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    color: ink.ink8,
  },
  textoOn: { color: ink.ink10 },
});

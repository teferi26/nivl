// NIVL · Selector de idioma. STUB del equipo cliente (Modos F1): la pieza de
// verdad es del equipo idiomas y respeta esta misma firma (contrato
// MODOS-F1: `{ valor: string; alCambiar: (lng: string) => void }`). Al
// integrar, gana la suya.
//
// Una lista de opciones con el nombre de cada idioma en su propia lengua
// (NOMBRE_IDIOMA, que no se traduce). Elegido = marco de 2 en ink10, sin
// invertir: la inversión del paso es «Continuar».

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { vibrar } from '@/design/haptics';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { IDIOMAS, NOMBRE_IDIOMA } from '@/i18n';

export interface SelectorIdiomaProps {
  valor: string;
  alCambiar: (lng: string) => void;
}

export function SelectorIdioma({ valor, alCambiar }: SelectorIdiomaProps) {
  return (
    <View accessibilityRole="radiogroup" style={styles.lista}>
      {IDIOMAS.map((lng) => {
        const on = lng === valor;
        return (
          <Pressable
            key={lng}
            onPress={() => {
              if (on) return;
              vibrar('seleccion');
              alCambiar(lng);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={NOMBRE_IDIOMA[lng]}
            style={({ pressed }) => [styles.opcion, on && styles.opcionOn, pressed && !on && styles.pulsada]}
          >
            <Text style={[styles.texto, on && styles.textoOn]} maxFontSizeMultiplier={1.35}>
              {NOMBRE_IDIOMA[lng]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  lista: { gap: space.s2 },
  opcion: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: space.s4,
    borderWidth: stroke.hairline,
    borderColor: ink.ink4,
    backgroundColor: ink.ink1,
  },
  // El padding baja lo que sube el borde para que la fila no crezca al elegirla.
  opcionOn: { borderWidth: stroke.rule, borderColor: ink.ink10, paddingHorizontal: space.s4 - 1 },
  pulsada: { opacity: 0.7 },
  texto: { fontFamily: tipo.body.family, fontSize: tipo.body.size, lineHeight: tipo.body.lineHeight, color: ink.ink8 },
  textoOn: { color: ink.ink10 },
});

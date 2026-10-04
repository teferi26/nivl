// NIVL · Arena: el campo de texto (sustituye a los TextInput a mano).
//
//   · Etiqueta encima en `label` ink6 (mayúsculas grabadas pequeñas).
//   · Caja ink2 con borde ink4 de 1; con el foco, borde de 2 en ink10 (se
//     resta 1 al relleno para que no salte). Alto mínimo 48. Texto `body` ink9.
//   · `grande="rank"`: la cifra o el código en Cinzel `rank`, centrado (el
//     código de invitación, «ELIMINAR»).
//   · Error: borde discontinuo y, debajo, la frase en bodySm ink9 con un
//     icono; región viva para que el lector la oiga al aparecer. Sin rojo: el
//     error se ve por la forma y se lee por el texto.
//   · Ayuda: bodySm ink6 debajo, solo si no hay error.
//
// El resto de props van al TextInput tal cual (autoComplete, textContentType,
// secureTextEntry, onSubmitEditing...). Acepta ref para pasar al siguiente.

import Ionicons from '@expo/vector-icons/Ionicons';
import { forwardRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { ink, space, stroke, type as tipo } from '@/design/tokens';

export type CampoProps = {
  etiqueta: string;
  /** Frase del fallo. Si hay, sustituye a la ayuda. */
  error?: string | null;
  ayuda?: string;
  /** Cifra o código grande en Cinzel. */
  grande?: 'rank';
  /** Colocación del bloque entero (márgenes, flex). `style` va a la caja. */
  estiloBloque?: StyleProp<ViewStyle>;
} & TextInputProps;

const ALTO_MIN = 48;
const ALTO_RANK = 64;
const PAD_H = space.s4;
const PAD_V = space.s3;

export const Campo = forwardRef<TextInput, CampoProps>(function Campo(
  { etiqueta, error, ayuda, grande, estiloBloque, style, onFocus, onBlur, editable = true, multiline, accessibilityLabel, accessibilityHint, ...rest },
  ref,
) {
  const [foco, setFoco] = useState(false);
  const rank = grande === 'rank';
  const conError = !!error;
  // El borde de 2 come 1 de relleno por lado: la caja no cambia de tamaño.
  const borde = foco ? stroke.rule : stroke.hairline;
  const ajuste = borde - stroke.hairline;

  return (
    <View style={[styles.bloque, estiloBloque]}>
      <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
        {etiqueta}
      </Text>
      <TextInput
        ref={ref}
        editable={editable}
        multiline={multiline}
        placeholderTextColor={ink.ink6}
        selectionColor={ink.ink10}
        cursorColor={ink.ink10}
        accessibilityLabel={accessibilityLabel ?? etiqueta}
        accessibilityHint={accessibilityHint ?? (error || ayuda || undefined)}
        accessibilityState={{ disabled: !editable }}
        maxFontSizeMultiplier={rank ? 1.35 : undefined}
        onFocus={(e) => {
          setFoco(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFoco(false);
          onBlur?.(e);
        }}
        style={[
          styles.caja,
          rank ? styles.rank : styles.texto,
          multiline && styles.multilinea,
          {
            borderWidth: borde,
            paddingHorizontal: PAD_H - ajuste,
            paddingVertical: PAD_V - ajuste,
          },
          foco ? styles.foco : conError ? styles.conError : null,
          !editable && styles.apagado,
          style,
        ]}
        {...rest}
      />
      {conError ? (
        <View style={styles.linea} accessibilityLiveRegion="polite" accessibilityRole="alert">
          <Ionicons name="alert-circle-outline" size={16} color={ink.ink9} style={styles.icono} />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : ayuda ? (
        <Text style={styles.ayuda}>{ayuda}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  bloque: { gap: space.s2 },
  etiqueta: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
  caja: {
    minHeight: ALTO_MIN,
    backgroundColor: ink.ink2,
    borderColor: ink.ink4,
    borderRadius: 0,
    color: ink.ink9,
    // En la web el navegador pinta su propio anillo de foco encima del borde.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  texto: {
    fontFamily: tipo.body.family,
    fontSize: tipo.body.size,
    // Sin lineHeight en una línea: en iOS desplaza el texto hacia abajo.
  },
  rank: {
    minHeight: ALTO_RANK,
    fontFamily: tipo.rank.family,
    fontSize: tipo.rank.size,
    letterSpacing: tipo.rank.tracking,
    textAlign: 'center',
    color: ink.ink10,
  },
  multilinea: { minHeight: 96, lineHeight: tipo.body.lineHeight, textAlignVertical: 'top' },
  foco: { borderColor: ink.ink10 },
  conError: { borderColor: ink.ink8, borderStyle: 'dashed' },
  apagado: { backgroundColor: ink.ink1, color: ink.ink6 },
  linea: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s2 },
  icono: { marginTop: 2 },
  error: {
    flex: 1,
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
  },
  ayuda: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
  },
});

// NIVL · La pregunta de los 18 (L5). Se usa en la hoja de Avances y en el
// gate de /fotos. Sin trampas: «Tengo 18 o más» y «Ahora no» son el mismo
// botón (secundario, mismo tamaño, a todo el ancho). Ninguno va invertido.

import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';

export const PREGUNTA_EDAD = 'Las fotos de progreso son para mayores de 18. ¿Los tienes?';
export const NOTA_EDAD = 'Es una declaración tuya. Puedes seguir usando NIVL igual si dices que no.';

interface Props {
  onSi: () => void;
  onNo: () => void;
  ocupado?: boolean;
  error?: string | null;
  /** Sin la pregunta escrita (cuando ya la dice el título de la hoja). */
  sinPregunta?: boolean;
}

export function PreguntaEdad({ onSi, onNo, ocupado, error, sinPregunta }: Props) {
  return (
    <View style={styles.wrap}>
      {sinPregunta ? null : (
        <Text style={styles.pregunta} maxFontSizeMultiplier={1.35}>
          {PREGUNTA_EDAD}
        </Text>
      )}
      <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
        {NOTA_EDAD}
      </Text>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <View style={styles.botones}>
        <Button title="Tengo 18 o más" variant="secondary" onPress={onSi} loading={ocupado} style={styles.boton} />
        <Button title="Ahora no" variant="secondary" onPress={onNo} disabled={ocupado} style={styles.boton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.s3 },
  pregunta: {
    fontFamily: tipo.body.family,
    fontSize: tipo.body.size,
    lineHeight: tipo.body.lineHeight,
    color: ink.ink9,
  },
  nota: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink8 },
  error: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink9 },
  // Uno encima del otro y a todo el ancho: mismo tamaño aunque un rótulo sea más largo.
  botones: { gap: space.s3, marginTop: space.s1 },
  boton: { alignSelf: 'stretch' },
});

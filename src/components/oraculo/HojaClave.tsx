// NIVL · Oráculo: la hoja de la clave propia (FASE3 G1). Solo existe si
// `byokEnabled()` (la web; nunca la app de tienda). Pura: el estado vive en
// useOraculo. Campo de la clave + primary «Guardar la clave» + ghost.

import { StyleSheet, Text, View } from 'react-native';
import { Campo } from '@/components/arena';
import { Button, Sheet } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';

export interface HojaClaveProps {
  visible: boolean;
  clave: string;
  /** Ya hay una clave guardada en el dispositivo (el campo la oculta). */
  guardada: boolean;
  onClave: (v: string) => void;
  onGuardar: () => void;
  onCerrar: () => void;
}

export function HojaClave({ visible, clave, guardada, onClave, onGuardar, onCerrar }: HojaClaveProps) {
  return (
    <Sheet
      visible={visible}
      onClose={onCerrar}
      eyebrow="Clave de API"
      title="Tu propia clave"
      footer={
        <>
          <Button title="Guardar la clave" onPress={onGuardar} />
          <Button title="Cancelar" variant="ghost" onPress={onCerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        <Text style={styles.texto} maxFontSizeMultiplier={1.35}>
          OpenAI o Anthropic. Se guarda solo en este dispositivo y pagas solo tu consumo.
        </Text>
        <Campo
          etiqueta="Clave"
          value={clave}
          onChangeText={onClave}
          placeholder="sk-proj-… (OpenAI) o sk-ant-… (Anthropic)"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={guardada}
          accessibilityLabel="Clave de API"
          ayuda={
            guardada
              ? 'Hay una clave guardada. Pega otra para sustituirla, o bórrala y guarda para quitarla.'
              : 'Nunca sale del dispositivo.'
          }
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pila: { gap: space.s5 },
  texto: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
  },
});

// NIVL · Oráculo: la hoja de la clave propia (FASE3 G1). Solo existe si
// `byokEnabled()` (la web; nunca la app de tienda). Pura: el estado vive en
// useOraculo. Campo de la clave + primary «Guardar la clave» + ghost.

import { StyleSheet, Text, View } from 'react-native';
import { Campo } from '@/components/arena';
import { Button, Sheet } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';

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
      eyebrow={t('oraculo:clave.eyebrow')}
      title={t('oraculo:clave.titulo')}
      footer={
        <>
          <Button title={t('oraculo:clave.guardar')} onPress={onGuardar} />
          <Button title={t('comun:cancelar')} variant="ghost" onPress={onCerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        <Text style={styles.texto} maxFontSizeMultiplier={1.35}>
          {t('oraculo:clave.cuerpo')}
        </Text>
        <Campo
          etiqueta={t('oraculo:clave.etiqueta')}
          value={clave}
          onChangeText={onClave}
          placeholder={t('oraculo:clave.placeholder')}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={guardada}
          accessibilityLabel={t('oraculo:clave.a11y')}
          ayuda={
            guardada ? t('oraculo:clave.guardadaAyuda') : t('oraculo:clave.ayuda')
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

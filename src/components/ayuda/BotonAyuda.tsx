// NIVL · El «?» junto a un título: la variante icono de Termino.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { ink } from '@/design/tokens';
import { t } from '@/i18n';
import type { TerminoId } from '@/lib/glosario';
import { tituloTermino } from './GlosarioVista';
import { HojaTermino } from './HojaTermino';

export interface BotonAyudaProps {
  termino: TerminoId;
  style?: StyleProp<ViewStyle>;
}

export function BotonAyuda({ termino, style }: BotonAyudaProps) {
  const [abierta, setAbierta] = useState(false);
  const [usada, setUsada] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => {
          setUsada(true);
          setAbierta(true);
        }}
        style={({ pressed }) => [styles.boton, pressed && styles.pulsado, style]}
        accessibilityRole="button"
        accessibilityLabel={t('ayuda:termino.queSignifica', { termino: tituloTermino(termino) })}
      >
        <Ionicons name="help-circle-outline" size={20} color={ink.ink6} />
      </Pressable>
      {usada ? <HojaTermino termino={termino} visible={abierta} onClose={() => setAbierta(false)} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  boton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pulsado: { backgroundColor: ink.ink2 },
});

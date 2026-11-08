// NIVL · FOCUS: «¿Cómo te ha ido?» al terminar un bloque con tema. La hoja solo
// devuelve la elección (cierreBloque.ts decide qué cambia); cerrarla sin elegir
// es «sin acabar»: no cambia nada.

import { StyleSheet, Text, View } from 'react-native';
import { Sheet } from '@/components/ui';
import { space } from '@/design/tokens';
import { RESULTADOS_BLOQUE, type ResultadoBloque } from '@/focus/cierreBloque';
import { t } from '@/i18n';
import { FilaFocus, textoFocus } from './Piezas';
import { tf } from './textos';

export function HojaCierreBloque({
  visible,
  tema,
  onElegir,
  onClose,
}: {
  visible: boolean;
  tema: string;
  onElegir: (r: ResultadoBloque) => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} eyebrow={tema} title={t('focus:hoyCierre.titulo')}>
      {RESULTADOS_BLOQUE.map((r, i) => (
        <FilaFocus key={r} primera={i === 0} onPress={() => onElegir(r)} style={styles.fila} accessibilityLabel={tf(`focus:hoyCierre.${r}.titulo`)} accessibilityHint={tf(`focus:hoyCierre.${r}.cuerpo`)}>
          <View style={styles.flex}>
            <Text style={textoFocus.filaFuerte} maxFontSizeMultiplier={1.35}>
              {tf(`focus:hoyCierre.${r}.titulo`)}
            </Text>
            <Text style={textoFocus.cuerpo} maxFontSizeMultiplier={1.5}>
              {tf(`focus:hoyCierre.${r}.cuerpo`)}
            </Text>
          </View>
        </FilaFocus>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fila: { paddingVertical: space.s3 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
});

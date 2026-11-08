// NIVL · FOCUS: volver tras unos días sin estudiar. Qué se ha movido y por dónde
// retomar, sin reproches.

import { StyleSheet, Text, View } from 'react-native';
import { space } from '@/design/tokens';
import { t } from '@/i18n';
import type { HuecoVista } from './FocusHoyVista';
import { BotonFocus, Rotulo, TarjetaFocus, textoFocus } from './Piezas';

export function TarjetaHueco({ hueco, onRetomar, onCerrar }: { hueco: HuecoVista; onRetomar: () => void; onCerrar: () => void }) {
  return (
    <TarjetaFocus>
      <Rotulo texto={t('focus:hoyHueco.rotulo')} derecha={t('focus:hoyHueco.cerrar')} onDerecha={onCerrar} />
      <Text style={[textoFocus.filaFuerte, styles.arriba]} maxFontSizeMultiplier={1.35}>
        {t('focus:hoyHueco.titulo', { count: hueco.dias })}
      </Text>
      {hueco.pasaron.length > 0 ? (
        <View style={styles.arriba}>
          <Text style={textoFocus.detalle} maxFontSizeMultiplier={1.35}>
            {t('focus:hoyHueco.pasaron')}
          </Text>
          {hueco.pasaron.map((x) => (
            <Text key={x} style={textoFocus.cuerpo} maxFontSizeMultiplier={1.5} numberOfLines={1}>
              {x}
            </Text>
          ))}
        </View>
      ) : null}
      {hueco.repasos > 0 ? (
        <>
          <Text style={[textoFocus.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.5}>
            {t('focus:hoyHueco.repasos', { count: hueco.repasos, tope: hueco.temaIds.length })}
          </Text>
          <BotonFocus titulo={t('focus:hoyHueco.retomar')} variante="contorno" pequeno onPress={onRetomar} style={styles.arriba} />
        </>
      ) : (
        <Text style={[textoFocus.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.5}>
          {t('focus:hoyHueco.sinRepasos')}
        </Text>
      )}
    </TarjetaFocus>
  );
}

const styles = StyleSheet.create({
  arriba: { marginTop: space.s2 },
});

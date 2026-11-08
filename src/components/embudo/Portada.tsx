// NIVL · La primera pantalla (Ónix): qué es NIVL y por dónde se empieza. Sin
// cuenta. En ventana ancha, marca a la izquierda y acción a la derecha.

import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button } from '@/components/ui';
import { ink, oro, space, type as tipo, vidrio } from '@/design/tokens';
import { t } from '@/i18n';
import { Escudo } from './Escudo';

const MIN_DOS_COLUMNAS = 1024;

export function Portada({ onCrear, onEntrar }: { onCrear: () => void; onEntrar: () => void }) {
  const { width } = useWindowDimensions();
  const ancha = width >= MIN_DOS_COLUMNAS;
  const acciones = (
    <>
      <Button title={t('onboarding:embudo.portada.crear')} size="lg" onPress={onCrear} />
      <Pressable onPress={onEntrar} accessibilityRole="button" style={styles.enlace} hitSlop={6}>
        <Text style={styles.enlaceTexto}>{t('onboarding:embudo.portada.yaTengo')}</Text>
      </Pressable>
    </>
  );
  const marca = (
    <>
      <Escudo ancho={ancha ? 104 : 120} />
      <Text style={[styles.marca, ancha && styles.marcaAncha]} accessibilityRole="header">NIVL{/* i18n-ok: marca */}</Text>
      <Text style={[styles.lema, ancha && styles.lemaAncho]}>{t('onboarding:embudo.portada.lema')}</Text>
      <Text style={[styles.texto, ancha && styles.textoAncho]}>{t('onboarding:embudo.portada.texto')}</Text>
    </>
  );
  if (ancha) {
    return (
      <View style={styles.dosColumnas}>
        <View style={styles.izquierda}>{marca}</View>
        <View style={styles.tarjeta}>
          <Text style={styles.tarjetaTitulo}>{t('onboarding:embudo.portada.tarjeta')}</Text>
          {acciones}
        </View>
      </View>
    );
  }
  return (
    <View style={styles.columna}>
      <View style={styles.centro}>{marca}</View>
      <View style={styles.pie}>{acciones}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  columna: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: space.s6, paddingBottom: space.s6 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.s2 },
  pie: { gap: space.s1 },
  marca: { fontFamily: tipo.display.family, fontSize: 60, lineHeight: 66, letterSpacing: 8, color: oro.claro, marginRight: -8 },
  marcaAncha: { fontSize: 72, lineHeight: 80, letterSpacing: 6, marginRight: 0, color: ink.ink9 },
  lema: { fontFamily: tipo.title.family, fontSize: 30, lineHeight: 35, color: ink.ink9, textAlign: 'center' },
  lemaAncho: { fontSize: 44, lineHeight: 52, textAlign: 'left' },
  texto: { fontFamily: tipo.body.family, fontSize: 16, lineHeight: 23, color: ink.ink8, textAlign: 'center', marginTop: space.s2 },
  textoAncho: { fontSize: 18, lineHeight: 27, textAlign: 'left' },
  enlace: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  enlaceTexto: { fontFamily: tipo.bodySm.family, fontSize: 15, color: ink.ink9 },
  dosColumnas: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 64, paddingHorizontal: space.s8 },
  izquierda: { flexShrink: 1, maxWidth: 520, gap: space.s2 },
  tarjeta: { width: 400, gap: space.s3, padding: 28, borderRadius: 24, borderWidth: 1, borderColor: vidrio.borde, backgroundColor: vidrio.tarjeta },
  tarjetaTitulo: { fontFamily: tipo.headline.family, fontSize: 24, lineHeight: 30, color: ink.ink9, marginBottom: space.s2 },
});

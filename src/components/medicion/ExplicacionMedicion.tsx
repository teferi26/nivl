// NIVL · Lo que se explica una sola vez antes de encender HealthKit, GPS o reloj.
// Pura: todo llega por props. Solo la ve quien va a conectar una de esas fuentes.

import { StyleSheet, Text } from 'react-native';
import { ErrorSistema, TarjetaArena } from '@/components/arena';
import { Button } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';

export function ExplicacionMedicion(p: {
  activando: boolean;
  error: string | null;
  onActivar: () => void;
  onAhoraNo: () => void;
}) {
  return (
    <TarjetaArena variante="contorno" rotulo={t('medicion:explicacion.rotulo')}>
      <Text style={styles.cuerpo} maxFontSizeMultiplier={1.6}>{t('medicion:explicacion.entradilla')}</Text>
      {(['lee', 'para', 'control'] as const).map((k) => (
        <Text key={k} style={styles.bloque} maxFontSizeMultiplier={1.6}>
          <Text style={styles.rotulo}>{t(`medicion:explicacion.${k}Rotulo`)}. </Text>
          {t(`medicion:explicacion.${k}`)}
        </Text>
      ))}
      <Text style={styles.bloque} maxFontSizeMultiplier={1.6}>{t('medicion:explicacion.sistema')}</Text>
      {p.error ? <ErrorSistema compacto mensaje={p.error} style={styles.aviso} /> : null}
      <Button title={t('medicion:explicacion.activar')} onPress={p.onActivar} loading={p.activando} style={styles.boton} />
      <Button title={t('medicion:explicacion.ahoraNo')} variant="ghost" onPress={p.onAhoraNo} style={styles.botonNo} />
    </TarjetaArena>
  );
}

const texto = { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight };
const styles = StyleSheet.create({
  cuerpo: { ...texto, color: ink.ink9 },
  bloque: { ...texto, color: ink.ink8, marginTop: space.s3 },
  rotulo: { color: ink.ink9 },
  aviso: { marginTop: space.s3 },
  boton: { marginTop: space.s4 },
  botonNo: { marginTop: space.s2 },
});

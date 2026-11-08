// NIVL · El plan de 90 días con el veredicto del coach (Ónix). Determinista: sale
// de las respuestas; no llama a la IA, también lo ve quien no paga.

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMovimientoReducido } from '@/components/ui/motion';
import { ink, oro, radio, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { hitos, textoMeta, tx, veredicto, type Respuestas } from '@/lib/embudo';

const LINEAS = ['leyendo', 'calculando', 'eligiendo', 'preparando'] as const;
const MS_LINEA = 620;

/** «Construyendo tu plan»: cuatro líneas y sigue sola. */
export function CargaPlan({ onFin }: { onFin: () => void }) {
  const [n, setN] = useState(0);
  const reducido = useMovimientoReducido();
  useEffect(() => {
    if (n > LINEAS.length) {
      onFin();
      return;
    }
    const espera = setTimeout(() => setN((x) => x + 1), reducido ? 200 : MS_LINEA);
    return () => clearTimeout(espera);
  }, [n, onFin, reducido]);
  return (
    <View style={styles.carga} accessibilityRole="progressbar" accessibilityLabel={t('onboarding:embudo.carga.titulo')}>
      <Text style={styles.cargaTitulo}>{t('onboarding:embudo.carga.titulo')}</Text>
      {LINEAS.map((l, i) => (
        <Text key={l} style={[styles.linea, i > n && styles.lineaFutura]}>
          {i < n ? '✓  ' : ''}{/* i18n-ok: marca */}
          {tx(`onboarding:embudo.carga.${l}`)}
        </Text>
      ))}
    </View>
  );
}

export function PlanNoventa({ respuestas }: { respuestas: Respuestas }) {
  const titulo = textoMeta(respuestas) || t('onboarding:embudo.plan.sinMeta');
  return (
    <View style={styles.plan}>
      <Text style={styles.rotulo}>{t('onboarding:embudo.plan.rotulo')}</Text>
      <Text style={styles.titulo} accessibilityRole="header">{titulo}</Text>
      <View style={styles.veredicto}>
        <Text style={styles.rotuloOro}>{t('onboarding:embudo.plan.veredicto')}</Text>
        <Text style={styles.veredictoTexto}>{veredicto(respuestas)}</Text>
      </View>
      {hitos(respuestas.kind).map((h) => (
        <View key={h.cuando} style={styles.hito}>
          <Text style={styles.cuando}>{h.cuando}</Text>
          <View style={styles.hitoTexto}>
            <Text style={styles.hitoTitulo}>{h.titulo}</Text>
            <Text style={styles.hitoDetalle}>{h.detalle}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  carga: { gap: space.s4, paddingVertical: space.s8 },
  cargaTitulo: { fontFamily: tipo.display.family, fontSize: 40, lineHeight: 46, color: oro.claro },
  linea: { fontFamily: tipo.bodySm.family, fontSize: 19, lineHeight: 26, color: ink.ink9 },
  lineaFutura: { color: ink.ink6 },
  plan: { gap: space.s3 },
  rotulo: { fontFamily: tipo.label.family, fontSize: tipo.label.size, lineHeight: tipo.label.lineHeight, letterSpacing: tipo.label.tracking, textTransform: 'uppercase', color: ink.ink8 },
  rotuloOro: { fontFamily: tipo.label.family, fontSize: tipo.label.size, lineHeight: tipo.label.lineHeight, letterSpacing: tipo.label.tracking, textTransform: 'uppercase', color: oro.claro },
  titulo: { fontFamily: tipo.title.family, fontSize: tipo.title.size, lineHeight: tipo.title.lineHeight, color: ink.ink9 },
  veredicto: { borderRadius: radio.tarjeta, borderWidth: 1, borderColor: oro.borde, backgroundColor: oro.fondo, paddingVertical: 14, paddingHorizontal: space.s4, gap: space.s2 },
  veredictoTexto: { fontFamily: tipo.bodySm.family, fontSize: 18, lineHeight: 25, color: ink.ink9 },
  hito: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  cuando: { width: 68, fontFamily: tipo.number.family, fontSize: 15, lineHeight: 20, color: oro.claro },
  hitoTexto: { flex: 1, minWidth: 0 },
  hitoTitulo: { fontFamily: tipo.headline.family, fontSize: 17, lineHeight: 22, color: ink.ink9 },
  hitoDetalle: { fontFamily: tipo.bodySm.family, fontSize: 14, lineHeight: 19, color: ink.ink8 },
});

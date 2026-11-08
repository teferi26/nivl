// NIVL · La pausa del coach (0135): lo que sustituye al cuadro de escribir.
// Puro, solo props; el estado y los efectos están en useCoach. Dos pasos: el
// botón de reactivar y, al pulsarlo, sus objetivos y el botón de comprometerse.

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Skeleton } from '@/components/ui';
import { ink, space, stroke, type } from '@/design/tokens';
import { t } from '@/i18n';

export interface PausaCoachVista {
  paso: 'inicio' | 'compromiso';
  /** Días sin responder, reales. */
  dias: number;
  /** null = aún cargando. Vacío: la pantalla sigue sin lista. */
  objetivos: string[] | null;
  /** Un toque ya en marcha: el botón se apaga. */
  reactivando: boolean;
  onReactivar: () => void;
  onComprometerse: () => void;
  onVolver: () => void;
}

/** El paso 2: sus objetivos y el mensaje, en lugar del hilo. */
export function PausaCompromiso({ pausa }: { pausa: PausaCoachVista }) {
  const { objetivos } = pausa;
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.compromiso} showsVerticalScrollIndicator={false}>
      {objetivos === null ? (
        <View accessibilityRole="progressbar" accessibilityLabel={t('coach:pausa.cargandoA11y')}>
          <Skeleton height={14} width="40%" />
          <Skeleton height={18} width="88%" style={styles.hueco} />
          <Skeleton height={18} width="64%" style={styles.hueco} />
        </View>
      ) : objetivos.length ? (
        <View>
          <Text style={styles.rotulo} accessibilityRole="header" maxFontSizeMultiplier={1.35}>
            {t('coach:pausa.objetivos')}
          </Text>
          {objetivos.map((o) => (
            <Text key={o} style={styles.objetivo}>
              {o}
            </Text>
          ))}
        </View>
      ) : null}
      <Text style={styles.noPasa}>{t('coach:pausa.noPasa', { count: pausa.dias })}</Text>
    </ScrollView>
  );
}

/** El pie fijo, en el sitio del cuadro de escribir. */
export function PausaPie({ pausa, error, fondoSeguro }: { pausa: PausaCoachVista; error: string | null; fondoSeguro: number }) {
  const inicio = pausa.paso === 'inicio';
  return (
    <View style={[styles.pie, { paddingBottom: styles.pie.paddingBottom + fondoSeguro }]}>
      {inicio ? (
        <>
          <Text style={styles.titulo} accessibilityRole="header" maxFontSizeMultiplier={1.35}>
            {t('coach:pausa.titulo')}
          </Text>
          <Text style={styles.cuerpo}>{t('coach:pausa.cuerpo')}</Text>
          <Button title={t('coach:pausa.reactivar')} onPress={pausa.onReactivar} />
        </>
      ) : (
        <>
          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <Button
            title={t('coach:pausa.comprometerse')}
            onPress={pausa.onComprometerse}
            loading={pausa.reactivando}
          />
          <Button title={t('coach:pausa.ahoraNo')} variant="ghost" size="sm" onPress={pausa.onVolver} disabled={pausa.reactivando} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  compromiso: { paddingHorizontal: space.s5, paddingTop: space.s5, paddingBottom: space.s5, gap: space.s5 },
  hueco: { marginTop: space.s3 },
  rotulo: {
    fontFamily: type.bodySm.family,
    fontSize: type.bodySm.size,
    lineHeight: type.bodySm.lineHeight,
    color: ink.ink8,
    marginBottom: space.s2,
  },
  objetivo: {
    fontFamily: type.body.family,
    fontSize: type.body.size,
    lineHeight: type.body.lineHeight,
    color: ink.ink10,
    paddingVertical: space.s2,
    borderTopWidth: stroke.hairline,
    borderTopColor: ink.ink3,
  },
  noPasa: { fontFamily: type.body.family, fontSize: type.body.size, lineHeight: type.body.lineHeight, color: ink.ink9 },
  pie: {
    gap: space.s3,
    paddingHorizontal: space.s5,
    paddingTop: space.s4,
    paddingBottom: space.s3 + 2,
    borderTopWidth: stroke.hairline,
    borderTopColor: ink.ink3,
  },
  titulo: { fontFamily: type.bodySm.family, fontSize: type.bodySm.size, lineHeight: type.bodySm.lineHeight, color: ink.ink10, letterSpacing: 1.5 },
  cuerpo: { fontFamily: type.bodySm.family, fontSize: type.bodySm.size, lineHeight: type.bodySm.lineHeight, color: ink.ink8 },
  error: { fontFamily: type.bodySm.family, fontSize: type.bodySm.size, lineHeight: type.bodySm.lineHeight, color: ink.ink9 },
});

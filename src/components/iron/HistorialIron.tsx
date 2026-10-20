// NIVL · IRON · «Tu historial» en la técnica de un ejercicio (/iron/[id]).
// Pura: el estado llega de useHistorialIron.
//
// De arriba abajo: la carga de la próxima sesión (una línea en Outfit, ink9,
// con su porqué en ink6 y la advertencia de que es orientativa), la franja
// con la mejor marca (1RM estimado por Epley) y las sesiones, y las últimas
// sesiones en filas con hairline (fecha · series × reps × kg). Sin inversión:
// esta pantalla se mira. Sin datos, una línea que explica de dónde saldrán.

import { StyleSheet, Text, View } from 'react-native';
import { CargaArena, ErrorSistema, FranjaCifras, TarjetaArena } from '@/components/arena';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { decimal, fechaCorta } from '@/i18n/formato';
import { bloques, type Bloque, type Sugerencia } from '@/iron/historial';
import type { EstadoHistorialIron } from './useHistorialIron';

/** El peso con los decimales que traiga y la coma del idioma: 62.5 → «62,5». */
export function kgTexto(kg: number): string {
  const decimales = Math.min(2, (String(kg).split('.')[1] ?? '').length);
  return decimal(kg, decimales);
}

/** «3 × 8 × 60 kg · 1 × 7 × 60 kg»; sin carga, «3 × 10». */
export function seriesTexto(lista: readonly Bloque[]): string {
  return lista
    .map((b) =>
      b.kg > 0
        ? t('iron:historial.bloque', { series: b.series, reps: b.reps, kg: kgTexto(b.kg) })
        : t('iron:historial.bloqueSinPeso', { series: b.series, reps: b.reps }),
    )
    .join(' · ');
}

/** «La próxima: 3 × 8 con 62,5 kg». */
export function proximaTexto(s: Sugerencia): string {
  return t('iron:historial.proxima', { series: s.series, reps: s.reps, kg: kgTexto(s.kg) });
}

export function HistorialIron({ estado }: { estado: EstadoHistorialIron }) {
  if (estado.estado === 'cargando') {
    return <CargaArena etiqueta={t('iron:historial.cargando')} formas={['rotulo', 'franja', 'filas']} />;
  }
  if (estado.estado === 'error') {
    return <ErrorSistema compacto mensaje={estado.mensaje} onReintentar={estado.reintentar} />;
  }

  const { sesiones, total, mejor, sugerencia } = estado.resumen;
  if (total === 0) {
    return (
      <TarjetaArena variante="contorno" rotulo={t('iron:historial.rotulo')}>
        <Text style={styles.detalle} maxFontSizeMultiplier={1.35}>
          {t('iron:historial.vacio')}
        </Text>
      </TarjetaArena>
    );
  }

  return (
    <TarjetaArena variante="contorno" rotulo={t('iron:historial.rotulo')}>
      <View style={styles.pila}>
        {sugerencia ? (
          <View style={styles.sugerencia}>
            <Text style={styles.proxima} maxFontSizeMultiplier={1.35}>
              {proximaTexto(sugerencia)}
            </Text>
            <Text style={styles.detalle} maxFontSizeMultiplier={1.35}>
              {t(`iron:historial.motivo.${sugerencia.motivo}`, { tope: sugerencia.tope })}
            </Text>
            <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
              {t('iron:historial.orientativo')}
            </Text>
          </View>
        ) : null}

        <FranjaCifras
          cifras={[
            {
              valor: mejor ? kgTexto(mejor.e1rm) : '',
              sufijo: mejor ? ' kg' : undefined,
              rotulo: t('iron:historial.mejor'),
            },
            { valor: total, rotulo: t('iron:historial.sesiones') },
          ]}
        />
        {mejor ? (
          <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
            {t('iron:historial.mejorDetalle', {
              kg: kgTexto(mejor.kg),
              reps: mejor.reps,
              fecha: fechaCorta(mejor.fecha),
            })}
          </Text>
        ) : null}

        <View>
          <Text style={styles.rotulo} maxFontSizeMultiplier={1.35}>
            {t('iron:historial.ultimas')}
          </Text>
          {sesiones.map((s, i) => {
            const fecha = fechaCorta(s.fecha);
            const texto = seriesTexto(bloques(s.series));
            return (
              <View
                key={s.fecha}
                accessible
                accessibilityLabel={t('iron:historial.sesionA11y', { fecha, series: texto })}
                style={[styles.fila, i > 0 && styles.conRegla]}
              >
                <Text style={styles.fecha} maxFontSizeMultiplier={1.35}>
                  {fecha}
                </Text>
                <Text style={styles.series} maxFontSizeMultiplier={1.35}>
                  {texto}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </TarjetaArena>
  );
}

const styles = StyleSheet.create({
  pila: { gap: space.s4 },
  sugerencia: { gap: space.s1 },
  proxima: {
    fontFamily: tipo.headline.family,
    fontSize: tipo.headline.size,
    lineHeight: tipo.headline.lineHeight,
    letterSpacing: tipo.headline.tracking,
    color: ink.ink9,
  },
  detalle: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
  },
  nota: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
  },
  rotulo: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
    marginBottom: space.s1,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.s3,
    minHeight: 44,
    paddingVertical: space.s2,
  },
  conRegla: { borderTopWidth: stroke.hairline, borderTopColor: ink.ink3 },
  fecha: {
    minWidth: 64,
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
  },
  series: {
    flex: 1,
    minWidth: 0,
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
  },
});

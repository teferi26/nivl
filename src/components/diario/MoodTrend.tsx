// NIVL · Diario: la tendencia del Archivo (FASE3 Lote D).
//
// Las cifras (ánimo y sueño de la semana, racha de días escritos, entradas)
// van en la FranjaCifras del Archivo: `cifrasTendencia` las prepara. Aquí,
// la comparación con la semana anterior en una línea, las dos curvas de las
// últimas 30 entradas (línea ink10 sobre una pista ink4) y las emociones que
// más se repiten. Las cuentas vienen hechas de `journalmath.ts`. Sin tres
// datos en la ventana no hay media: mejor una raya que una tendencia inventada.
//
// El ancho de las curvas se mide con onLayout: el hueco real (galería, iPad
// a dos columnas) no es el de la ventana.

import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import type { Cifra } from '@/components/arena';
import { TrendLine } from '@/components/TrendLine';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { MIN_DATOS_MEDIA, formatoDecimal, type ResumenTendencia } from '@/lib/journalmath';

interface Props {
  resumen: ResumenTendencia;
  /** Series cronológicas, sin nulos (`serieDe`). */
  animo: number[];
  energia: number[];
}

const ALTO_CURVA = 64;
/** Margen interior de TrendLine: la pista va donde cae el valor mínimo. */
const PAD_CURVA = 6;
const HUECO = space.s4;

/** Las cuatro cifras de la franja del Archivo. */
export function cifrasTendencia(resumen: ResumenTendencia, entradas: number): Cifra[] {
  const { animo: a, sueno, racha } = resumen;
  return [
    {
      valor: a.actual === null ? '' : formatoDecimal(a.actual),
      rotulo: t('diario:compartido.animo'),
      etiqueta:
        a.actual === null
          ? t('diario:tendencia.animoSinDatosA11y', { min: MIN_DATOS_MEDIA })
          : t('diario:tendencia.animoA11y', { media: formatoDecimal(a.actual) }),
    },
    {
      valor: sueno.actual === null ? '' : formatoDecimal(sueno.actual),
      sufijo: sueno.actual === null ? undefined : 'h', // i18n-ok: unidad
      rotulo: t('diario:compartido.sueno'),
      etiqueta:
        sueno.actual === null
          ? t('diario:tendencia.suenoSinDatosA11y')
          : t('diario:tendencia.suenoA11y', { media: formatoDecimal(sueno.actual) }),
    },
    {
      valor: racha,
      sufijo: 'd', // i18n-ok: unidad
      rotulo: t('diario:tendencia.racha'),
      etiqueta: t('diario:tendencia.rachaA11y', { count: racha }),
    },
    { valor: entradas, rotulo: t('diario:tendencia.dias'), etiqueta: t('diario:tendencia.diasA11y', { count: entradas }) },
  ];
}

/** La frase que acompaña a la franja: cómo va la semana frente a la anterior. */
function lineaComparativa(resumen: ResumenTendencia): string | null {
  const { animo: a, sueno } = resumen;
  if (a.actual === null || sueno.actual === null) {
    return t('diario:tendencia.sinMedia', { min: MIN_DATOS_MEDIA });
  }
  if (a.delta === null) return null;
  if (a.delta === 0) return t('diario:tendencia.igual');
  return t(a.delta > 0 ? 'diario:tendencia.sube' : 'diario:tendencia.baja', { delta: formatoDecimal(Math.abs(a.delta)) });
}

function Curva({ rotulo, valores, ancho }: { rotulo: string; valores: number[]; ancho: number }) {
  return (
    <View style={{ width: ancho }}>
      <Text style={styles.rotulo} maxFontSizeMultiplier={1.35}>
        {rotulo}
      </Text>
      <View>
        {/* La pista: la línea de base sobre la que corre la curva. */}
        <View style={styles.pista} pointerEvents="none" />
        <TrendLine values={valores} width={ancho} height={ALTO_CURVA} unit="" color={ink.ink10} />
      </View>
    </View>
  );
}

export function MoodTrend({ resumen, animo, energia }: Props) {
  const [ancho, setAncho] = useState(0);
  const alMedir = (e: LayoutChangeEvent) => setAncho(Math.round(e.nativeEvent.layout.width));
  const mitad = Math.floor((ancho - HUECO) / 2);
  const hayCurvas = animo.length > 1 || energia.length > 1;
  const linea = lineaComparativa(resumen);
  const { emociones } = resumen;

  return (
    <View onLayout={alMedir}>
      {linea ? (
        <Text style={styles.nota} maxFontSizeMultiplier={1.6}>
          {linea}
        </Text>
      ) : null}

      {hayCurvas && mitad > 0 ? (
        <View style={styles.curvas}>
          <Curva rotulo={t('diario:compartido.animo')} valores={animo} ancho={mitad} />
          <Curva rotulo={t('diario:compartido.energia')} valores={energia} ancho={mitad} />
        </View>
      ) : null}

      {emociones.length > 0 ? (
        <View style={styles.emociones}>
          <Text style={styles.rotulo} maxFontSizeMultiplier={1.35}>
            {t('diario:tendencia.repite')}
          </Text>
          <View style={styles.emocionesFila}>
            {emociones.map((e) => (
              <View
                key={e.id}
                style={styles.emocion}
                accessible
                accessibilityLabel={t('diario:tendencia.emocionA11y', { emocion: e.label, count: e.count })}
              >
                <Text style={styles.emocionTexto}>{e.label}</Text>
                <Text style={styles.emocionCuenta}>{e.count}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  nota: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink8 },
  curvas: { flexDirection: 'row', justifyContent: 'space-between', gap: HUECO, marginTop: space.s5 },
  pista: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ALTO_CURVA - PAD_CURVA,
    height: stroke.hairline,
    backgroundColor: ink.ink4,
  },
  rotulo: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
    marginBottom: space.s2,
  },
  emociones: {
    marginTop: space.s5,
    paddingTop: space.s4,
    borderTopWidth: stroke.hairline,
    borderTopColor: ink.ink3,
  },
  emocionesFila: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
  emocion: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.s2,
    borderWidth: stroke.hairline,
    borderColor: ink.ink4,
    paddingHorizontal: space.s2,
    paddingVertical: 2,
  },
  emocionTexto: { fontFamily: tipo.micro.family, fontSize: 12, lineHeight: 16, color: ink.ink8 },
  emocionCuenta: { fontFamily: tipo.number.family, fontSize: 12, color: ink.ink10 },
});

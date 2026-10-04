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
      rotulo: 'Ánimo',
      etiqueta:
        a.actual === null
          ? `Ánimo de los últimos 7 días: faltan datos, hacen falta ${MIN_DATOS_MEDIA}`
          : `Ánimo medio de los últimos 7 días: ${formatoDecimal(a.actual)} de 5`,
    },
    {
      valor: sueno.actual === null ? '' : formatoDecimal(sueno.actual),
      sufijo: sueno.actual === null ? undefined : 'h',
      rotulo: 'Sueño',
      etiqueta:
        sueno.actual === null
          ? 'Sueño medio de los últimos 7 días: faltan datos'
          : `Sueño medio de los últimos 7 días: ${formatoDecimal(sueno.actual)} horas`,
    },
    {
      valor: racha,
      sufijo: 'd',
      rotulo: 'Racha',
      etiqueta: `Racha de ${racha} ${racha === 1 ? 'día escrito' : 'días escritos'}`,
    },
    { valor: entradas, rotulo: 'Días', etiqueta: `${entradas} ${entradas === 1 ? 'día escrito' : 'días escritos'} en el archivo` },
  ];
}

/** La frase que acompaña a la franja: cómo va la semana frente a la anterior. */
function lineaComparativa(resumen: ResumenTendencia): string | null {
  const { animo: a, sueno } = resumen;
  if (a.actual === null || sueno.actual === null) {
    return `Una media necesita ${MIN_DATOS_MEDIA} días con dato en la semana. Con menos sería una anécdota.`;
  }
  if (a.delta === null) return null;
  if (a.delta === 0) return 'El ánimo, igual que los 7 días anteriores.';
  return `El ánimo ${a.delta > 0 ? 'sube' : 'baja'} ${formatoDecimal(Math.abs(a.delta))} frente a los 7 días anteriores.`;
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
          <Curva rotulo="Ánimo" valores={animo} ancho={mitad} />
          <Curva rotulo="Energía" valores={energia} ancho={mitad} />
        </View>
      ) : null}

      {emociones.length > 0 ? (
        <View style={styles.emociones}>
          <Text style={styles.rotulo} maxFontSizeMultiplier={1.35}>
            Lo que más se repite · 14 días
          </Text>
          <View style={styles.emocionesFila}>
            {emociones.map((e) => (
              <View
                key={e.id}
                style={styles.emocion}
                accessible
                accessibilityLabel={`${e.label}, ${e.count} ${e.count === 1 ? 'día' : 'días'}`}
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

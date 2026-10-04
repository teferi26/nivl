// NIVL · La curva de una serie (peso, un récord, el ánimo). Sin librerías.
//
// Mármol y tinta (FASE3 Lote F): la línea en ink10 corre sobre una pista ink4
// (la línea de base, donde cae el valor mínimo); el último punto, un cuadrado
// blanco. Debajo, mínimo y máximo en `micro` ink6 y la variación en Cinzel.
// Las cifras van con coma decimal. El lector oye un resumen («de 85 a 78,4
// kg, mínimo 78,4, máximo 85,2»), no el dibujo.

import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Polyline, Rect } from 'react-native-svg';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { numeroES } from '@/lib/pagoActo';

interface Props {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  unit?: string;
  /** Pinta la pista ink4 (por defecto, sí). */
  pista?: boolean;
}

const PAD = 6;
const PUNTO = 7;

export function TrendLine({ values, width = 300, height = 90, color = ink.ink10, unit = 'kg', pista = true }: Props) {
  if (values.length === 0) {
    return (
      <Text style={styles.vacio} maxFontSizeMultiplier={1.6}>
        Sin datos todavía.
      </Text>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerW = Math.max(1, width - PAD * 2);
  const innerH = Math.max(1, height - PAD * 2);

  const points = values.map((v, i) => {
    const x = PAD + (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW);
    const y = PAD + innerH - ((v - min) / span) * innerH;
    return { x, y };
  });

  const last = points[points.length - 1]!;
  const first = values[0]!;
  const latest = values[values.length - 1]!;
  const delta = Math.round((latest - first) * 10) / 10;
  const u = unit ? ` ${unit}` : '';
  const variacion = `${delta > 0 ? '+' : ''}${numeroES(delta, 1)}${u}`;
  const leido = `Tendencia de ${values.length} datos: de ${numeroES(first, 1)} a ${numeroES(latest, 1)}${u}, mínimo ${numeroES(min, 1)}, máximo ${numeroES(max, 1)}.`;
  // La pista va donde cae el mínimo; el medio punto la deja en el píxel entero.
  const yPista = height - PAD + 0.5;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={leido}>
      <Svg width={width} height={height}>
        {pista ? <Line x1={0} y1={yPista} x2={width} y2={yPista} stroke={ink.ink4} strokeWidth={stroke.hairline} /> : null}
        <Polyline
          points={points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={color}
          strokeWidth={stroke.rule}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <Rect x={last.x - PUNTO / 2} y={last.y - PUNTO / 2} width={PUNTO} height={PUNTO} fill={color} />
      </Svg>
      <View style={[styles.pie, { width }]}>
        <Text style={styles.extremos} maxFontSizeMultiplier={1.35} numberOfLines={1}>
          Mín {numeroES(min, 1)} · Máx {numeroES(max, 1)}
          {u}
        </Text>
        <Text style={[styles.delta, delta === 0 && styles.deltaPlano]} maxFontSizeMultiplier={1.35}>
          {variacion}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  vacio: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink6 },
  pie: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.s2, marginTop: space.s2 },
  extremos: {
    flexShrink: 1,
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
  delta: { fontFamily: tipo.number.family, fontSize: 14, lineHeight: 18, color: ink.ink10 },
  deltaPlano: { color: ink.ink8 },
});

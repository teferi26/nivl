// NIVL · Mapa de actividad (columnas = semanas, filas = lunes a domingo).
//
// Mármol y tinta (FASE3 Lote F): escala neutra de cuatro pasos, de la pista
// ink4 al blanco (SISTEMA §1); sin color. Con `ancho` las celdas crecen hasta
// llenarlo (tope 20) para que en una tableta no quede un sello en una
// esquina. El lector oye un resumen, no 91 celdas.

import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { ink, space, type as tipo } from '@/design/tokens';
import { addDays, dateKey } from '@/lib/dates';

interface Props {
  counts: Record<string, number>;
  weeks?: number;
  /** Ancho disponible: las celdas se ajustan a él. */
  ancho?: number;
  /** «Hoy» (AAAA-MM-DD); por defecto, el de verdad. La galería fija el suyo. */
  hoy?: string;
}

const CELDA = 11;
const CELDA_MAX = 20;
const GAP = 3;

// Escala neutra de cuatro pasos (SISTEMA §1): de la pista ink4 al blanco.
const ESCALA = [ink.ink4, ink.ink6, ink.ink8, ink.ink10] as const;

function cellColor(count: number): string {
  if (count <= 0) return ESCALA[0];
  if (count <= 2) return ESCALA[1];
  if (count <= 4) return ESCALA[2];
  return ESCALA[3];
}

export function Heatmap({ counts, weeks = 13, ancho, hoy }: Props) {
  const today = hoy ?? dateKey();
  const [y, m, d] = today.split('-').map(Number);
  const todayDate = new Date(y!, m! - 1, d!);
  const todayIso = todayDate.getDay() === 0 ? 7 : todayDate.getDay();

  const lastMonday = addDays(today, -(todayIso - 1));
  const start = addDays(lastMonday, -(weeks - 1) * 7);

  const celda = ancho ? Math.max(CELDA, Math.min(CELDA_MAX, Math.floor(ancho / weeks) - GAP)) : CELDA;
  const width = weeks * (celda + GAP) - GAP;
  const height = 7 * (celda + GAP) - GAP;

  const cells: { x: number; y: number; color: string }[] = [];
  let activos = 0;
  for (let w = 0; w < weeks; w++) {
    for (let dow = 0; dow < 7; dow++) {
      const day = addDays(start, w * 7 + dow);
      if (day > today) continue;
      const n = counts[day] ?? 0;
      if (n > 0) activos++;
      cells.push({
        x: w * (celda + GAP),
        y: dow * (celda + GAP),
        color: cellColor(n),
      });
    }
  }

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Mapa de actividad de ${weeks} semanas: ${activos} ${activos === 1 ? 'día' : 'días'} con alguna misión completada.`}
    >
      <Svg width={width} height={height}>
        {cells.map((c, i) => (
          <Rect key={i} x={c.x} y={c.y} width={celda} height={celda} fill={c.color} />
        ))}
      </Svg>
      <View style={styles.leyenda}>
        <Text style={styles.texto} maxFontSizeMultiplier={1.35}>
          Menos
        </Text>
        {ESCALA.map((c) => (
          <View key={c} style={[styles.muestra, { backgroundColor: c }]} />
        ))}
        <Text style={styles.texto} maxFontSizeMultiplier={1.35}>
          Más
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  leyenda: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: space.s3 },
  muestra: { width: 10, height: 10 },
  texto: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
});

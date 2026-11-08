// NIVL · Resistencia: la curva de forma y fatiga (pura). Sin color: la forma
// (CTL) es trazo sólido, la fatiga (ATL) trazo discontinuo y el balance (TSB)
// un área de trama sobre la línea de cero. Las tres comparten escala: mezclar
// escalas haría que el cruce entre forma y fatiga no signifique nada.

import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, Path, Pattern, Rect, Text as SvgText } from 'react-native-svg';
import { C, F, fs, px } from '@/components/ironmundo/tema';
import { t } from '@/i18n';
import { decimal, fechaCorta } from '@/i18n/formato';
import type { DiaCarga } from '@/lib/cargamath';

const MARGEN = { izq: 28, der: 6, arriba: 8, abajo: 6 } as const;
const ID_TRAMA = 'tramaBalance';

export interface TrazadoForma {
  ctl: string;
  atl: string;
  tsb: string;
  yCero: number;
  min: number;
  max: number;
  /** El último día, para marcarlo. */
  xFin: number;
  yFinCtl: number;
}

/** Los caminos SVG de la gráfica. Sin datos o sin ancho, null. */
export function trazarForma(serie: readonly DiaCarga[], ancho: number, alto: number): TrazadoForma | null {
  if (serie.length === 0 || ancho <= MARGEN.izq + MARGEN.der || alto <= MARGEN.arriba + MARGEN.abajo) return null;
  const lista = serie.length === 1 ? [serie[0]!, serie[0]!] : serie;
  const valores = lista.flatMap((d) => [d.ctl, d.atl, d.tsb]);
  // El cero siempre se ve: es la referencia del balance.
  const min = Math.floor(Math.min(0, ...valores));
  const max = Math.ceil(Math.max(0, ...valores));
  const rango = max - min || 1;
  const utilX = ancho - MARGEN.izq - MARGEN.der;
  const utilY = alto - MARGEN.arriba - MARGEN.abajo;
  const x = (i: number) => MARGEN.izq + (i * utilX) / (lista.length - 1);
  const y = (v: number) => MARGEN.arriba + ((max - v) * utilY) / rango;
  const linea = (campo: 'ctl' | 'atl' | 'tsb') =>
    lista.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(d[campo]).toFixed(1)}`).join(' ');
  const yCero = y(0);
  const fin = lista.length - 1;
  return {
    ctl: linea('ctl'),
    atl: linea('atl'),
    tsb: `M${x(0).toFixed(1)} ${yCero.toFixed(1)} ${linea('tsb').replace(/^M/, 'L')} L${x(fin).toFixed(1)} ${yCero.toFixed(1)} Z`,
    yCero,
    min,
    max,
    xFin: x(fin),
    yFinCtl: y(lista[fin]!.ctl),
  };
}

function Muestra({ tipo }: { tipo: 'solido' | 'discontinuo' | 'trama' }) {
  return (
    <Svg width={22} height={10} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {tipo === 'trama' ? (
        <>
          <Defs>
            <Pattern id="muestraTrama" patternUnits="userSpaceOnUse" width={4} height={4} patternTransform="rotate(45)">
              <Line x1={0} y1={0} x2={0} y2={4} stroke={C.suave} strokeWidth={1.2} />
            </Pattern>
          </Defs>
          <Rect x={0} y={0} width={22} height={10} fill="url(#muestraTrama)" />
        </>
      ) : (
        <Line
          x1={0}
          y1={5}
          x2={22}
          y2={5}
          stroke={tipo === 'solido' ? C.blanco : C.suave}
          strokeWidth={tipo === 'solido' ? 2 : 1.4}
          strokeDasharray={tipo === 'solido' ? undefined : '4 3'}
        />
      )}
    </Svg>
  );
}

export function GraficaForma({ serie, alto = px(160) }: { serie: readonly DiaCarga[]; alto?: number }) {
  const [ancho, setAncho] = useState(0);
  const g = useMemo(() => trazarForma(serie, ancho, alto), [serie, ancho, alto]);
  const hoy = serie[serie.length - 1];
  const resumen = hoy
    ? t('resistenciaPlan:progreso.graficaA11y', {
        ctl: decimal(hoy.ctl),
        atl: decimal(hoy.atl),
        tsb: decimal(hoy.tsb),
      })
    : undefined;
  return (
    <View>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={resumen}
        style={{ height: alto }}
        onLayout={(ev) => setAncho(Math.floor(ev.nativeEvent.layout.width))}
      >
        {g ? (
          <Svg width={ancho} height={alto} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Defs>
              <Pattern id={ID_TRAMA} patternUnits="userSpaceOnUse" width={5} height={5} patternTransform="rotate(45)">
                <Line x1={0} y1={0} x2={0} y2={5} stroke={C.apagado} strokeWidth={1.2} />
              </Pattern>
            </Defs>
            <Path d={g.tsb} fill={`url(#${ID_TRAMA})`} stroke="none" />
            <Line x1={MARGEN.izq} y1={g.yCero} x2={ancho - MARGEN.der} y2={g.yCero} stroke={C.borde} strokeWidth={1} />
            <Path d={g.atl} fill="none" stroke={C.suave} strokeWidth={1.4} strokeDasharray="4 3" strokeLinejoin="round" />
            <Path d={g.ctl} fill="none" stroke={C.blanco} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <Circle cx={g.xFin} cy={g.yFinCtl} r={3} fill={C.blanco} />
            <SvgText x={MARGEN.izq - 5} y={MARGEN.arriba + 8} fill={C.mudo} fontFamily={F.m} fontSize={11} textAnchor="end">
              {String(g.max)}
            </SvgText>
            <SvgText x={MARGEN.izq - 5} y={g.yCero + 3.5} fill={C.mudo} fontFamily={F.m} fontSize={11} textAnchor="end">
              0
            </SvgText>
            {g.min < 0 ? (
              <SvgText x={MARGEN.izq - 5} y={alto - MARGEN.abajo} fill={C.mudo} fontFamily={F.m} fontSize={11} textAnchor="end">
                {String(g.min)}
              </SvgText>
            ) : null}
          </Svg>
        ) : null}
      </View>
      {serie.length > 0 ? (
        <View style={styles.fechas}>
          <Text style={styles.fecha} maxFontSizeMultiplier={1.35}>
            {fechaCorta(serie[0]!.fecha)}
          </Text>
          <Text style={styles.fecha} maxFontSizeMultiplier={1.35}>
            {fechaCorta(serie[serie.length - 1]!.fecha)}
          </Text>
        </View>
      ) : null}
      <View style={styles.leyenda} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.entrada}>
          <Muestra tipo="solido" />
          <Text style={styles.fecha} maxFontSizeMultiplier={1.35}>
            {t('resistenciaPlan:progreso.ctl')}
          </Text>
        </View>
        <View style={styles.entrada}>
          <Muestra tipo="discontinuo" />
          <Text style={styles.fecha} maxFontSizeMultiplier={1.35}>
            {t('resistenciaPlan:progreso.atl')}
          </Text>
        </View>
        <View style={styles.entrada}>
          <Muestra tipo="trama" />
          <Text style={styles.fecha} maxFontSizeMultiplier={1.35}>
            {t('resistenciaPlan:progreso.tsb')}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fechas: { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: MARGEN.izq, marginTop: px(2) },
  fecha: { fontFamily: F.m, fontSize: fs(9.5), color: C.mudo },
  leyenda: { flexDirection: 'row', flexWrap: 'wrap', gap: px(12), marginTop: px(8) },
  entrada: { flexDirection: 'row', alignItems: 'center', gap: px(5) },
});

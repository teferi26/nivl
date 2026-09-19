// NIVL · Diario — la tendencia que abre el Archivo.
//
// Tres cifras (ánimo de la semana contra la anterior, sueño, racha de días
// escritos), las dos curvas de las últimas 30 entradas y las emociones que más
// se repiten. Las cuentas vienen hechas de `journalmath.ts`; aquí solo se
// pintan. Sin tres datos en la ventana no hay media: mejor una raya que una
// tendencia inventada.

import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { TrendLine } from '@/components/TrendLine';
import { Card } from '@/components/ui';
import { MIN_DATOS_MEDIA, formatoDecimal, type ResumenTendencia } from '@/lib/journalmath';
import { colors, fonts } from '@/lib/theme';

interface Props {
  resumen: ResumenTendencia;
  /** Series cronológicas, sin nulos (`serieDe`). */
  animo: number[];
  energia: number[];
  /** Ancho útil dentro de la tarjeta. */
  width: number;
}

function Cifra({
  rotulo,
  valor,
  unidad,
  delta,
  tono = 'text',
  leido,
}: {
  rotulo: string;
  valor: string;
  unidad?: string;
  delta?: number | null;
  tono?: 'text' | 'gold';
  leido: string;
}) {
  const sube = (delta ?? 0) > 0;
  return (
    <View style={styles.cifra} accessible accessibilityLabel={leido}>
      <View style={styles.cifraFila}>
        <Text style={[styles.cifraValor, tono === 'gold' && { color: colors.gold }]}>{valor}</Text>
        {unidad ? <Text style={[styles.cifraUnidad, tono === 'gold' && { color: colors.gold }]}>{unidad}</Text> : null}
      </View>
      {delta != null && delta !== 0 ? (
        <View style={styles.deltaFila}>
          <Ionicons name={sube ? 'caret-up' : 'caret-down'} size={11} color={sube ? colors.accent : colors.red} />
          <Text style={[styles.delta, { color: sube ? colors.accent : colors.red }]}>
            {formatoDecimal(Math.abs(delta))}
          </Text>
        </View>
      ) : delta === 0 ? (
        <Text style={styles.deltaIgual}>Igual</Text>
      ) : null}
      <Text style={styles.cifraRotulo}>{rotulo}</Text>
    </View>
  );
}

export function MoodTrend({ resumen, animo, energia, width }: Props) {
  const { animo: a, sueno, racha, emociones } = resumen;
  const mitad = Math.max(120, Math.floor((width - 16) / 2));
  const hayCurvas = animo.length > 1 || energia.length > 1;

  const leidoAnimo =
    a.actual === null
      ? `Ánimo de los últimos 7 días: faltan datos, hacen falta ${MIN_DATOS_MEDIA}`
      : `Ánimo medio de los últimos 7 días: ${formatoDecimal(a.actual)} de 5${
          a.delta === null ? '' : a.delta === 0 ? ', igual que los 7 anteriores' : `, ${a.delta > 0 ? 'sube' : 'baja'} ${formatoDecimal(Math.abs(a.delta))} frente a los 7 anteriores`
        }`;

  return (
    <Card>
      <View style={styles.cifras}>
        <Cifra
          rotulo="Ánimo · 7 días"
          valor={a.actual === null ? '—' : formatoDecimal(a.actual)}
          delta={a.delta}
          leido={leidoAnimo}
        />
        <Cifra
          rotulo="Sueño · 7 días"
          valor={sueno.actual === null ? '—' : formatoDecimal(sueno.actual)}
          unidad={sueno.actual === null ? undefined : 'h'}
          delta={sueno.delta}
          leido={
            sueno.actual === null
              ? 'Sueño medio de los últimos 7 días: faltan datos'
              : `Sueño medio de los últimos 7 días: ${formatoDecimal(sueno.actual)} horas`
          }
        />
        <Cifra
          rotulo={racha === 1 ? 'Día seguido' : 'Días seguidos'}
          valor={String(racha)}
          tono={racha > 0 ? 'gold' : 'text'}
          leido={`Racha de ${racha} ${racha === 1 ? 'día escrito' : 'días escritos'}`}
        />
      </View>
      {a.actual === null || sueno.actual === null ? (
        <Text style={styles.nota}>
          Una media necesita {MIN_DATOS_MEDIA} días con dato en la semana. Con menos sería una anécdota.
        </Text>
      ) : a.delta !== null ? (
        <Text style={styles.nota}>La flecha compara con los 7 días anteriores.</Text>
      ) : null}

      {hayCurvas ? (
        <View style={styles.curvas}>
          <View style={{ width: mitad }}>
            <Text style={styles.curvaRotulo}>Ánimo</Text>
            <TrendLine values={animo} width={mitad} height={64} unit="" />
          </View>
          <View style={{ width: mitad }}>
            <Text style={styles.curvaRotulo}>Energía</Text>
            <TrendLine values={energia} width={mitad} height={64} unit="" color={colors.accentText} />
          </View>
        </View>
      ) : null}

      {emociones.length > 0 ? (
        <View style={styles.emociones}>
          <Text style={styles.curvaRotulo}>Lo que más se repite · 14 días</Text>
          <View style={styles.emocionesFila}>
            {emociones.map((e) => (
              <View key={e.id} style={styles.emocion} accessible accessibilityLabel={`${e.label}, ${e.count} ${e.count === 1 ? 'día' : 'días'}`}>
                <Text style={styles.emocionTexto}>{e.label}</Text>
                <Text style={styles.emocionCuenta}>{e.count}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  cifras: { flexDirection: 'row', gap: 12 },
  cifra: { flex: 1, minWidth: 0 },
  cifraFila: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  cifraValor: { fontFamily: fonts.number, fontSize: 26, letterSpacing: 0.5, color: colors.text },
  cifraUnidad: { fontFamily: fonts.heading, fontSize: 12, letterSpacing: 1, color: colors.textDim },
  deltaFila: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  delta: { fontFamily: fonts.heading, fontSize: 12 },
  deltaIgual: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 2 },
  cifraRotulo: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textFaint,
    marginTop: 4,
  },
  nota: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textFaint, marginTop: 12 },
  curvas: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  curvaRotulo: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.textFaint,
    marginBottom: 6,
  },
  emociones: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line },
  emocionesFila: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  emocion: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.accentDim,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  emocionTexto: { fontFamily: fonts.semibold, fontSize: 12, color: colors.accentText },
  emocionCuenta: { fontFamily: fonts.number, fontSize: 12, color: colors.text },
});

// NIVL · Hoy: el duelo de la semana (HoyiPad.dc). Sustituye a la fila de
// rivalidad: tú y quien va justo delante (o detrás, si lideras), cada uno con
// su XP de la semana en Cinzel y su barra (la tuya blanca, la suya ink8), y
// debajo la línea del sistema. Todo el bloque abre Amigos.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Barra, formatoMiles } from '@/components/arena';
import { Section } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { fonts } from '@/lib/theme';
import type { DueloHoy, LadoDuelo } from './derivarHoy';

function Lado({ lado, rival }: { lado: LadoDuelo; rival?: boolean }) {
  return (
    <View style={styles.lado}>
      <View style={styles.fila}>
        <Text style={[styles.nombre, rival && styles.nombreRival]} numberOfLines={1} maxFontSizeMultiplier={1.35}>
          {lado.nombre}
        </Text>
        <Text style={[styles.xp, rival && styles.xpRival]} maxFontSizeMultiplier={1.35}>
          {formatoMiles(lado.xp)} XP
        </Text>
      </View>
      <Barra
        ratio={lado.ratio}
        desde={0}
        alto={4}
        tono={rival ? 'ink8' : 'blanco'}
        etiqueta={`${rival ? lado.nombre : 'Tu semana'}: ${formatoMiles(lado.xp)} XP`}
      />
    </View>
  );
}

export function Duelo({ duelo, style }: { duelo: DueloHoy; style?: StyleProp<ViewStyle> }) {
  return (
    <Section title="Duelo de la semana" style={style}>
      <Pressable
        onPress={() => router.push('/amigos')}
        accessibilityRole="button"
        accessibilityLabel={`${duelo.linea} Tú, ${formatoMiles(duelo.yo.xp)} XP${
          duelo.rival ? `; ${duelo.rival.nombre}, ${formatoMiles(duelo.rival.xp)} XP` : ''
        }. Abrir Amigos`}
        style={({ pressed }) => [styles.caja, pressed && styles.pulsado]}
      >
        <Lado lado={duelo.yo} />
        {duelo.rival ? <Lado lado={duelo.rival} rival /> : null}
        <View style={styles.pie}>
          <Text style={styles.linea} maxFontSizeMultiplier={1.35}>
            {duelo.linea}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={ink.ink6} />
        </View>
      </Pressable>
    </Section>
  );
}

const styles = StyleSheet.create({
  caja: { gap: space.s3 },
  pulsado: { opacity: 0.7 },
  lado: { gap: space.s2 },
  fila: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.s3 },
  nombre: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: ink.ink10 },
  nombreRival: { color: ink.ink8 },
  xp: { fontFamily: tipo.number.family, fontSize: 14, lineHeight: 18, color: ink.ink10 },
  xpRival: { color: ink.ink8 },
  pie: { flexDirection: 'row', alignItems: 'center', gap: space.s2, marginTop: space.s1 },
  linea: {
    flex: 1,
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
  },
});

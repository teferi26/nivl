// NIVL · Hoy: el rival cercano (HoyiPad.dc). Sustituye a la fila de
// rivalidad: tú y quien va justo delante (o detrás, si lideras), cada uno con
// su XP de la semana en Cinzel y su barra (la tuya blanca, la suya ink8), y
// debajo la línea del sistema. Todo el bloque abre Amigos. No es el duelo de
// Amigos (ese mide disciplina): aquí es el XP de 7 días.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Barra, formatoMiles } from '@/components/arena';
import { Section } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { fonts } from '@/lib/theme';
import { tituloRivalCercano, type DueloHoy, type LadoDuelo } from './derivarHoy';

function Lado({ lado, rival }: { lado: LadoDuelo; rival?: boolean }) {
  return (
    <View style={styles.lado}>
      <View style={styles.fila}>
        <Text style={[styles.nombre, rival && styles.nombreRival]} numberOfLines={1} maxFontSizeMultiplier={1.35}>
          {lado.nombre}
        </Text>
        <Text style={[styles.xp, rival && styles.xpRival]} maxFontSizeMultiplier={1.35}>{/* i18n-ok: unidad */}
          {formatoMiles(lado.xp)} XP
        </Text>
      </View>
      <Barra
        ratio={lado.ratio}
        desde={0}
        alto={4}
        tono={rival ? 'ink8' : 'blanco'}
        etiqueta={
          rival
            ? t('hoy:duelo.barraRival', { nombre: lado.nombre, xp: formatoMiles(lado.xp) })
            : t('hoy:duelo.tuSemana', { xp: formatoMiles(lado.xp) })
        }
      />
    </View>
  );
}

export function Duelo({ duelo, style }: { duelo: DueloHoy; style?: StyleProp<ViewStyle> }) {
  const titulo = tituloRivalCercano();
  const xp = formatoMiles(duelo.yo.xp);
  return (
    <Section title={titulo} style={style}>
      <Pressable
        onPress={() => router.push('/amigos')}
        accessibilityRole="button"
        accessibilityLabel={
          duelo.rival
            ? t('hoy:duelo.a11yRival', {
                titulo,
                linea: duelo.linea,
                xp,
                rival: duelo.rival.nombre,
                xpRival: formatoMiles(duelo.rival.xp),
              })
            : t('hoy:duelo.a11y', { titulo, linea: duelo.linea, xp })
        }
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

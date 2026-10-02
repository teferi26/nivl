// NIVL · Panel contextual de Hoy en `expanded` (<Screen aside>): el rango en
// grande, la rivalidad con los amigos y, con Pro, la entrada al coach. Si el
// panel no cabe, Screen no lo pinta y lo esencial (rango y rivalidad) sigue en
// el cuerpo de Hoy.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Row, Section, Skeleton } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import type { RangoId } from '@/lib/progression';
import type { Profile } from '@/lib/types';
import { TarjetaRango, type RachaHoy } from './TarjetaRango';

interface Props {
  /** Primera carga terminada. */
  loaded: boolean;
  profile: Profile | null;
  rango: RangoId | null;
  racha: RachaHoy;
  /** Línea de rivalidad (lineaRivalidad); null = sin amigos visibles. */
  rivalidad: string | null;
  /** true = la cuenta tiene coach. Sin Pro (o sin saberlo) no se pinta. */
  esPro: boolean | null;
}

export function PanelHoy({ loaded, profile, rango, racha, rivalidad, esPro }: Props) {
  if (!loaded || !profile) {
    return (
      <View accessibilityRole="progressbar" accessibilityLabel="Cargando tu rango">
        <Skeleton height={220} style={styles.hueco} />
        <Skeleton height={56} />
      </View>
    );
  }

  return (
    <View>
      <TarjetaRango profile={profile} rango={rango} racha={racha} grande />

      {rivalidad ? (
        <Section title="Amigos" style={styles.seccion}>
          <Card padded={false} style={styles.lista}>
            <Row
              first
              chevron
              leading={<Ionicons name="people-outline" size={18} color={ink.ink8} />}
              title={rivalidad}
              onPress={() => router.push('/amigos')}
              accessibilityLabel={`${rivalidad} Abrir Amigos`}
            />
          </Card>
        </Section>
      ) : null}

      {esPro === true ? (
        <Card
          variant="outline"
          onPress={() => router.push('/(tabs)/coach')}
          accessibilityLabel="Abrir el coach"
          style={styles.seccion}
        >
          <View style={styles.coach}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={ink.ink9} />
            <View style={styles.coachTexto}>
              <Text style={styles.coachTitulo}>Coach</Text>
              <Text style={styles.coachCuerpo}>Pídele el plan, ajusta el día o pregúntale.</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={ink.ink6} />
          </View>
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hueco: { marginBottom: space.s4 },
  seccion: { marginTop: space.s4 },
  lista: { paddingHorizontal: space.s4, paddingVertical: 2 },
  coach: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  coachTexto: { flex: 1, minWidth: 0 },
  coachTitulo: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink9,
  },
  coachCuerpo: { fontFamily: tipo.bodySm.family, fontSize: 13, lineHeight: 18, color: ink.ink8, marginTop: 2 },
});

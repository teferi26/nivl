// NIVL · Panel contextual de Hoy en `expanded` (<Screen aside>, HoyiPad.dc):
// con Pro, la entrada al coach con su marca; debajo, el duelo de la semana
// (que entonces no se repite en el cuerpo). El rango ya no va aquí: el Hero
// lo lleva a lo ancho en el cuerpo. Si el panel no cabe, Screen no lo pinta
// y el duelo vuelve al cuerpo de Hoy.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { TarjetaArena } from '@/components/arena';
import { CoachMark } from '@/components/coach/CoachMark';
import { Skeleton } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import type { DueloHoy } from './derivarHoy';
import { Duelo } from './Duelo';

interface Props {
  /** Primera carga sin terminar: huecos. */
  cargando: boolean;
  /** true = la cuenta tiene coach. Sin Pro (o sin saberlo) no se pinta. */
  esPro: boolean | null;
  duelo: DueloHoy | null;
}

export function PanelHoy({ cargando, esPro, duelo }: Props) {
  if (cargando) {
    return (
      <View accessibilityRole="progressbar" accessibilityLabel="Cargando el panel">
        <Skeleton height={96} style={styles.hueco} />
        <Skeleton height={11} width={140} style={styles.hueco} />
        <Skeleton height={72} />
      </View>
    );
  }

  return (
    <View>
      {esPro === true ? (
        <TarjetaArena
          variante="contorno"
          onPress={() => router.push('/(tabs)/coach')}
          accessibilityLabel="Abrir el coach. Pídele el plan, ajusta el día o pregúntale."
          style={styles.coach}
        >
          <View style={styles.coachFila}>
            <CoachMark size={48} />
            <View style={styles.coachTexto}>
              <Text style={styles.coachTitulo} maxFontSizeMultiplier={1.35}>
                COACH
              </Text>
              <Text style={styles.coachCuerpo} maxFontSizeMultiplier={1.35}>
                Pídele el plan, ajusta el día o pregúntale.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={ink.ink6} />
          </View>
        </TarjetaArena>
      ) : null}

      {duelo ? <Duelo duelo={duelo} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hueco: { marginBottom: space.s4 },
  coach: { marginBottom: space.s6 },
  coachFila: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  coachTexto: { flex: 1, minWidth: 0, gap: space.s1 },
  coachTitulo: {
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    lineHeight: tipo.inscripcion.lineHeight,
    letterSpacing: tipo.inscripcion.tracking,
    color: ink.ink10,
  },
  coachCuerpo: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
  },
});

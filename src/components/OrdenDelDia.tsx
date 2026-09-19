import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TextoSistema } from '@/components/TextoSistema';
import { Card, EmptyState, Section } from '@/components/ui';
import {
  bloqueActual,
  hhmm,
  KIND_ICON,
  minutosAhora,
  progresoDelPlan,
  type DayBlock,
  type DayPlan,
} from '@/lib/dayplan';
import { colors, fonts } from '@/lib/theme';

interface Props {
  plan: DayPlan | null;
  bloques: DayBlock[];
  onToggle: (b: DayBlock) => void;
  /**
   * La cuenta tiene coach. Sin coach y sin plan esta sección NO se pinta: su
   * único botón ("Pedir el plan") llevaba a un coach con candado. Hoy ofrece
   * Pro en una línea discreta bajo las misiones.
   */
  pro?: boolean;
}

// El plan del día como una línea de tiempo: hora a la izquierda, un hilo
// vertical con un punto por bloque, el bloque actual encendido. Si el coach
// no ha escrito nada, se dice claro y se ofrece el camino.
export const OrdenDelDia = memo(function OrdenDelDia({ plan, bloques, onToggle, pro = true }: Props) {
  if (!plan || !bloques.length) {
    if (!pro) return null;
    return (
      <Section title="Orden del día">
        <Card variant="outline">
          <EmptyState
            compact
            icon="list-outline"
            title="Sin órdenes para hoy"
            body="Pídele el plan al coach y tendrás el día escrito bloque a bloque."
            action={{ label: 'Pedir el plan', onPress: () => router.push('/(tabs)/coach') }}
          />
        </Card>
      </Section>
    );
  }

  const ahora = minutosAhora();
  const actual = bloqueActual(bloques, ahora);
  const { hechos, total } = progresoDelPlan(bloques);

  return (
    <Section title="Orden del día" meta={`${hechos}/${total}`}>
      {plan.verdict ? (
        <View style={styles.veredicto}>
          <Text style={styles.veredictoTexto}>{plan.verdict}</Text>
        </View>
      ) : null}
      {plan.brief ? (
        <View style={styles.brief}>
          <TextoSistema texto={plan.brief} tono="tenue" />
        </View>
      ) : null}

      <View style={styles.linea}>
        {bloques.map((b, i) => {
          const esActual = actual?.id === b.id;
          const pasado = b.end_min <= ahora;
          const ultimo = i === bloques.length - 1;
          return (
            <Pressable
              key={b.id}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onToggle(b);
              }}
              style={({ pressed }) => [styles.bloque, pressed && styles.pressed]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: b.done }}
              accessibilityLabel={`${hhmm(b.start_min)} ${b.title}${b.done ? ', hecho' : ''}`}
            >
              <View style={styles.horas}>
                <Text style={[styles.hora, esActual && styles.horaActual, b.done && styles.horaHecha]}>{hhmm(b.start_min)}</Text>
                <Text style={styles.horaFin}>{hhmm(b.end_min)}</Text>
              </View>
              <View style={styles.hilo}>
                <View
                  style={[
                    styles.punto,
                    b.done && styles.puntoHecho,
                    esActual && !b.done && styles.puntoActual,
                    pasado && !b.done && styles.puntoPerdido,
                  ]}
                >
                  {b.done ? <Ionicons name="checkmark" size={10} color={colors.bg} /> : null}
                </View>
                {!ultimo ? <View style={[styles.hiloLinea, b.done && styles.hiloHecho]} /> : null}
              </View>
              <View style={[styles.cuerpo, esActual && styles.cuerpoActual]}>
                <View style={styles.tituloFila}>
                  <Ionicons
                    name={KIND_ICON[b.kind] as never}
                    size={13}
                    color={esActual ? colors.accent : colors.textFaint}
                  />
                  <Text
                    style={[styles.bloqueTitulo, b.done && styles.tachado, pasado && !b.done && styles.perdido]}
                    numberOfLines={2}
                  >
                    {b.title}
                  </Text>
                  {esActual && !b.done ? <Text style={styles.ahora}>AHORA</Text> : null}
                </View>
                {b.detail ? (
                  <Text style={styles.detalle} numberOfLines={esActual ? undefined : 2}>
                    {b.detail}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Section>
  );
});

const styles = StyleSheet.create({
  veredicto: {
    borderLeftWidth: 2,
    borderLeftColor: colors.gold,
    paddingLeft: 12,
    marginBottom: 12,
  },
  veredictoTexto: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textDim,
  },
  brief: { marginBottom: 14 },
  linea: {},
  bloque: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  pressed: { opacity: 0.7 },
  horas: { width: 44, paddingTop: 2, alignItems: 'flex-end' },
  hora: { fontFamily: fonts.number, fontSize: 12, color: colors.textDim },
  horaActual: { color: colors.accent },
  horaHecha: { color: colors.textFaint },
  horaFin: { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint, marginTop: 1 },
  hilo: { width: 18, alignItems: 'center' },
  punto: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.accentDim,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  puntoHecho: { backgroundColor: colors.accent, borderColor: colors.accent },
  puntoActual: { borderColor: colors.accent, borderWidth: 2 },
  puntoPerdido: { borderColor: colors.line },
  hiloLinea: { flex: 1, width: 1, backgroundColor: colors.line, marginVertical: 3 },
  hiloHecho: { backgroundColor: colors.accentDim },
  cuerpo: { flex: 1, minWidth: 0, paddingBottom: 16, paddingTop: 1 },
  cuerpoActual: {},
  tituloFila: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  bloqueTitulo: { flex: 1, fontFamily: fonts.semibold, fontSize: 14.5, lineHeight: 19, color: colors.text },
  ahora: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 1.2, color: colors.bg, backgroundColor: colors.accent, paddingHorizontal: 5, paddingVertical: 1 },
  tachado: { textDecorationLine: 'line-through', color: colors.textFaint },
  perdido: { color: colors.textDim },
  detalle: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.textDim,
    marginTop: 3,
    marginLeft: 20,
  },
});

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TarjetaArena } from '@/components/arena';
import { TextoSistema } from '@/components/TextoSistema';
import { Check, EmptyState, Section } from '@/components/ui';
import { vibrar } from '@/design/haptics';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
// De plan.ts (puro) y no de dayplan.ts: la vista no arrastra Supabase.
import {
  bloqueActual,
  hhmm,
  KIND_ICON,
  minutosAhora,
  progresoDelPlan,
  type DayBlock,
  type DayPlan,
} from '@/lib/plan';
import { fonts } from '@/lib/theme';

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
  /** Minutos del día que cuentan como «ahora» (la galería lo fija). */
  ahora?: number;
}

// El plan del día como un orden escrito (HoyiPad.dc): la hora en Cinzel en
// una columna de 48, el bloque con su hairline y el bloque ACTUAL marcado con
// una regla de 2 en blanco a la izquierda (contorno, no inversión: la de Hoy es
// la misión siguiente). A la derecha, el aro que lo da por hecho.
export const OrdenDelDia = memo(function OrdenDelDia({ plan, bloques, onToggle, pro = true, ahora: ahoraFijo }: Props) {
  if (!plan || !bloques.length) {
    if (!pro) return null;
    return (
      <Section title="Orden del día">
        <TarjetaArena variante="contorno">
          <EmptyState
            compact
            icon="list-outline"
            title="Sin órdenes para hoy"
            body="Pídele el plan al coach y tendrás el día escrito bloque a bloque."
            action={{ label: 'Pedir el plan', onPress: () => router.push('/(tabs)/coach') }}
          />
        </TarjetaArena>
      </Section>
    );
  }

  const ahora = ahoraFijo ?? minutosAhora();
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

      <View>
        {bloques.map((b, i) => {
          const esActual = actual?.id === b.id && !b.done;
          const pasado = b.end_min <= ahora;
          return (
            <Pressable
              key={b.id}
              onPress={() => {
                vibrar('seleccion');
                onToggle(b);
              }}
              style={({ pressed }) => [styles.bloque, i > 0 && styles.sep, pressed && styles.pressed]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: b.done }}
              accessibilityLabel={`${hhmm(b.start_min)} ${b.title}${esActual ? ', ahora' : ''}${b.done ? ', hecho' : ''}`}
            >
              <View style={styles.horas}>
                <Text style={[styles.hora, esActual && styles.horaActual]} maxFontSizeMultiplier={1.35}>
                  {hhmm(b.start_min)}
                </Text>
                <Text style={styles.horaFin} maxFontSizeMultiplier={1.35}>
                  {hhmm(b.end_min)}
                </Text>
              </View>
              <View style={[styles.cuerpo, esActual && styles.cuerpoActual]}>
                <View style={styles.tituloFila}>
                  <Ionicons name={KIND_ICON[b.kind] as never} size={13} color={esActual ? ink.ink10 : ink.ink6} />
                  <Text
                    style={[styles.bloqueTitulo, b.done && styles.tachado, pasado && !b.done && styles.perdido]}
                    numberOfLines={2}
                  >
                    {b.title}
                  </Text>
                  {esActual ? <Text style={styles.ahora}>AHORA</Text> : null}
                </View>
                {b.detail ? (
                  <Text style={styles.detalle} numberOfLines={esActual ? undefined : 2}>
                    {b.detail}
                  </Text>
                ) : null}
              </View>
              <Check checked={b.done} size={22} />
            </Pressable>
          );
        })}
      </View>
    </Section>
  );
});

const styles = StyleSheet.create({
  veredicto: {
    borderLeftWidth: stroke.rule,
    borderLeftColor: ink.ink10,
    paddingLeft: space.s3,
    marginBottom: space.s3,
  },
  veredictoTexto: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
  },
  brief: { marginBottom: 14 },
  bloque: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s3, paddingVertical: space.s3, minHeight: 48 },
  sep: { borderTopWidth: stroke.hairline, borderTopColor: ink.ink3 },
  pressed: { opacity: 0.7 },
  horas: { width: 48, paddingTop: 1 },
  hora: { fontFamily: tipo.number.family, fontSize: 13, lineHeight: 18, color: ink.ink6 },
  horaActual: { color: ink.ink10 },
  horaFin: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    color: ink.ink6,
  },
  cuerpo: { flex: 1, minWidth: 0 },
  // El bloque de ahora: regla de 2 en blanco a la izquierda.
  cuerpoActual: { borderLeftWidth: stroke.rule, borderLeftColor: ink.ink10, paddingLeft: space.s3 },
  tituloFila: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  bloqueTitulo: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: ink.ink9 },
  // Contorno, no inversión: la inversión de Hoy es una sola (SISTEMA §0).
  ahora: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    letterSpacing: 1.2,
    color: ink.ink10,
    borderWidth: stroke.hairline,
    borderColor: ink.ink10,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tachado: { textDecorationLine: 'line-through', color: ink.ink6 },
  perdido: { color: ink.ink8 },
  detalle: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    marginTop: 3,
    marginLeft: 20,
  },
});

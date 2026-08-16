import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SystemWindow } from '@/components/SystemWindow';
import { TextoSistema } from '@/components/TextoSistema';
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
}

// El plan del día: lo primero que se ve al abrir la app. Si el coach no ha
// escrito nada, se dice claro y se ofrece el camino, en vez de dejar un hueco.
export const OrdenDelDia = memo(function OrdenDelDia({ plan, bloques, onToggle }: Props) {
  if (!plan || !bloques.length) {
    return (
      <SystemWindow>
        <Text style={styles.titulo}>ORDEN DEL DÍA</Text>
        <Text style={styles.vacio}>
          El sistema no ha dictado órdenes para hoy. Pídeselas al coach y tendrás el día escrito
          bloque a bloque.
        </Text>
        <Pressable
          onPress={() => router.push('/(tabs)/coach')}
          style={styles.cta}
          accessibilityRole="button"
          accessibilityLabel="Pedir el plan del día al coach"
        >
          <Text style={styles.ctaTexto}>PEDIR EL PLAN</Text>
        </Pressable>
      </SystemWindow>
    );
  }

  const ahora = minutosAhora();
  const actual = bloqueActual(bloques, ahora);
  const { hechos, total } = progresoDelPlan(bloques);

  return (
    <SystemWindow>
      <View style={styles.cabecera}>
        <Text style={styles.titulo}>ORDEN DEL DÍA</Text>
        <Text style={styles.progreso}>
          {hechos}/{total}
        </Text>
      </View>

      {plan.verdict ? (
        <View style={styles.veredicto}>
          <Text style={styles.veredictoTexto}>{plan.verdict}</Text>
        </View>
      ) : null}

      {plan.brief ? <TextoSistema texto={plan.brief} tono="tenue" /> : null}

      <View style={styles.bloques}>
        {bloques.map((b) => {
          const esActual = actual?.id === b.id;
          const pasado = b.end_min <= ahora;
          return (
            <Pressable
              key={b.id}
              onPress={() => {
                Haptics.selectionAsync();
                onToggle(b);
              }}
              style={[styles.bloque, esActual && styles.bloqueActual]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: b.done }}
              accessibilityLabel={`${hhmm(b.start_min)} ${b.title}${b.done ? ', hecho' : ''}`}
            >
              <View style={[styles.marca, b.done && styles.marcaHecha]}>
                {b.done ? <Ionicons name="checkmark" size={13} color={colors.bg} /> : null}
              </View>
              <View style={styles.horas}>
                <Text style={[styles.hora, esActual && styles.horaActual]}>{hhmm(b.start_min)}</Text>
                <Text style={styles.horaFin}>{hhmm(b.end_min)}</Text>
              </View>
              <View style={styles.cuerpo}>
                <View style={styles.tituloFila}>
                  <Ionicons
                    name={KIND_ICON[b.kind] as never}
                    size={13}
                    color={esActual ? colors.cyan : colors.textFaint}
                  />
                  <Text
                    style={[
                      styles.bloqueTitulo,
                      b.done && styles.tachado,
                      pasado && !b.done && styles.perdido,
                    ]}
                    numberOfLines={2}
                  >
                    {b.title}
                  </Text>
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
    </SystemWindow>
  );
});

const styles = StyleSheet.create({
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  titulo: {
    fontFamily: fonts.heading,
    fontSize: 13,
    letterSpacing: 2.5,
    color: colors.cyanText,
  },
  progreso: {
    fontFamily: fonts.number,
    fontSize: 13,
    color: colors.text,
  },
  veredicto: {
    borderLeftWidth: 2,
    borderLeftColor: colors.amber,
    paddingLeft: 10,
    marginBottom: 10,
  },
  veredictoTexto: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textDim,
  },
  brief: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
    marginBottom: 12,
  },
  bloques: { gap: 2 },
  bloque: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  bloqueActual: {
    backgroundColor: colors.cyanFaint,
    borderLeftWidth: 2,
    borderLeftColor: colors.cyan,
  },
  marca: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: colors.cyanDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  marcaHecha: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  horas: { width: 42 },
  hora: {
    fontFamily: fonts.number,
    fontSize: 12,
    color: colors.textDim,
  },
  horaActual: { color: colors.cyan },
  horaFin: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textFaint,
  },
  cuerpo: { flex: 1, minWidth: 0 },
  tituloFila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bloqueTitulo: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 13.5,
    color: colors.text,
  },
  tachado: { textDecorationLine: 'line-through', color: colors.textFaint },
  perdido: { color: colors.textDim },
  detalle: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textDim,
    marginTop: 3,
    marginLeft: 19,
  },
  vacio: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textDim,
    marginBottom: 12,
  },
  cta: {
    borderWidth: 1.5,
    borderColor: colors.cyan,
    paddingVertical: 10,
    alignItems: 'center',
  },
  ctaTexto: {
    fontFamily: fonts.heading,
    fontSize: 13,
    letterSpacing: 2,
    color: colors.cyan,
  },
});

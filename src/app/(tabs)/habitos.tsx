import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QuestForm } from '@/components/QuestForm';
import { SystemButton } from '@/components/SystemButton';
import { SystemWindow } from '@/components/SystemWindow';
import { useAuth } from '@/lib/auth';
import { createQuest, deleteQuest, ensureProfile, updateQuest } from '@/lib/data';
import { dateKey } from '@/lib/dates';
import { awardXp } from '@/lib/engine';
import { desmarcarRegla, fetchRuleChecks, fetchRules, marcarReglaCumplida } from '@/lib/contract';
import { HABIT_ACQUIRED_XP, RULE_BREAK_XP } from '@/lib/game';
import {
  consolidarHabito,
  fetchHabitos,
  fetchFechasPorHabito,
  reactivarHabito,
} from '@/lib/habitdata';
import { HABIT_TARGET_DAYS, ordenarPorCercania, progresoHabito, type ProgresoHabito } from '@/lib/habits';
import { colors, fonts } from '@/lib/theme';
import type { Quest, Rule } from '@/lib/types';

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function Barra({ p }: { p: ProgresoHabito }) {
  const ratio = Math.min(1, p.racha / p.objetivo);
  return (
    <View style={styles.pista}>
      <View style={[styles.relleno, { width: `${ratio * 100}%` }, p.consolidable && styles.rellenoListo]} />
    </View>
  );
}

export default function Habitos() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const hoy = dateKey();

  const [enCurso, setEnCurso] = useState<Quest[]>([]);
  const [adquiridos, setAdquiridos] = useState<Quest[]>([]);
  const [progresos, setProgresos] = useState<Map<string, ProgresoHabito>>(new Map());
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Quest | null>(null);
  const [busy, setBusy] = useState(false);
  const [reglas, setReglas] = useState<Rule[]>([]);
  const [cumplidas, setCumplidas] = useState<Set<string>>(new Set());
  const pendientesReglas = reglas.filter((r) => !cumplidas.has(r.id)).length;

  const cargar = useCallback(async () => {
    try {
      const todos = await fetchHabitos();
      const fechas = await fetchFechasPorHabito();
      const mapa = new Map<string, ProgresoHabito>();
      for (const q of todos) mapa.set(q.id, progresoHabito(q, fechas.get(q.id) ?? new Set(), hoy));
      setProgresos(mapa);
      setEnCurso(ordenarPorCercania(todos.filter((q) => !q.acquired_at), mapa));
      setAdquiridos(todos.filter((q) => q.acquired_at));
      const [rs, checks] = await Promise.all([fetchRules(), fetchRuleChecks(hoy)]);
      setReglas(rs);
      setCumplidas(checks);
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    }
  }, [hoy]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  /**
   * Marcar una regla del contrato como cumplida hoy.
   *
   * Es optimista a propósito: son seis toques seguidos cada noche y esperar a
   * la red en cada uno haría que se sintiera rota. Si falla, se revierte.
   */
  const alternarRegla = async (r: Rule) => {
    if (!userId) return;
    const estaba = cumplidas.has(r.id);
    setCumplidas((prev) => {
      const s = new Set(prev);
      if (estaba) s.delete(r.id);
      else s.add(r.id);
      return s;
    });
    try {
      if (estaba) await desmarcarRegla(r.id, hoy);
      else await marcarReglaCumplida(userId, r.id, hoy);
      if (!estaba) Haptics.selectionAsync().catch(() => {});
    } catch (e) {
      setCumplidas((prev) => {
        const s = new Set(prev);
        if (estaba) s.add(r.id);
        else s.delete(r.id);
        return s;
      });
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    }
  };

  const consolidar = (q: Quest, p: ProgresoHabito) => {
    Alert.alert(
      'HÁBITO ADQUIRIDO',
      `${q.title} lleva ${p.racha} días seguidos.\n\nSi lo consolidas deja de pedirte el toque diario y deja de poder romperte la racha. Puedes seguir marcándolo cuando quieras.\n\nSi prefieres seguir contando, no pasa nada: sigue sumando.`,
      [
        { text: 'Seguir contando', style: 'cancel' },
        {
          text: 'Consolidar',
          onPress: async () => {
            if (!userId || busy) return;
            setBusy(true);
            try {
              await consolidarHabito(q.id, p.racha);
              const perfil = await ensureProfile(userId);
              await awardXp(perfil, HABIT_ACQUIRED_XP, q.stat, 'habit_acquired', {
                quest: q.title,
                dias: p.racha,
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await cargar();
              Alert.alert(
                'El sistema lo da por tuyo',
                `${q.title} ya no se te va a pedir.\n+${HABIT_ACQUIRED_XP} XP a ${q.stat}.`,
              );
            } catch (e) {
              Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const reactivar = (q: Quest) =>
    Alert.alert('Volver a exigirlo', `${q.title} vuelve a pedirse cada día y vuelve a contar para la racha.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Volver a exigirlo',
        onPress: async () => {
          await reactivarHabito(q.id).catch(() => {});
          await cargar();
        },
      },
    ]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>HÁBITOS</Text>
          <Pressable
            onPress={() => setFormOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Nuevo hábito"
          >
            <Ionicons name="add" size={24} color={colors.accent} />
          </Pressable>
        </View>

        <SystemWindow color={colors.accentDim}>
          <Text style={styles.intro}>
            Un hábito se da por adquirido a los {HABIT_TARGET_DAYS} días seguidos. A partir de ahí
            decides tú: puedes consolidarlo —deja de pedírsete y deja de poder romperte la racha— o
            seguir contando.
          </Text>
          <Text style={[styles.intro, { marginTop: 10 }]}>
            Toca cualquier hábito para editarlo o eliminarlo. El sistema también puede quitártelos
            si se lo pides.
          </Text>
        </SystemWindow>

        {reglas.length > 0 ? (
          <>
            <Text style={styles.seccion}>REGLAS DEL CONTRATO · HOY</Text>
            <SystemWindow color={pendientesReglas > 0 ? colors.redDim : colors.accentDim}>
              <Text style={styles.introReglas}>
                {pendientesReglas === 0
                  ? 'Las has cumplido todas hoy. El sistema toma nota.'
                  : `Marca las que hayas cumplido. Lo que quede sin marcar al cerrar el día cuenta como roto: ${RULE_BREAK_XP} XP por regla y su consecuencia mañana.`}
              </Text>
              {reglas.map((r) => {
                const ok = cumplidas.has(r.id);
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => alternarRegla(r)}
                    style={styles.reglaFila}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: ok }}
                    accessibilityLabel={r.text}
                  >
                    <View style={[styles.caja, ok && styles.cajaOn]}>
                      {ok ? <Ionicons name="checkmark" size={13} color={colors.bg} /> : null}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.reglaTexto, ok && styles.reglaHecha]}>{r.text}</Text>
                      {!ok ? (
                        <Text style={styles.reglaConsecuencia}>si no: {r.consequence}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </SystemWindow>
          </>
        ) : null}

        {enCurso.length === 0 && adquiridos.length === 0 ? (
          <SystemWindow>
            <Text style={styles.vacio}>
              No tienes hábitos en construcción. Añade el primero: lectura, skincare, correr, nadar,
              los correos, las llamadas en frío. Lo que quieras que un día te salga solo.
            </Text>
          </SystemWindow>
        ) : null}

        {enCurso.map((q) => {
          const p = progresos.get(q.id);
          if (!p) return null;
          return (
            <Pressable
              key={q.id}
              onPress={() => {
                setEditando(q);
                setFormOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Editar ${q.title}`}
            >
            <SystemWindow color={p.consolidable ? colors.accent : colors.accentDim}>
              <View style={styles.fila}>
                <Text style={styles.nombre} numberOfLines={1}>
                  {q.title}
                </Text>
                <Text style={[styles.racha, p.consolidable && styles.rachaListo]}>
                  {p.racha}/{p.objetivo}
                </Text>
              </View>
              <Barra p={p} />
              <View style={styles.metaFila}>
                <Text style={styles.dias}>
                  {DIAS.filter((_, i) => q.days_of_week.includes(i + 1)).join(' ') || '—'}
                </Text>
                <Text style={styles.meta}>
                  {p.consolidable
                    ? 'Listo para consolidar'
                    : p.restantes === 1
                      ? 'Falta 1 día'
                      : `Faltan ${p.restantes} días`}
                </Text>
              </View>
              <View style={styles.metaFila}>
                <Text style={styles.dias}>Tocar para editar o eliminar</Text>
              </View>
              {p.consolidable ? (
                <SystemButton
                  title="Darlo por adquirido"
                  onPress={() => consolidar(q, p)}
                  loading={busy}
                  style={{ marginTop: 12 }}
                />
              ) : null}
            </SystemWindow>
            </Pressable>
          );
        })}

        {adquiridos.length > 0 ? (
          <>
            <Text style={styles.seccion}>ADQUIRIDOS</Text>
            {adquiridos.map((q) => (
              <Pressable
                key={q.id}
                onLongPress={() => reactivar(q)}
                accessibilityRole="button"
                accessibilityLabel={`${q.title}, adquirido. Mantén pulsado para volver a exigirlo.`}
              >
                <SystemWindow color={colors.line}>
                  <View style={styles.fila}>
                    <View style={styles.filaIcono}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
                      <Text style={styles.nombreAdq} numberOfLines={1}>
                        {q.title}
                      </Text>
                    </View>
                    <Text style={styles.meta}>{q.acquired_streak ?? '—'} días</Text>
                  </View>
                  <Text style={styles.metaTenue}>
                    Ya no se te pide. Mantén pulsado si quieres volver a exigirlo.
                  </Text>
                </SystemWindow>
              </Pressable>
            ))}
          </>
        ) : null}
      </ScrollView>

      <QuestForm
        visible={formOpen}
        initial={editando}
        onClose={() => {
          setFormOpen(false);
          setEditando(null);
        }}
        onSubmit={async (input) => {
          if (editando) await updateQuest(editando.id, input);
          else if (userId) await createQuest(userId, input);
          setFormOpen(false);
          setEditando(null);
          await cargar();
        }}
        onDelete={async (q) => {
          await deleteQuest(q.id);
          setFormOpen(false);
          setEditando(null);
          await cargar();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: { fontFamily: fonts.heading, fontSize: 15, letterSpacing: 3, color: colors.text },
  intro: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.textDim },
  vacio: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.textDim },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  filaIcono: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 },
  nombre: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text, flex: 1, minWidth: 0 },
  nombreAdq: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textDim, flex: 1, minWidth: 0 },
  racha: { fontFamily: fonts.number, fontSize: 15, color: colors.accentText },
  rachaListo: { color: colors.accent },
  pista: { height: 6, backgroundColor: colors.track, marginTop: 10 },
  relleno: { height: 6, backgroundColor: colors.accentDim },
  rellenoListo: { backgroundColor: colors.accent },
  metaFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  dias: { fontFamily: fonts.heading, fontSize: 11.5, letterSpacing: 2, color: colors.textFaint },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim },
  metaTenue: { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint, marginTop: 6 },
  introReglas: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textDim, marginBottom: 8 },
  reglaFila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  caja: {
    width: 19,
    height: 19,
    borderWidth: 1.5,
    borderColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  cajaOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  reglaTexto: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text, lineHeight: 19 },
  reglaHecha: { color: colors.textDim, textDecorationLine: 'line-through' },
  reglaConsecuencia: { fontFamily: fonts.body, fontSize: 11.5, color: colors.red, marginTop: 2 },
  seccion: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 2.5,
    color: colors.textFaint,
    marginTop: 18,
    marginBottom: 8,
  },
});

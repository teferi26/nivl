import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { QuestForm } from '@/components/QuestForm';
import { SystemButton } from '@/components/SystemButton';
import { XPBar } from '@/components/XPBar';
import { Card, Check, EmptyState, FadeIn, Row, RowValue, Screen, ScreenHeader, Section, Stagger, Stat, StatRow } from '@/components/ui';
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

/** Los siete días de la semana: los programados en blanco, el resto en hierro. */
function Semana({ dias }: { dias: number[] }) {
  return (
    <View style={styles.semana}>
      {DIAS.map((d, i) => {
        const on = dias.includes(i + 1);
        return (
          <View key={d} style={[styles.dia, on && styles.diaOn]}>
            <Text style={[styles.diaTexto, on && styles.diaTextoOn]}>{d}</Text>
          </View>
        );
      })}
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

  const listos = enCurso.filter((q) => progresos.get(q.id)?.consolidable).length;
  const mejorRacha = Math.max(0, ...enCurso.map((q) => progresos.get(q.id)?.racha ?? 0));

  return (
    <Screen>
      <Stagger>
        <FadeIn index={0}>
          <ScreenHeader
            eyebrow="Constancia"
            title="Hábitos"
            subtitle={`A los ${HABIT_TARGET_DAYS} días seguidos un hábito es tuyo. Cada uno cuenta su propia racha.`}
            action={{ icon: 'add', label: 'Nuevo hábito', onPress: () => setFormOpen(true), solid: true }}
          />
        </FadeIn>

        <FadeIn index={1}>
          <Card>
            <StatRow>
              <Stat value={enCurso.length} label="En forja" />
              <Stat value={mejorRacha} label="Mejor racha" unit="d" tone={mejorRacha >= HABIT_TARGET_DAYS ? 'gold' : 'text'} />
              <Stat value={listos} label="Listos" tone={listos > 0 ? 'accent' : 'text'} />
              <Stat value={adquiridos.length} label="Adquiridos" />
            </StatRow>
          </Card>
        </FadeIn>

        {reglas.length > 0 ? (
          <FadeIn index={2}>
            <Section
              title="Reglas del contrato · hoy"
              tone={pendientesReglas > 0 ? 'red' : 'accent'}
              meta={`${reglas.length - pendientesReglas}/${reglas.length}`}
            >
              <Card padded={false} style={styles.lista} accent={pendientesReglas > 0 ? colors.red : undefined}>
                {reglas.map((r, i) => {
                  const ok = cumplidas.has(r.id);
                  return (
                    <Row
                      key={r.id}
                      first={i === 0}
                      leading={<Check checked={ok} size={24} />}
                      title={r.text}
                      done={ok}
                      detail={!ok ? `Si no: ${r.consequence}` : undefined}
                      onPress={() => alternarRegla(r)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: ok }}
                    />
                  );
                })}
              </Card>
              <Text style={styles.nota}>
                {pendientesReglas === 0
                  ? 'Las has cumplido todas hoy. El sistema toma nota.'
                  : `Lo que quede sin marcar al cierre cuenta como roto: ${RULE_BREAK_XP} XP por regla y su consecuencia mañana.`}
              </Text>
            </Section>
          </FadeIn>
        ) : null}

        <FadeIn index={3}>
          <Section title="En forja" meta={enCurso.length > 0 ? `${enCurso.length}` : undefined}>
            {enCurso.length === 0 && adquiridos.length === 0 ? (
              <Card variant="outline">
                <EmptyState
                  icon="repeat-outline"
                  title="Ningún hábito en forja"
                  body="Lectura, correr, las llamadas en frío, dormir a tu hora. Lo que quieras que un día te salga solo."
                  action={{ label: 'Añadir el primero', onPress: () => setFormOpen(true), variant: 'solid' }}
                />
              </Card>
            ) : null}

            {enCurso.map((q, i) => {
              const p = progresos.get(q.id);
              if (!p) return null;
              return (
                <FadeIn key={q.id} index={i}>
                  <Card
                    onPress={() => {
                      setEditando(q);
                      setFormOpen(true);
                    }}
                    accent={p.consolidable ? colors.gold : undefined}
                    accessibilityLabel={`Editar ${q.title}`}
                  >
                    <View style={styles.fila}>
                      <Text style={styles.nombre} numberOfLines={1}>
                        {q.title}
                      </Text>
                      <Text style={[styles.racha, p.consolidable && styles.rachaListo]}>
                        {p.racha}
                        <Text style={styles.rachaObjetivo}> / {p.objetivo}</Text>
                      </Text>
                    </View>
                    <View style={{ marginTop: 10 }}>
                      <XPBar
                        ratio={Math.min(1, p.racha / p.objetivo)}
                        height={8}
                        segments={p.objetivo}
                        color={p.consolidable ? colors.gold : colors.accent}
                      />
                    </View>
                    <View style={styles.metaFila}>
                      <Semana dias={q.days_of_week} />
                      <Text style={[styles.meta, p.consolidable && styles.metaListo]}>
                        {p.consolidable
                          ? 'Listo para consolidar'
                          : p.restantes === 1
                            ? 'Falta 1 día'
                            : `Faltan ${p.restantes} días`}
                      </Text>
                    </View>
                    {p.consolidable ? (
                      <SystemButton
                        title="Darlo por adquirido"
                        onPress={() => consolidar(q, p)}
                        loading={busy}
                        icon="ribbon-outline"
                        style={{ marginTop: 14 }}
                      />
                    ) : null}
                  </Card>
                </FadeIn>
              );
            })}
          </Section>
        </FadeIn>

        {adquiridos.length > 0 ? (
          <FadeIn index={4}>
            <Section title="Adquiridos" meta={`${adquiridos.length}`} tone="gold">
              <Card padded={false} style={styles.lista}>
                {adquiridos.map((q, i) => (
                  <Row
                    key={q.id}
                    first={i === 0}
                    leading={<Ionicons name="ribbon" size={18} color={colors.gold} />}
                    title={q.title}
                    muted
                    detail="Ya no se te pide. Mantén pulsado para volver a exigirlo."
                    trailing={<RowValue tone="gold">{q.acquired_streak ?? '—'} d</RowValue>}
                    onLongPress={() => reactivar(q)}
                    accessibilityLabel={`${q.title}, adquirido. Mantén pulsado para volver a exigirlo.`}
                  />
                ))}
              </Card>
            </Section>
          </FadeIn>
        ) : null}
      </Stagger>

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  lista: { paddingHorizontal: 16, paddingVertical: 2 },
  nota: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textFaint, marginTop: 2 },
  fila: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  nombre: { fontFamily: fonts.heading, fontSize: 17, letterSpacing: -0.2, color: colors.text, flex: 1, minWidth: 0 },
  racha: { fontFamily: fonts.number, fontSize: 18, color: colors.text },
  rachaListo: { color: colors.gold },
  rachaObjetivo: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
  metaFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 10 },
  semana: { flexDirection: 'row', gap: 4 },
  dia: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  diaOn: { backgroundColor: colors.accentFaint, borderColor: colors.accentDim },
  diaTexto: { fontFamily: fonts.heading, fontSize: 9.5, color: colors.textFaint },
  diaTextoOn: { color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim, flexShrink: 1, textAlign: 'right' },
  metaListo: { color: colors.gold, fontFamily: fonts.semibold },
});

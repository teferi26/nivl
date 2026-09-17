import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Heatmap } from '@/components/Heatmap';
import { SystemButton } from '@/components/SystemButton';
import { XPBar } from '@/components/XPBar';
import {
  Card,
  Chip,
  EmptyState,
  FadeIn,
  ProgressRing,
  Row,
  Screen,
  ScreenHeader,
  Section,
  Stagger,
  Stat,
  StatRow,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { questsScheduledOn } from '@/lib/closing';
import { createQuest, ensureProfile, fetchCompletionsSince, fetchQuests, setQuestActive, updateQuest } from '@/lib/data';
import { addDays, dateKey } from '@/lib/dates';
import { DIFFICULTY_LABEL, levelFromXp, STAT_LABEL, STATS } from '@/lib/game';
import { askWeeklyOracle, PaywallError, type QuestSnapshot, type WeeklyAdvice } from '@/lib/oracle';
import { openCheckout, paymentsConfigured } from '@/lib/subscription';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';
import type { Completion, Quest, Stat as StatKey } from '@/lib/types';

const DAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export default function Informe() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const today = dateKey();
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [advice, setAdvice] = useState<WeeklyAdvice | null>(null);
  const [consulting, setConsulting] = useState(false);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [refrescando, setRefrescando] = useState(false);
  const lock = useRef(false);

  // El sistema se mejora a sí mismo: manda los datos reales de 14 días a la IA
  // y devuelve ajustes concretos que se aplican con un toque.
  const consultOracle = async () => {
    if (lock.current || !userId) return;
    lock.current = true;
    setConsulting(true);
    try {
      const activeQuests = quests.filter((q) => q.active && !q.is_penalty);
      const from = addDays(dateKey(), -13);
      const recentCompletions = completions.filter((c) => c.date >= from);
      const doneByQuest = new Map<string, number>();
      for (const c of recentCompletions) {
        doneByQuest.set(c.quest_id, (doneByQuest.get(c.quest_id) ?? 0) + 1);
      }
      const snapshots: QuestSnapshot[] = activeQuests.map((q) => {
        let scheduled = 0;
        for (let i = 0; i < 14; i++) {
          if (questsScheduledOn([q], addDays(from, i)).length > 0) scheduled++;
        }
        return {
          id: q.id,
          title: q.title,
          difficulty: q.difficulty,
          days_of_week: q.days_of_week,
          scheduled,
          completed: doneByQuest.get(q.id) ?? 0,
        };
      });
      const { count: breaks } = await supabase
        .from('rule_breaks')
        .select('*', { count: 'exact', head: true })
        .gte('date', from);
      // El XP perdido de verdad, leído de los eventos de penalización. Antes
      // se enviaba un 0 fijo: la IA analizaba la quincena creyendo que no
      // habías perdido nada y sus ajustes salían de un dato falso.
      const { data: penaltyEvents } = await supabase
        .from('events')
        .select('payload')
        .eq('type', 'penalty')
        .gte('created_at', `${from}T00:00:00`);
      const penaltiesXp = (penaltyEvents ?? []).reduce(
        (sum: number, e: { payload: { xp?: number } | null }) => sum + (e.payload?.xp ?? 0),
        0,
      );

      const prof = await ensureProfile(userId);
      const result = await askWeeklyOracle(
        {
          quests: snapshots,
          streakDays: prof.streak_days,
          level: levelFromXp(prof.xp_total).level,
          rulesBroken: breaks ? [`${breaks} normas rotas en 14 días`] : [],
          penaltiesXp,
        },
        userId,
      );
      setAdvice(result);
      setApplied(new Set());
    } catch (e) {
      if (e instanceof PaywallError) {
        Alert.alert(
          'El Oráculo es premium',
          'El análisis semanal consume API. Suscríbete y va incluido, o configura tu propia key en el módulo Oráculo.',
          paymentsConfigured()
            ? [
                { text: 'Suscribirme', onPress: () => openCheckout(userId).catch(() => {}) },
                { text: 'Ahora no', style: 'cancel' },
              ]
            : [{ text: 'Entendido', style: 'cancel' }],
        );
      } else {
        Alert.alert('El oráculo guarda silencio', e instanceof Error ? e.message : 'Error desconocido');
      }
    } finally {
      lock.current = false;
      setConsulting(false);
    }
  };

  const applyAdjustment = async (adj: WeeklyAdvice['adjustments'][number]) => {
    try {
      if (adj.action === 'desactivar') {
        await setQuestActive(adj.quest_id, false);
      } else if (adj.new_difficulty) {
        await updateQuest(adj.quest_id, { difficulty: adj.new_difficulty });
      }
      setApplied((prev) => new Set(prev).add(adj.quest_id));
      await load();
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'No se pudo aplicar');
    }
  };

  const applyNewQuest = async (q: WeeklyAdvice['new_quests'][number], key: string) => {
    if (!userId) return;
    try {
      await createQuest(userId, {
        title: q.title,
        stat: q.stat,
        difficulty: q.difficulty,
        days_of_week: q.days_of_week,
        requires_evidence: false,
      });
      setApplied((prev) => new Set(prev).add(key));
      await load();
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'No se pudo crear');
    }
  };

  const load = useCallback(async () => {
    try {
      const from = addDays(dateKey(), -91);
      const [cs, qs] = await Promise.all([fetchCompletionsSince(from), fetchQuests()]);
      setCompletions(cs);
      setQuests(qs);
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const refrescar = async () => {
    setRefrescando(true);
    await load();
    setRefrescando(false);
  };

  const weekStart = addDays(today, -6);
  const prevWeekStart = addDays(today, -13);

  const thisWeek = completions.filter((c) => c.date >= weekStart && c.date <= today);
  const prevWeek = completions.filter((c) => c.date >= prevWeekStart && c.date < weekStart);

  const xpWeek = thisWeek.reduce((a, c) => a + c.xp_awarded, 0);
  const xpPrev = prevWeek.reduce((a, c) => a + c.xp_awarded, 0);
  const delta = xpPrev > 0 ? Math.round(((xpWeek - xpPrev) / xpPrev) * 100) : null;

  const withEvidence = thisWeek.filter((c) => c.evidence_url !== null).length;
  const evidencePct = thisWeek.length > 0 ? Math.round((withEvidence / thisWeek.length) * 100) : 0;

  const questById = new Map(quests.map((q) => [q.id, q]));
  const xpByStat: Record<StatKey, number> = { FUE: 0, VIT: 0, INT: 0, AGI: 0, PER: 0 };
  for (const c of thisWeek) {
    const q = questById.get(c.quest_id);
    if (q && !q.is_penalty) xpByStat[q.stat] += c.xp_awarded;
  }
  const topStat = STATS.reduce((best, s) => (xpByStat[s] > xpByStat[best] ? s : best), 'FUE' as StatKey);

  const byDay: Record<string, number> = {};
  for (const c of completions) {
    byDay[c.date] = (byDay[c.date] ?? 0) + 1;
  }
  let bestDay: string | null = null;
  let bestDayXp = 0;
  for (const c of thisWeek) {
    const dayXp = thisWeek.filter((x) => x.date === c.date).reduce((a, x) => a + x.xp_awarded, 0);
    if (dayXp > bestDayXp) {
      bestDayXp = dayXp;
      bestDay = c.date;
    }
  }

  const narrative = (() => {
    if (thisWeek.length === 0) {
      return 'El sistema no registra actividad esta semana. Toda leyenda tiene capítulos en blanco; el siguiente lo escribes hoy.';
    }
    const parts: string[] = [];
    parts.push(`Esta semana has completado ${thisWeek.length} misiones y ganado ${xpWeek} XP.`);
    if (delta !== null) {
      parts.push(
        delta >= 0
          ? `Un ${delta}% más que la semana pasada: la curva sube.`
          : `Un ${Math.abs(delta)}% menos que la semana pasada. No es una derrota; es información.`,
      );
    }
    parts.push(`Tu área dominante ha sido ${topStat} (${STAT_LABEL[topStat]}).`);
    if (bestDay) {
      const [y, m, d] = bestDay.split('-').map(Number);
      const wd = new Date(y!, m! - 1, d!).getDay();
      parts.push(`Tu mejor día fue el ${DAY_NAMES[wd === 0 ? 6 : wd - 1]} (+${bestDayXp} XP).`);
    }
    if (evidencePct >= 50) {
      parts.push(`El ${evidencePct}% de tus misiones llevan evidencia: tu palabra está respaldada.`);
    }
    return parts.join(' ');
  })();

  const subtitulo =
    thisWeek.length === 0
      ? 'Sin actividad registrada en los últimos siete días.'
      : `${xpWeek} XP en siete días${delta !== null ? ` · ${delta >= 0 ? '+' : ''}${delta} % frente a la semana previa` : ''}.`;

  const pendientes =
    advice ? advice.adjustments.filter((a) => !applied.has(a.quest_id)).length + advice.new_quests.filter((_, i) => !applied.has(`new-${i}`)).length : 0;

  return (
    <Screen refreshing={refrescando} onRefresh={refrescar}>
      <Stagger>
        <FadeIn index={0}>
          <ScreenHeader
            onBack={() => router.back()}
            eyebrow="Progreso"
            title="Informe"
            subtitle={subtitulo}
            right={
              thisWeek.length > 0 ? (
                <ProgressRing ratio={evidencePct / 100} size={66} stroke={4} label={`${evidencePct}%`} sublabel="evidencia" />
              ) : undefined
            }
          />
        </FadeIn>

        <FadeIn index={1}>
          <Card>
            <StatRow>
              <Stat value={xpWeek} unit="XP" label="Esta semana" tone="accent" />
              <Stat value={thisWeek.length} label="Misiones" />
              <Stat
                value={delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta}`}
                unit={delta === null ? undefined : '%'}
                label="Vs. previa"
                tone={delta !== null && delta < 0 ? 'red' : 'text'}
              />
              <Stat value={topStat} label="Dominante" />
            </StatRow>
          </Card>
        </FadeIn>

        <FadeIn index={2}>
          <Section title="Lectura semanal">
            <Card>
              <Text style={styles.narrative}>{narrative}</Text>
            </Card>
          </Section>
        </FadeIn>

        <FadeIn index={3}>
          <Section title="El sistema se ajusta" tone="steel" meta={pendientes > 0 ? `${pendientes} por aplicar` : undefined}>
            {!advice ? (
              <Card variant="outline">
                <EmptyState
                  compact
                  icon="sparkles-outline"
                  title="Sin análisis todavía"
                  body="El oráculo lee tus últimos 14 días y propone ajustes: bajar lo que siempre falla, subir lo que ya es trivial, cubrir huecos."
                />
                <SystemButton
                  title="Pedir análisis al oráculo"
                  onPress={consultOracle}
                  loading={consulting}
                  icon="sparkles-outline"
                  style={{ marginTop: 4 }}
                />
              </Card>
            ) : (
              <>
                <Card accent={colors.steelDim}>
                  <Text style={styles.narrative}>{advice.analysis}</Text>
                </Card>
                {advice.adjustments.length > 0 || advice.new_quests.length > 0 ? (
                  <Card padded={false} style={styles.lista}>
                    {advice.adjustments.map((adj, i) => {
                      const hecho = applied.has(adj.quest_id);
                      return (
                        <Row
                          key={adj.quest_id}
                          first={i === 0}
                          leading={
                            <Ionicons
                              name={adj.action === 'desactivar' ? 'pause-circle-outline' : 'swap-vertical-outline'}
                              size={18}
                              color={colors.steel}
                            />
                          }
                          title={adj.quest_title}
                          done={hecho}
                          detail={`${
                            adj.action === 'desactivar'
                              ? 'Desactivar'
                              : `Dificultad → ${adj.new_difficulty ? DIFFICULTY_LABEL[adj.new_difficulty] : ''}`
                          } · ${adj.reasoning}`}
                          trailing={
                            hecho ? (
                              <Ionicons name="checkmark-circle" size={20} color={colors.steel} />
                            ) : (
                              <Chip
                                label="Aplicar"
                                small
                                tone="steel"
                                onPress={() => applyAdjustment(adj)}
                                accessibilityLabel={`Aplicar ajuste a ${adj.quest_title}`}
                              />
                            )
                          }
                        />
                      );
                    })}
                    {advice.new_quests.map((q, i) => {
                      const key = `new-${i}`;
                      const hecho = applied.has(key);
                      return (
                        <Row
                          key={key}
                          first={advice.adjustments.length === 0 && i === 0}
                          leading={<Ionicons name="add-circle-outline" size={18} color={colors.steel} />}
                          title={q.title}
                          done={hecho}
                          detail={`Nueva · ${q.stat} · ${DIFFICULTY_LABEL[q.difficulty]} · ${q.reasoning}`}
                          trailing={
                            hecho ? (
                              <Ionicons name="checkmark-circle" size={20} color={colors.steel} />
                            ) : (
                              <Chip
                                label="Crear"
                                small
                                tone="steel"
                                onPress={() => applyNewQuest(q, key)}
                                accessibilityLabel={`Crear misión ${q.title}`}
                              />
                            )
                          }
                        />
                      );
                    })}
                  </Card>
                ) : null}
                {advice.advice ? <Text style={styles.consejo}>{advice.advice}</Text> : null}
                <SystemButton
                  title="Nuevo análisis"
                  variant="outline"
                  onPress={consultOracle}
                  loading={consulting}
                  icon="refresh-outline"
                  style={{ marginTop: 6 }}
                />
              </>
            )}
          </Section>
        </FadeIn>

        <FadeIn index={4}>
          <Section title="XP por estadística" meta="7 días">
            <Card>
              {STATS.map((s, i) => {
                const dominante = s === topStat && xpByStat[s] > 0;
                return (
                  <View key={s} style={[styles.statFila, i > 0 && styles.statSep]}>
                    <View style={styles.statCabecera}>
                      <Text style={[styles.statAbbr, dominante && styles.statAbbrTop]}>
                        {s}
                        <Text style={styles.statNombre}> · {STAT_LABEL[s]}</Text>
                      </Text>
                      <Text style={[styles.statXp, dominante && styles.statAbbrTop]}>{xpByStat[s]} XP</Text>
                    </View>
                    <XPBar
                      ratio={xpByStat[s] / Math.max(1, xpByStat[topStat])}
                      color={dominante ? colors.accent : colors.accentDim}
                      height={5}
                    />
                  </View>
                );
              })}
            </Card>
          </Section>
        </FadeIn>

        <FadeIn index={5}>
          <Section title="Mapa de actividad" meta="13 semanas">
            <Card>
              {completions.length === 0 ? (
                <EmptyState compact icon="grid-outline" title="Todavía en blanco" body="Cada misión completada enciende un día." />
              ) : (
                <Heatmap counts={byDay} />
              )}
            </Card>
          </Section>
        </FadeIn>
      </Stagger>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lista: { paddingHorizontal: 16, paddingVertical: 2 },
  narrative: { fontFamily: fonts.semibold, fontSize: 14.5, lineHeight: 22, color: colors.text },
  consejo: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.steelText, marginTop: 2, marginBottom: 12 },
  statFila: { paddingVertical: 9 },
  statSep: { borderTopWidth: 1, borderTopColor: colors.line },
  statCabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 7 },
  statAbbr: { fontFamily: fonts.heading, fontSize: 13, letterSpacing: 1, color: colors.textDim },
  statAbbrTop: { color: colors.text },
  statNombre: { fontFamily: fonts.body, fontSize: 12, letterSpacing: 0, color: colors.textFaint },
  statXp: { fontFamily: fonts.number, fontSize: 12.5, color: colors.textDim },
});

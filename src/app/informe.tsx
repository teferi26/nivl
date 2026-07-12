import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heatmap } from '@/components/Heatmap';
import { SystemButton } from '@/components/SystemButton';
import { SystemWindow } from '@/components/SystemWindow';
import { useAuth } from '@/lib/auth';
import { questsScheduledOn } from '@/lib/closing';
import { createQuest, ensureProfile, fetchCompletionsSince, fetchQuests, setQuestActive, updateQuest } from '@/lib/data';
import { addDays, dateKey } from '@/lib/dates';
import { DIFFICULTY_LABEL, levelFromXp, STAT_LABEL, STATS } from '@/lib/game';
import { askWeeklyOracle, PaywallError, type QuestSnapshot, type WeeklyAdvice } from '@/lib/oracle';
import { openCheckout, paymentsConfigured } from '@/lib/subscription';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';
import type { Completion, Quest, Stat } from '@/lib/types';

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
      const prof = await ensureProfile(userId);
      const result = await askWeeklyOracle(
        {
          quests: snapshots,
          streakDays: prof.streak_days,
          level: levelFromXp(prof.xp_total).level,
          rulesBroken: breaks ? [`${breaks} normas rotas en 14 días`] : [],
          penaltiesXp: 0,
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
  const xpByStat: Record<Stat, number> = { FUE: 0, VIT: 0, INT: 0, AGI: 0, PER: 0 };
  for (const c of thisWeek) {
    const q = questById.get(c.quest_id);
    if (q && !q.is_penalty) xpByStat[q.stat] += c.xp_awarded;
  }
  const topStat = STATS.reduce((best, s) => (xpByStat[s] > xpByStat[best] ? s : best), 'FUE' as Stat);

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

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color={colors.cyan} />
          </Pressable>
          <Text style={styles.title}>INFORME DEL SISTEMA</Text>
          <View style={{ width: 24 }} />
        </View>

        <SystemWindow color={colors.cyanDim}>
          <Text style={styles.windowTitle}>LECTURA SEMANAL</Text>
          <Text style={styles.narrative}>{narrative}</Text>
        </SystemWindow>

        <SystemWindow color={colors.purpleDim} fill={colors.panelDeep}>
          <Text style={[styles.windowTitle, { color: '#A697F0' }]}>EL SISTEMA SE AJUSTA</Text>
          {!advice ? (
            <>
              <Text style={styles.oracleHint}>
                El oráculo analiza tus últimos 14 días y propone ajustes: bajar lo que siempre
                falla, subir lo que ya es trivial, cubrir huecos.
              </Text>
              <SystemButton
                title="Pedir análisis al oráculo"
                variant="outline"
                onPress={consultOracle}
                loading={consulting}
                style={{ marginTop: 12 }}
              />
            </>
          ) : (
            <>
              <Text style={styles.narrative}>{advice.analysis}</Text>
              {advice.adjustments.map((adj) => (
                <View key={adj.quest_id} style={styles.adjRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.adjTitle}>{adj.quest_title}</Text>
                    <Text style={styles.adjMeta}>
                      {adj.action === 'desactivar'
                        ? 'Desactivar'
                        : `Dificultad → ${adj.new_difficulty ? DIFFICULTY_LABEL[adj.new_difficulty] : ''}`}
                      {' · '}
                      {adj.reasoning}
                    </Text>
                  </View>
                  {applied.has(adj.quest_id) ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.purple} />
                  ) : (
                    <Pressable
                      onPress={() => applyAdjustment(adj)}
                      style={styles.applyBtn}
                      accessibilityRole="button"
                      accessibilityLabel={`Aplicar ajuste a ${adj.quest_title}`}
                    >
                      <Text style={styles.applyBtnText}>APLICAR</Text>
                    </Pressable>
                  )}
                </View>
              ))}
              {advice.new_quests.map((q, i) => {
                const key = `new-${i}`;
                return (
                  <View key={key} style={styles.adjRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.adjTitle}>Nueva: {q.title}</Text>
                      <Text style={styles.adjMeta}>
                        {q.stat} · {DIFFICULTY_LABEL[q.difficulty]} · {q.reasoning}
                      </Text>
                    </View>
                    {applied.has(key) ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.purple} />
                    ) : (
                      <Pressable
                        onPress={() => applyNewQuest(q, key)}
                        style={styles.applyBtn}
                        accessibilityRole="button"
                        accessibilityLabel={`Crear misión ${q.title}`}
                      >
                        <Text style={styles.applyBtnText}>CREAR</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
              {advice.advice ? <Text style={styles.oracleAdvice}>{advice.advice}</Text> : null}
              <SystemButton
                title="Nuevo análisis"
                variant="outline"
                onPress={consultOracle}
                loading={consulting}
                style={{ marginTop: 12 }}
              />
            </>
          )}
        </SystemWindow>

        <SystemWindow color={colors.cyanDim}>
          <Text style={styles.windowTitle}>ÚLTIMOS 7 DÍAS</Text>
          <View style={styles.kpiGrid}>
            <View style={styles.kpi}>
              <Text style={styles.kpiValue}>{xpWeek}</Text>
              <Text style={styles.kpiLabel}>XP ganado</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiValue}>{thisWeek.length}</Text>
              <Text style={styles.kpiLabel}>Misiones</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiValue}>{evidencePct}%</Text>
              <Text style={styles.kpiLabel}>Con evidencia</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiValue}>{delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta}%`}</Text>
              <Text style={styles.kpiLabel}>vs semana previa</Text>
            </View>
          </View>
        </SystemWindow>

        <SystemWindow color={colors.cyanDim}>
          <Text style={styles.windowTitle}>XP POR ESTADÍSTICA · 7 DÍAS</Text>
          {STATS.map((s) => (
            <View key={s} style={styles.statRow}>
              <Text style={styles.statAbbr}>{s}</Text>
              <View style={styles.statTrack}>
                <View
                  style={{
                    height: 6,
                    backgroundColor: s === topStat ? colors.cyan : colors.cyanDim,
                    width: `${Math.min(100, Math.round((xpByStat[s] / Math.max(1, xpByStat[topStat])) * 100))}%`,
                  }}
                />
              </View>
              <Text style={styles.statXp}>{xpByStat[s]}</Text>
            </View>
          ))}
        </SystemWindow>

        <SystemWindow color={colors.cyanDim}>
          <Text style={styles.windowTitle}>MAPA DE ACTIVIDAD · 13 SEMANAS</Text>
          <Heatmap counts={byDay} />
        </SystemWindow>
      </ScrollView>
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
  title: { fontFamily: fonts.heading, fontSize: 15, letterSpacing: 3, color: colors.cyan },
  windowTitle: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 2.5,
    color: colors.cyan,
    marginBottom: 10,
  },
  narrative: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text, lineHeight: 21 },
  oracleHint: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, lineHeight: 19 },
  oracleAdvice: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: '#A697F0',
    lineHeight: 19,
    marginTop: 12,
  },
  adjRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: '#15182E',
    marginTop: 8,
  },
  adjTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  adjMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim, marginTop: 2, lineHeight: 16 },
  applyBtn: { borderWidth: 1, borderColor: colors.purple, paddingHorizontal: 10, paddingVertical: 5 },
  applyBtnText: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 1.5, color: colors.purple },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpi: { width: '47%', backgroundColor: colors.cyanFaint, padding: 12 },
  kpiValue: { fontFamily: fonts.number, fontSize: 22, color: colors.cyan },
  kpiLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim, marginTop: 3 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 },
  statAbbr: { fontFamily: fonts.heading, fontSize: 13, color: colors.cyanText, width: 34 },
  statTrack: { flex: 1, height: 6, backgroundColor: colors.track, overflow: 'hidden' },
  statXp: { fontFamily: fonts.heading, fontSize: 13, color: colors.text, width: 44, textAlign: 'right' },
});

import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Hexagon } from '@/components/Hexagon';
import { LevelUpOverlay } from '@/components/LevelUpOverlay';
import { QuestItem } from '@/components/QuestItem';
import { OrdenDelDia } from '@/components/OrdenDelDia';
import { SystemWindow } from '@/components/SystemWindow';
import { XpToast } from '@/components/XpToast';
import { XPBar } from '@/components/XPBar';
import { evaluateAchievements, unlockAchievements } from '@/lib/achievements';
import { useAuth } from '@/lib/auth';
import { completionStats, ensureProfile, fetchCompletionsForDate, fetchQuests, seedDefaultQuests } from '@/lib/data';
import { fetchPlan, horaAMinutos, setBlockDone, type DayBlock, type PlanConBloques } from '@/lib/dayplan';
import { dateKey, formatLongDate } from '@/lib/dates';
import { completeQuest, processPendingDays, questsScheduledOn, type DayCloseResult } from '@/lib/engine';
import { rachaVisible } from '@/lib/closing';
import { levelFromXp, rankForLevel, streakMultiplier } from '@/lib/game';
import {
  inicializarAvisos,
  programarDespertador,
  reconciliarAvisosDelDia,
} from '@/lib/notifications';
import { colors, fonts } from '@/lib/theme';
import { voice } from '@/lib/voice';
import type { Completion, Profile, Quest } from '@/lib/types';

const MODULES = [
  { icon: 'barbell-outline', label: 'Gym', route: '/gym' },
  { icon: 'walk-outline', label: 'Cardio', route: '/cardio' },
  { icon: 'nutrition-outline', label: 'Nutrición', route: '/nutricion' },
  { icon: 'restaurant-outline', label: 'Dieta', route: '/dieta' },
  { icon: 'wallet-outline', label: 'Economía', route: '/economia' },
  { icon: 'cart-outline', label: 'Compra', route: '/compra' },
  { icon: 'book-outline', label: 'Diario', route: '/diario' },
  { icon: 'stats-chart-outline', label: 'Informe', route: '/informe' },
  { icon: 'trending-up-outline', label: 'Avances', route: '/avances' },
  { icon: 'images-outline', label: 'Recuerdos', route: '/resumen' },
  { icon: 'sparkles-outline', label: 'Oráculo', route: '/oraculo' },
  { icon: 'document-text-outline', label: 'Contrato', route: '/contrato' },
] as const;

export default function Sistema() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [todayQuests, setTodayQuests] = useState<Quest[]>([]);
  const [completions, setCompletions] = useState<Record<string, Completion>>({});
  const [dayResult, setDayResult] = useState<DayCloseResult | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [busyQuestId, setBusyQuestId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ xp: number; bonus: boolean; unit: 'XP' | 'PB' } | null>(null);
  const [plan, setPlan] = useState<PlanConBloques | null>(null);

  const completing = useRef<Set<string>>(new Set());
  const clearToast = useCallback(() => setToast(null), []);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      let prof = await ensureProfile(userId);
      const seeded = await seedDefaultQuests(userId);
      let quests = await fetchQuests();
      const { profile: processed, result } = await processPendingDays(prof, quests);
      prof = processed;
      if (result && result.penaltyXp > 0) {
        quests = await fetchQuests();
      }
      const today = dateKey();
      const done = await fetchCompletionsForDate(today);
      const map: Record<string, Completion> = {};
      for (const c of done) map[c.quest_id] = c;

      const planDeHoy = await fetchPlan(today).catch(() => null);

      // Los logros también se ganan en el cierre: subir de nivel por una
      // penalización recuperada o cruzar un hito de racha cuenta igual que
      // completar una misión. Antes solo se recalculaban al completar.
      if (result) {
        const stats = await completionStats();
        await unlockAchievements(
          userId,
          evaluateAchievements({
            totalCompletions: stats.total,
            evidenceCount: stats.withEvidence,
            streak: prof.streak_days,
            level: levelFromXp(prof.xp_total).level,
            penaltyRedeemed: false,
          }),
        ).catch(() => {});
      }

      setProfile(prof);
      setPlan(planDeHoy);
      setTodayQuests(questsScheduledOn(quests, today));
      setCompletions(map);
      // Siempre (incluido null): un null borra el aviso de cierre de ayer, que
      // antes se quedaba pegado indefinidamente al cambiar de pestaña.
      setDayResult(result);
      if (seeded) {
        Alert.alert(
          'El sistema te da la bienvenida',
          'Se han creado tus primeras misiones diarias. Edítalas en la pestaña Hábitos.',
        );
      }
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Los avisos se derivan del plan: se inicializan una vez y se reconcilian
  // cada vez que cambia el plan o los horarios. Ojo con lo que había antes
  // aquí: llamaba a cancelAllScheduledNotificationsAsync en cada montaje, así
  // que abrir esta pestaña borraba todo lo programado.
  useEffect(() => {
    inicializarAvisos();
  }, []);

  useEffect(() => {
    if (!profile) return;
    programarDespertador(horaAMinutos(profile.wake_time));
    if (plan) {
      const cierre = horaAMinutos(profile.sleep_time);
      reconciliarAvisosDelDia(
        plan.plan.date,
        plan.bloques,
        cierre === null ? null : Math.max(0, cierre - 20),
      );
    }
  }, [profile, plan]);

  const captureEvidence = async (): Promise<string | null> => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Sin cámara', 'El sistema necesita la cámara para registrar evidencias.');
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.4,
      base64: true,
    });
    if (result.canceled) return null;
    return result.assets[0]?.base64 ?? null;
  };

  const finishQuest = async (quest: Quest, evidence: string | null) => {
    if (!profile || !userId) return;
    const today = dateKey();
    try {
      const res = await completeQuest(profile, quest, evidence);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setProfile(res.profile);
      setToast(
        res.bonusEarned > 0
          ? { xp: res.bonusEarned, bonus: false, unit: 'PB' }
          : { xp: res.xp, bonus: evidence !== null, unit: 'XP' },
      );
      setCompletions((prev) => ({
        ...prev,
        [quest.id]: {
          id: `local-${quest.id}`,
          user_id: profile.id,
          quest_id: quest.id,
          date: today,
          completed_at: new Date().toISOString(),
          xp_awarded: res.xp,
          evidence_url: evidence ? 'local' : null,
        },
      }));
      if (res.leveledUp) setLevelUp(res.newLevel);

      const stats = await completionStats();
      const fresh = await unlockAchievements(
        userId,
        evaluateAchievements({
          totalCompletions: stats.total,
          evidenceCount: stats.withEvidence,
          streak: res.profile.streak_days,
          level: levelFromXp(res.profile.xp_total).level,
          penaltyRedeemed: res.wasPenalty,
        }),
      );
      if (fresh.length > 0 && !res.leveledUp) {
        Alert.alert('LOGRO DESBLOQUEADO', `${voice.achievement()}\n${fresh.map((a) => a.name).join('\n')}`);
      }
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    }
  };

  const onComplete = (quest: Quest) => {
    // Cerrojo síncrono por misión: un doble toque mientras la cámara o el Alert
    // están abiertos ya no dispara dos completeQuest (evita XP duplicado).
    if (completing.current.has(quest.id)) return;
    completing.current.add(quest.id);
    setBusyQuestId(quest.id);
    const release = () => {
      completing.current.delete(quest.id);
      setBusyQuestId((id) => (id === quest.id ? null : id));
    };

    if (quest.is_penalty) {
      finishQuest(quest, null).finally(release);
      return;
    }
    if (quest.requires_evidence) {
      captureEvidence()
        .then((b64) => (b64 ? finishQuest(quest, b64) : undefined))
        .finally(release);
      return;
    }
    Alert.alert(
      'Completar misión',
      '¿Le haces una foto? Suma un 25 % de XP y el domingo entra en tu resumen.',
      [
      {
        text: 'Cámara +25%',
        onPress: () =>
          captureEvidence()
            .then((b64) => (b64 ? finishQuest(quest, b64) : undefined))
            .finally(release),
      },
      { text: 'Sin foto', onPress: () => finishQuest(quest, null).finally(release) },
      { text: 'Cancelar', style: 'cancel', onPress: release },
      ],
    );
  };

  const alternarBloque = async (b: DayBlock) => {
    // Optimista: el plan es la pantalla principal y esperar a la red para
    // pintar un check la haría sentir lenta.
    setPlan((p) =>
      p ? { ...p, bloques: p.bloques.map((x) => (x.id === b.id ? { ...x, done: !b.done } : x)) } : p,
    );
    try {
      await setBlockDone(b.id, !b.done);
    } catch {
      setPlan((p) =>
        p ? { ...p, bloques: p.bloques.map((x) => (x.id === b.id ? { ...x, done: b.done } : x)) } : p,
      );
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const today = dateKey();
  const lvl = profile ? levelFromXp(profile.xp_total) : null;
  const frozen = profile?.freeze_until != null && profile.freeze_until >= today;
  const sorted = [...todayQuests].sort((a, b) => Number(b.is_penalty) - Number(a.is_penalty));
  const completedCount = sorted.filter((q) => completions[q.id]).length;
  // La racha que se enseña cuenta el día de hoy en cuanto queda cerrado. El
  // multiplicador sigue saliendo de los días CERRADOS: si subiera a mitad del
  // día, completar las misiones en un orden u otro pagaría distinto.
  const racha = rachaVisible(
    profile?.streak_days ?? 0,
    sorted,
    new Set(Object.keys(completions)),
  );
  const pendingCount = sorted.length - completedCount;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.cyan} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.brand}>NIVL</Text>
          <Text style={styles.date}>{formatLongDate()}</Text>
        </View>

        <OrdenDelDia
          plan={plan?.plan ?? null}
          bloques={plan?.bloques ?? []}
          onToggle={alternarBloque}
        />

        {profile && lvl ? (
          <SystemWindow color={colors.cyanDim}>
            <View style={styles.profileRow}>
              <Hexagon size={58}>
                <Text style={styles.avatarLetter}>{profile.name.charAt(0).toUpperCase()}</Text>
              </Hexagon>
              <View style={styles.profileInfo}>
                <Text style={styles.name}>{profile.name.toUpperCase()}</Text>
                <Text style={styles.rank}>
                  {profile.equipped_title
                    ? `${profile.equipped_title.toUpperCase()} · RANGO ${rankForLevel(lvl.level)}`
                    : `CAZADOR · RANGO ${rankForLevel(lvl.level)}`}
                </Text>
              </View>
              <View style={styles.levelBox}>
                <Text style={styles.lvLabel}>LV.</Text>
                <Text style={styles.lvValue}>{lvl.level}</Text>
              </View>
            </View>
            <View style={{ marginTop: 12 }}>
              <XPBar ratio={lvl.next > 0 ? lvl.into / lvl.next : 1} />
              <View style={styles.xpRow}>
                <Text style={styles.xpText}>
                  {lvl.next > 0 ? `${lvl.into} / ${lvl.next} XP` : 'NIVEL MÁXIMO'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={[styles.streak, racha.hoyCerrado && styles.streakViva]}>
                    Racha {racha.valor} · ×{streakMultiplier(profile.streak_days).toFixed(1)}
                    {racha.hoyCerrado ? ' · hoy cerrado' : ''}
                  </Text>
                  <Text style={styles.stones}>
                    <Ionicons name="shield-half-outline" size={12} color={colors.cyanText} />{' '}
                    {profile.protection_stones}
                  </Text>
                </View>
              </View>
            </View>
          </SystemWindow>
        ) : null}

        {frozen && profile ? (
          <SystemWindow color={colors.cyanDim} fill={colors.cyanFaint}>
            <Text style={styles.frozenTitle}>
              <Ionicons name="snow-outline" size={13} color={colors.cyanText} /> SISTEMA EN PAUSA
            </Text>
            <Text style={styles.frozenBody}>
              {voice.frozen(profile.freeze_reason ?? 'pausa')} Hasta el {profile.freeze_until}.
            </Text>
          </SystemWindow>
        ) : null}

        {dayResult ? (
          <SystemWindow
            color={dayResult.penaltyXp > 0 ? colors.redDim : colors.cyanDim}
            fill={dayResult.penaltyXp > 0 ? colors.redPanel : colors.panel}
          >
            <Text style={[styles.alertTitle, dayResult.penaltyXp === 0 && { color: colors.cyanText }]}>
              {dayResult.penaltyXp > 0 ? 'ALERTA DEL SISTEMA' : 'INFORME DEL CIERRE'}
            </Text>
            {dayResult.stonesUsed > 0 ? (
              <Text style={styles.alertBody}>{voice.stoneUsed()}</Text>
            ) : null}
            {dayResult.penaltyXp > 0 ? (
              <Text style={styles.alertBody}>
                {voice.penaltyApplied(dayResult.penaltyXp)}
                {dayResult.levelsLost > 0 ? ` Has perdido ${dayResult.levelsLost} nivel(es).` : ''}
              </Text>
            ) : dayResult.streakLost ? (
              <Text style={styles.alertBody}>Racha perdida. El contador vuelve a cero.</Text>
            ) : null}
            {dayResult.stonesEarned > 0 ? (
              <Text style={styles.alertBody}>{voice.stoneEarned()}</Text>
            ) : null}
          </SystemWindow>
        ) : null}

        <SystemWindow color={colors.cyanDim}>
          <View style={styles.questHeader}>
            <Text style={styles.windowTitle}>MISIONES DE HOY</Text>
            <Text style={styles.counter}>
              {completedCount}/{sorted.length}
            </Text>
          </View>
          {sorted.length === 0 ? (
            <Text style={styles.empty}>
              No hay misiones programadas para hoy. Crea las tuyas en la pestaña Hábitos.
            </Text>
          ) : (
            sorted.map((q) => (
              <QuestItem
                key={q.id}
                quest={q}
                completed={!!completions[q.id]}
                xpAwarded={completions[q.id]?.xp_awarded}
                busy={busyQuestId === q.id}
                streakDays={racha.valor}
                onComplete={onComplete}
              />
            ))
          )}
          {sorted.length > 0 && pendingCount === 0 ? (
            <Text style={styles.allDone}>{voice.allDone()}</Text>
          ) : null}
          {pendingCount > 0 && !frozen ? (
            <Text style={styles.pendingNote}>
              {pendingCount} pendiente(s) · a medianoche se aplica la penalización
            </Text>
          ) : null}
        </SystemWindow>

        <SystemWindow color={colors.line}>
          <Text style={[styles.windowTitle, { color: colors.textFaint }]}>MÓDULOS</Text>
          <View style={styles.moduleGrid}>
            {MODULES.map((m) => (
              <Pressable
                key={m.route}
                onPress={() => router.push(m.route)}
                style={styles.module}
                accessibilityRole="button"
                accessibilityLabel={`Abrir ${m.label}`}
              >
                <Ionicons name={m.icon} size={20} color={colors.cyan} />
                <Text style={styles.moduleLabel}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
        </SystemWindow>
      </ScrollView>

      <XpToast xp={toast?.xp ?? null} bonus={toast?.bonus} unit={toast?.unit} onDone={clearToast} />
      <LevelUpOverlay level={levelUp} onClose={() => setLevelUp(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 14,
  },
  brand: {
    fontFamily: fonts.brand,
    fontSize: 18,
    letterSpacing: 6,
    color: colors.cyan,
  },
  date: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textFaint,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarLetter: {
    fontFamily: fonts.brand,
    fontSize: 22,
    color: colors.cyan,
  },
  profileInfo: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: fonts.heading,
    fontSize: 18,
    letterSpacing: 1,
    color: colors.text,
  },
  rank: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.cyanText,
    marginTop: 3,
  },
  levelBox: {
    alignItems: 'center',
  },
  lvLabel: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textFaint,
  },
  lvValue: {
    fontFamily: fonts.brand,
    fontSize: 30,
    color: colors.cyan,
  },
  xpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  xpText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.textDim,
  },
  streak: {
    fontFamily: fonts.heading,
    fontSize: 12,
    color: colors.amber,
  },
  // Cuando el día ya está cerrado la racha deja de ser una promesa: se enciende.
  streakViva: { color: colors.cyan },
  stones: {
    fontFamily: fonts.heading,
    fontSize: 12,
    color: colors.cyanText,
  },
  frozenTitle: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 2.5,
    color: colors.cyanText,
    marginBottom: 5,
  },
  frozenBody: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
  },
  alertTitle: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 2.5,
    color: colors.red,
    marginBottom: 6,
  },
  alertBody: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: '#E8C9CD',
    lineHeight: 19,
    marginBottom: 4,
  },
  questHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  windowTitle: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 2.5,
    color: colors.cyan,
  },
  counter: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.text,
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textDim,
    paddingVertical: 10,
  },
  allDone: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.cyan,
    marginTop: 10,
  },
  pendingNote: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textFaint,
    marginTop: 10,
  },
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  module: {
    width: '30.5%',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelDeep,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 5,
  },
  moduleLabel: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.textDim,
  },
});

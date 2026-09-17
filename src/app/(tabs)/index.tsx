import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { LevelUpOverlay } from '@/components/LevelUpOverlay';
import { OrdenDelDia } from '@/components/OrdenDelDia';
import { QuestItem } from '@/components/QuestItem';
import { XpToast } from '@/components/XpToast';
import { XPBar } from '@/components/XPBar';
import { Card, EmptyState, FadeIn, ProgressRing, Screen, ScreenHeader, Section, Stagger } from '@/components/ui';
import { evaluateAchievements, unlockAchievements } from '@/lib/achievements';
import { useAuth } from '@/lib/auth';
import { completionStats, ensureProfile, fetchCompletionsForDate, fetchQuests, seedDefaultQuests } from '@/lib/data';
import { fetchPlan, horaAMinutos, setBlockDone, type DayBlock, type PlanConBloques } from '@/lib/dayplan';
import { dateKey, formatLongDate } from '@/lib/dates';
import { completeQuest, processPendingDays, questsScheduledOn, type DayCloseResult } from '@/lib/engine';
import { rachaVisible } from '@/lib/closing';
import { levelFromXp, rankForLevel, streakMultiplier } from '@/lib/game';
import { kindMeta, modulesFor } from '@/lib/kinds';
import {
  inicializarAvisos,
  programarDespertador,
  reconciliarAvisosDelDia,
} from '@/lib/notifications';
import { colors, fonts } from '@/lib/theme';
import { voice } from '@/lib/voice';
import type { Completion, Profile, Quest } from '@/lib/types';

function saludo(nombre: string): string {
  const h = new Date().getHours();
  const franja = h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  return `${franja}, ${nombre}.`;
}

export default function Hoy() {
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
  const [showMore, setShowMore] = useState(false);

  const completing = useRef<Set<string>>(new Set());
  const clearToast = useCallback(() => setToast(null), []);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      let prof = await ensureProfile(userId);
      const seeded = await seedDefaultQuests(userId, prof.profile_kind);
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
          'Bienvenido a la arena',
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
  const modulos = modulesFor(profile?.profile_kind);
  const kind = kindMeta(profile?.profile_kind);

  const subtitulo = !profile
    ? undefined
    : frozen
      ? 'Sistema en pausa. Hoy no se juzga.'
      : sorted.length === 0
        ? 'Sin misiones programadas para hoy.'
        : pendingCount === 0
          ? voice.allDone()
          : pendingCount === 1
            ? 'Una misión por delante. Cierra el día.'
            : `${pendingCount} misiones por delante.`;

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Stagger>
        <FadeIn index={0}>
          <ScreenHeader
            eyebrow={formatLongDate()}
            title={profile ? saludo(profile.name) : 'Hoy'}
            subtitle={subtitulo}
            right={
              sorted.length > 0 ? (
                <ProgressRing
                  ratio={completedCount / sorted.length}
                  size={66}
                  stroke={4}
                  label={`${completedCount}/${sorted.length}`}
                  sublabel="hoy"
                />
              ) : undefined
            }
          />
        </FadeIn>

        {profile && lvl ? (
          <FadeIn index={1}>
            <Card>
              <View style={styles.profileRow}>
                <Avatar size={52} avatarPath={profile.avatar_url} name={profile.name} />
                <View style={styles.profileInfo}>
                  <Text style={styles.name} numberOfLines={1}>
                    {profile.equipped_title ? `« ${profile.equipped_title} »` : kind.title}
                  </Text>
                  <Text style={styles.rank}>
                    RANGO {rankForLevel(lvl.level)} · {lvl.next > 0 ? `${lvl.into} / ${lvl.next} XP` : 'NIVEL MÁXIMO'}
                  </Text>
                </View>
                <View style={styles.levelBox}>
                  <Text style={styles.lvLabel}>NIVEL</Text>
                  <Text style={styles.lvValue}>{lvl.level}</Text>
                </View>
              </View>
              <View style={{ marginTop: 14 }}>
                <XPBar ratio={lvl.next > 0 ? lvl.into / lvl.next : 1} height={4} />
              </View>
              <View style={styles.badges}>
                <View style={styles.badge}>
                  <Ionicons name="flame" size={13} color={racha.hoyCerrado ? colors.gold : colors.textDim} />
                  <Text style={[styles.badgeText, racha.hoyCerrado && styles.badgeGold]}>
                    Racha {racha.valor} · ×{streakMultiplier(profile.streak_days).toFixed(1)}
                  </Text>
                </View>
                <Text style={styles.badgeHint}>
                  {racha.hoyCerrado
                    ? racha.perfecto
                      ? 'Día perfecto'
                      : 'Hoy cuenta'
                    : racha.faltan > 0
                      ? `${racha.faltan} para salvar el día`
                      : ''}
                </Text>
                <View style={styles.badge}>
                  <Ionicons name="shield-half-outline" size={13} color={colors.textDim} />
                  <Text style={styles.badgeText}>{profile.protection_stones}</Text>
                </View>
              </View>
            </Card>
          </FadeIn>
        ) : null}

        {frozen && profile ? (
          <FadeIn index={2}>
            <Card variant="outline" accent={colors.accentDim}>
              <Text style={styles.alertTitle}>
                <Ionicons name="snow-outline" size={12} color={colors.accentText} /> SISTEMA EN PAUSA
              </Text>
              <Text style={styles.alertBody}>
                {voice.frozen(profile.freeze_reason ?? 'pausa')} Hasta el {profile.freeze_until}.
              </Text>
            </Card>
          </FadeIn>
        ) : null}

        {dayResult ? (
          <FadeIn index={2}>
            <Card variant="outline" accent={dayResult.penaltyXp > 0 ? colors.red : colors.gold}>
              <Text style={[styles.alertTitle, { color: dayResult.penaltyXp > 0 ? colors.red : colors.gold }]}>
                {dayResult.penaltyXp > 0 ? 'ALERTA DEL SISTEMA' : 'INFORME DEL CIERRE'}
              </Text>
              {dayResult.stonesUsed > 0 ? <Text style={styles.alertBody}>{voice.stoneUsed()}</Text> : null}
              {dayResult.penaltyXp > 0 ? (
                <Text style={styles.alertBody}>
                  {voice.penaltyApplied(dayResult.penaltyXp)}
                  {dayResult.levelsLost > 0 ? ` Has perdido ${dayResult.levelsLost} nivel(es).` : ''}
                </Text>
              ) : dayResult.streakLost ? (
                <Text style={styles.alertBody}>Racha perdida. El contador vuelve a cero.</Text>
              ) : null}
              {dayResult.stonesEarned > 0 ? <Text style={styles.alertBody}>{voice.stoneEarned()}</Text> : null}
            </Card>
          </FadeIn>
        ) : null}

        <FadeIn index={3}>
          <OrdenDelDia
            plan={plan?.plan ?? null}
            bloques={plan?.bloques ?? []}
            onToggle={alternarBloque}
          />
        </FadeIn>

        <FadeIn index={4}>
          <Section title="Misiones de hoy" meta={sorted.length > 0 ? `${completedCount}/${sorted.length}` : undefined}>
            {sorted.length === 0 ? (
              <Card variant="outline">
                <EmptyState
                  compact
                  icon="repeat-outline"
                  title="Nada programado para hoy"
                  body="Crea tus misiones en Hábitos o pídeselas al coach."
                  action={{ label: 'Ir a Hábitos', onPress: () => router.push('/(tabs)/habitos') }}
                />
              </Card>
            ) : (
              <Card padded={false} style={styles.questCard}>
                {sorted.map((q, i) => (
                  <QuestItem
                    key={q.id}
                    first={i === 0}
                    quest={q}
                    completed={!!completions[q.id]}
                    xpAwarded={completions[q.id]?.xp_awarded}
                    busy={busyQuestId === q.id}
                    streakDays={racha.valor}
                    onComplete={onComplete}
                  />
                ))}
              </Card>
            )}
            {sorted.length > 0 && pendingCount === 0 ? (
              <Text style={styles.allDone}>{voice.allDone()}</Text>
            ) : null}
            {pendingCount > 0 && !frozen ? (
              <Text style={styles.pendingNote}>A medianoche, lo pendiente se penaliza.</Text>
            ) : null}
          </Section>
        </FadeIn>

        <FadeIn index={5}>
          <Section
            title="Módulos"
            action={
              modulos.secondary.length > 0
                ? {
                    label: showMore ? 'Menos' : `Más · ${modulos.secondary.length}`,
                    icon: showMore ? 'chevron-up' : 'chevron-down',
                    onPress: () => setShowMore((v) => !v),
                  }
                : undefined
            }
          >
            <View style={styles.moduleGrid}>
              {[...modulos.primary, ...(showMore ? modulos.secondary : [])].map((m) => (
                <Pressable
                  key={m.route}
                  onPress={() => router.push(m.route)}
                  style={({ pressed }) => [styles.module, pressed && styles.modulePressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir ${m.label}`}
                >
                  <Ionicons name={m.icon as never} size={22} color={colors.text} />
                  <Text style={styles.moduleLabel} numberOfLines={1}>
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Section>
        </FadeIn>

        <FadeIn index={6}>
          <Text style={styles.motto}>UN 1 % MEJOR CADA DÍA</Text>
        </FadeIn>
      </Stagger>

      <XpToast xp={toast?.xp ?? null} bonus={toast?.bonus} unit={toast?.unit} onDone={clearToast} />
      <LevelUpOverlay level={levelUp} onClose={() => setLevelUp(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  profileInfo: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.heading, fontSize: 16, letterSpacing: 0.5, color: colors.text },
  rank: {
    fontFamily: fonts.heading,
    fontSize: 10.5,
    letterSpacing: 1.8,
    color: colors.textFaint,
    marginTop: 4,
  },
  levelBox: { alignItems: 'flex-end' },
  lvLabel: { fontFamily: fonts.heading, fontSize: 9.5, letterSpacing: 2, color: colors.textFaint },
  lvValue: { fontFamily: fonts.brand, fontSize: 32, lineHeight: 36, color: colors.accent },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textDim },
  badgeGold: { color: colors.gold },
  badgeHint: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
  alertTitle: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2.5,
    color: colors.accentText,
    marginBottom: 6,
  },
  alertBody: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    color: colors.text,
    lineHeight: 19,
    marginBottom: 4,
  },
  questCard: { paddingHorizontal: 16, paddingVertical: 4 },
  allDone: { fontFamily: fonts.semibold, fontSize: 13, color: colors.accent, marginTop: 4 },
  pendingNote: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 4 },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  module: {
    width: '23.5%',
    aspectRatio: 1,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  modulePressed: { backgroundColor: colors.accentFaint },
  moduleLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textDim, paddingHorizontal: 4 },
  motto: {
    fontFamily: fonts.heading,
    fontSize: 10.5,
    letterSpacing: 3,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 8,
  },
});

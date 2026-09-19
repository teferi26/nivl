import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { CompletarSheet, type ModoCompletar } from '@/components/CompletarSheet';
import { LevelUpOverlay } from '@/components/LevelUpOverlay';
import { OrdenDelDia } from '@/components/OrdenDelDia';
import { QuestItem } from '@/components/QuestItem';
import { prepararDatosSemana, ShareSemanaModal, type DatosSemana } from '@/components/ShareCardSemana';
import { SystemButton } from '@/components/SystemButton';
import { XpToast } from '@/components/XpToast';
import { XPBar } from '@/components/XPBar';
import {
  Card,
  EmptyState,
  FadeIn,
  ProgressRing,
  Row,
  Screen,
  ScreenHeader,
  Section,
  Skeleton,
  SkeletonRows,
  Stagger,
} from '@/components/ui';
import { evaluateAchievements, unlockAchievements } from '@/lib/achievements';
import { useAuth } from '@/lib/auth';
import { completionStats, ensureProfile, fetchCompletionsForDate, fetchQuests } from '@/lib/data';
import { fetchPlan, horaAMinutos, setBlockDone, type DayBlock, type PlanConBloques } from '@/lib/dayplan';
import { dateKey, formatLongDate, isValidKey, nombreDia } from '@/lib/dates';
import { completeQuest, processPendingDays, questsScheduledOn, type DayCloseResult } from '@/lib/engine';
import { rachaVisible } from '@/lib/closing';
import { levelFromXp, rankForLevel, streakMultiplier } from '@/lib/game';
import { kindMeta, modulesFor } from '@/lib/kinds';
import { RUTA_DE_ACTO } from '@/lib/links';
import {
  inicializarAvisos,
  programarDespertador,
  reconciliarAvisosDelDia,
} from '@/lib/notifications';
import { fetchAiStatus, isPro } from '@/lib/pro';
import { fetchBoard, type BoardEntry } from '@/lib/social';
import { clasificar, DIAS_VENTANA, lineaRivalidad } from '@/lib/socialmath';
import { colors, fonts } from '@/lib/theme';
import { useCountUp } from '@/lib/useCountUp';
import { mensajeSistema } from '@/lib/validation';
import { voice } from '@/lib/voice';
import type { Completion, Profile, Quest } from '@/lib/types';

function saludo(nombre: string): string {
  const h = new Date().getHours();
  const franja = h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  return `${franja}, ${nombre}.`;
}

// Padding horizontal de `Screen` (20 por lado) y hueco de la rejilla de módulos.
const PADDING_PANTALLA = 40;
const HUECO_MODULOS = 8;
const COLUMNAS_MODULOS = 4;

// Lo último que se supo de si la cuenta tiene coach. Vive fuera del componente
// para que volver a la pestaña no repinte Hoy "sin saberlo" medio segundo.
let ultimoPro: boolean | null = null;

/** Da tiempo a que la hoja (un Modal) termine de cerrarse antes de abrir la cámara: en iOS, presentar encima de un modal que se está yendo no abre nada. */
const esperarCierreDeHoja = () => new Promise<void>((ok) => setTimeout(ok, 420));

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
  // Hasta la primera carga no se sabe si hay misiones o plan: se pintan huecos,
  // no un "Nada programado" que medio segundo después es mentira.
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [esPro, setEsPro] = useState<boolean | null>(ultimoPro);
  const [board, setBoard] = useState<BoardEntry[] | null>(null);
  const [sheetQuest, setSheetQuest] = useState<Quest | null>(null);
  const [diaPerfecto, setDiaPerfecto] = useState(false);
  const [tarjeta, setTarjeta] = useState<DatosSemana | null>(null);
  const [preparandoTarjeta, setPreparandoTarjeta] = useState(false);
  const { width } = useWindowDimensions();
  const pulso = useRef(new Animated.Value(1)).current;
  // La misión de la hoja, también en ref: se vacía de forma SÍNCRONA al elegir
  // para que un doble toque en una opción no complete dos veces.
  const sheetRef = useRef<Quest | null>(null);

  const completing = useRef<Set<string>>(new Set());
  const clearToast = useCallback(() => setToast(null), []);

  const load = useCallback(async () => {
    if (!userId) return;
    // Lo accesorio va por su cuenta y nunca bloquea ni tumba Hoy: si la cuenta
    // tiene coach (decide qué se ofrece cuando no hay plan) y el marcador de
    // amigos (la línea de rivalidad).
    fetchAiStatus()
      .then((s) => {
        ultimoPro = isPro(s);
        setEsPro(ultimoPro);
      })
      .catch(() => {});
    fetchBoard(DIAS_VENTANA.semana)
      .then(setBoard)
      .catch(() => {});
    try {
      // Aquí NO se siembran misiones por defecto: quien eligió "Empezar sin
      // misiones" en el onboarding, o borró las suyas, ve el estado vacío.
      let prof = await ensureProfile(userId);
      let quests = await fetchQuests();
      const { profile: processed, result } = await processPendingDays(prof, quests);
      prof = processed;
      if (result && result.penaltyXp > 0) {
        quests = await fetchQuests();
      }
      const today = dateKey();
      const [done, planDeHoy] = await Promise.all([
        fetchCompletionsForDate(today),
        fetchPlan(today).catch(() => null),
      ]);
      const map: Record<string, Completion> = {};
      for (const c of done) map[c.quest_id] = c;

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
      setLoadError(null);
    } catch (e) {
      // En línea y con reintento, no en una alerta del sistema operativo: Hoy
      // se recarga en cada foco y sin red la alerta saltaba una y otra vez.
      setLoadError(mensajeSistema(e));
    } finally {
      setLoaded(true);
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

      // Día perfecto: era la última pendiente. Solo se celebra cuando pasa
      // delante del usuario, no al cargar un día que ya estaba cerrado.
      const quedan = todayQuests.filter((q) => q.id !== quest.id && !completions[q.id]).length;
      if (quedan === 0 && todayQuests.length > 0) {
        setDiaPerfecto(true);
        pulso.setValue(1);
        Animated.sequence([
          Animated.spring(pulso, { toValue: 1.18, useNativeDriver: true, speed: 30, bounciness: 12 }),
          Animated.spring(pulso, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 8 }),
        ]).start();
        setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}), 260);
      }

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
      Alert.alert('Error del sistema', mensajeSistema(e));
    }
  };

  const release = (questId: string) => {
    completing.current.delete(questId);
    setBusyQuestId((id) => (id === questId ? null : id));
  };

  const onComplete = (quest: Quest) => {
    // Cerrojo síncrono por misión: un doble toque mientras la cámara o la hoja
    // están abiertas ya no dispara dos completeQuest (evita XP duplicado). El
    // cerrojo se toma AQUÍ y lo suelta exactamente una de las salidas: el fin
    // del pago, la cámara cancelada, el cierre de la hoja o irse al módulo.
    if (completing.current.has(quest.id)) return;
    completing.current.add(quest.id);
    setBusyQuestId(quest.id);

    if (quest.is_penalty) {
      finishQuest(quest, null).finally(() => release(quest.id));
      return;
    }
    const acto = quest.link && quest.link !== 'ninguno' ? quest.link : null;
    // Evidencia obligatoria y sin módulo donde registrarla: no hay nada que
    // elegir, directa a la cámara.
    if (quest.requires_evidence && !acto) {
      captureEvidence()
        .then((b64) => (b64 ? finishQuest(quest, b64) : undefined))
        .finally(() => release(quest.id));
      return;
    }
    // Todo lo demás, en UNA hoja: completar, con foto, o registrar el acto en
    // su módulo (que la marca sola, con la regla y el bloque del plan). Marcarla
    // a pelo sigue siendo posible: hay días en que se entrena sin apuntar series.
    sheetRef.current = quest;
    setSheetQuest(quest);
  };

  const cerrarHoja = () => {
    const quest = sheetRef.current;
    sheetRef.current = null;
    setSheetQuest(null);
    if (quest) release(quest.id);
  };

  const elegirEnHoja = (modo: ModoCompletar) => {
    const quest = sheetRef.current;
    if (!quest) return;
    sheetRef.current = null;
    setSheetQuest(null);
    const acto = quest.link && quest.link !== 'ninguno' ? quest.link : null;
    if (modo === 'registrar' && acto) {
      release(quest.id);
      router.push(RUTA_DE_ACTO[acto]);
      return;
    }
    if (modo === 'foto' || quest.requires_evidence) {
      esperarCierreDeHoja()
        .then(captureEvidence)
        .then((b64) => (b64 ? finishQuest(quest, b64) : undefined))
        .finally(() => release(quest.id));
      return;
    }
    finishQuest(quest, null).finally(() => release(quest.id));
  };

  const compartirDia = async () => {
    if (!userId || preparandoTarjeta) return;
    setPreparandoTarjeta(true);
    try {
      // El marcador se pide de nuevo: el que hay en memoria es de antes de
      // completar la última misión.
      setTarjeta(await prepararDatosSemana(userId));
    } catch (e) {
      Alert.alert('Error del sistema', mensajeSistema(e));
    } finally {
      setPreparandoTarjeta(false);
    }
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
  // Cuatro por fila, medido: con `width: '23.5%'` + gap 8 la cuarta no cabía
  // en ningún móvil y la rejilla caía a tres columnas.
  const tile = Math.floor((width - PADDING_PANTALLA - HUECO_MODULOS * (COLUMNAS_MODULOS - 1)) / COLUMNAS_MODULOS);
  const xpEnNivel = useCountUp(lvl?.into ?? 0, 600);
  const celebrando = diaPerfecto && pendingCount === 0 && sorted.length > 0;
  const hayPlan = !!plan && plan.bloques.length > 0;
  // La rivalidad solo existe con al menos un amigo visible en el marcador.
  const visibles = (board ?? []).filter((b) => b.visible);
  const rivalidad =
    visibles.some((b) => !b.isMe) && visibles.some((b) => b.isMe)
      ? lineaRivalidad(clasificar(visibles, 'xp'), 'xp', 'semana')
      : null;
  const hastaCuando =
    profile?.freeze_until && isValidKey(profile.freeze_until) ? nombreDia(profile.freeze_until).toLowerCase() : null;

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
    <Screen
      refreshing={refreshing}
      onRefresh={onRefresh}
      overlay={<XpToast xp={toast?.xp ?? null} bonus={toast?.bonus} unit={toast?.unit} onDone={clearToast} />}
    >
      <Stagger>
        <FadeIn index={0}>
          <ScreenHeader
            eyebrow={formatLongDate()}
            title={profile ? saludo(profile.name) : 'Hoy'}
            subtitle={subtitulo}
            right={
              sorted.length > 0 ? (
                <Animated.View style={{ transform: [{ scale: pulso }] }}>
                  <ProgressRing
                    ratio={completedCount / sorted.length}
                    size={66}
                    stroke={4}
                    color={celebrando ? colors.gold : colors.accent}
                    label={`${completedCount}/${sorted.length}`}
                    sublabel="hoy"
                  />
                </Animated.View>
              ) : undefined
            }
          />
        </FadeIn>

        {loadError ? (
          <Card variant="outline" accent={colors.redDim}>
            <EmptyState
              compact
              icon="cloud-offline-outline"
              title={profile ? 'No se ha podido actualizar' : 'El sistema no responde'}
              body={loadError}
              action={{ label: 'Reintentar', onPress: onRefresh }}
            />
          </Card>
        ) : null}

        {!loaded ? (
          <View accessibilityRole="progressbar" accessibilityLabel="Cargando tu día">
            <Skeleton height={132} style={styles.skCard} />
            <Skeleton height={11} width={120} style={styles.skEyebrow} />
            <Skeleton height={64} style={styles.skCard} />
            <Skeleton height={11} width={140} style={styles.skEyebrow} />
            <SkeletonRows rows={4} />
          </View>
        ) : null}

        {loaded && profile && lvl ? (
          <FadeIn index={1}>
            <Card>
              <View style={styles.profileRow}>
                <Avatar size={52} avatarPath={profile.avatar_url} name={profile.name} />
                <View style={styles.profileInfo}>
                  <Text style={styles.name} numberOfLines={1}>
                    {profile.equipped_title ? `« ${profile.equipped_title} »` : kind.title}
                  </Text>
                  <Text style={styles.rank}>
                    RANGO {rankForLevel(lvl.level)} · {lvl.next > 0 ? `${xpEnNivel} / ${lvl.next} XP` : 'NIVEL MÁXIMO'}
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

        {loaded && rivalidad ? (
          <FadeIn index={2}>
            <Card padded={false} style={styles.rivalCard}>
              <Row
                first
                chevron
                leading={<Ionicons name="people-outline" size={18} color={colors.textDim} />}
                title={rivalidad}
                onPress={() => router.push('/amigos')}
                accessibilityLabel={`${rivalidad} Abrir Amigos`}
              />
            </Card>
          </FadeIn>
        ) : null}

        {loaded && frozen && profile ? (
          <FadeIn index={2}>
            <Card variant="outline" accent={colors.accentDim}>
              <Text style={styles.alertTitle}>
                <Ionicons name="snow-outline" size={12} color={colors.accentText} /> SISTEMA EN PAUSA
              </Text>
              <Text style={styles.alertBody}>
                {voice.frozen(profile.freeze_reason ?? 'pausa')}
                {hastaCuando ? ` Hasta el ${hastaCuando}.` : ''}
              </Text>
            </Card>
          </FadeIn>
        ) : null}

        {loaded && dayResult ? (
          <FadeIn index={2}>
            <Card variant="outline" accent={dayResult.penaltyXp > 0 ? colors.red : colors.gold}>
              <Text style={[styles.alertTitle, { color: dayResult.penaltyXp > 0 ? colors.red : colors.gold }]}>
                {dayResult.penaltyXp > 0 ? 'ALERTA DEL SISTEMA' : 'INFORME DEL CIERRE'}
              </Text>
              {dayResult.stonesUsed > 0 ? <Text style={styles.alertBody}>{voice.stoneUsed()}</Text> : null}
              {dayResult.penaltyXp > 0 ? (
                <Text style={styles.alertBody}>
                  {voice.penaltyApplied(dayResult.penaltyXp)}
                  {dayResult.levelsLost > 0
                    ? ` Has perdido ${dayResult.levelsLost} ${dayResult.levelsLost === 1 ? 'nivel' : 'niveles'}.`
                    : ''}
                </Text>
              ) : dayResult.streakLost ? (
                <Text style={styles.alertBody}>Racha perdida. El contador vuelve a cero.</Text>
              ) : null}
              {dayResult.stonesEarned > 0 ? <Text style={styles.alertBody}>{voice.stoneEarned()}</Text> : null}
            </Card>
          </FadeIn>
        ) : null}

        {/* Sin plan, el hueco de "Orden del día" solo se le enseña a quien tiene
            coach (puede pedirlo). A una cuenta gratuita le abría el día con un
            callejón: Pedir el plan → coach con candado → paywall. */}
        {loaded && (hayPlan || esPro === true) ? (
          <FadeIn index={3}>
            <OrdenDelDia
              plan={plan?.plan ?? null}
              bloques={plan?.bloques ?? []}
              onToggle={alternarBloque}
              pro={esPro === true}
            />
          </FadeIn>
        ) : null}

        {celebrando ? (
          <FadeIn>
            <Card variant="outline" accent={colors.gold}>
              <Text style={[styles.alertTitle, { color: colors.gold }]}>DÍA PERFECTO</Text>
              <Text style={styles.alertBody}>Día perfecto. Racha {racha.valor}.</Text>
              <SystemButton
                title="Compartir"
                icon="share-social-outline"
                variant="outline"
                size="sm"
                onPress={compartirDia}
                loading={preparandoTarjeta}
                style={styles.compartir}
              />
            </Card>
          </FadeIn>
        ) : null}

        {loaded ? (
        <FadeIn index={4}>
          <Section title="Misiones de hoy" meta={sorted.length > 0 ? `${completedCount}/${sorted.length}` : undefined}>
            {sorted.length === 0 ? (
              <Card variant="outline">
                <EmptyState
                  compact
                  icon="repeat-outline"
                  title="Nada programado para hoy"
                  body={esPro === true ? 'Crea tus misiones en Hábitos o pídeselas al coach.' : 'Crea tus misiones en Hábitos.'}
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
            {/* Una sola línea, callada y DEBAJO de las misiones: lo gratis va
                primero y el coach se ofrece sin cortar el paso. */}
            {esPro === false && !hayPlan ? (
              <Card padded={false} style={styles.proRow}>
                <Row
                  first
                  chevron
                  muted
                  leading={<Ionicons name="shield-half-outline" size={18} color={colors.textFaint} />}
                  title="El plan del día lo escribe el coach · NIVL Pro"
                  onPress={() => router.push('/pro')}
                  accessibilityLabel="El plan del día lo escribe el coach. Ver NIVL Pro"
                />
              </Card>
            ) : null}
          </Section>
        </FadeIn>
        ) : null}

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
                  style={({ pressed }) => [styles.module, { width: tile, height: tile }, pressed && styles.modulePressed]}
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

      <CompletarSheet quest={sheetQuest} onElegir={elegirEnHoja} onClose={cerrarHoja} />
      <ShareSemanaModal visible={tarjeta !== null} datos={tarjeta} onClose={() => setTarjeta(null)} />
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
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.textFaint,
    marginTop: 4,
  },
  levelBox: { alignItems: 'flex-end' },
  lvLabel: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 1.7, color: colors.textFaint },
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
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: HUECO_MODULOS },
  // El lado del azulejo se calcula con el ancho de la ventana (ver `tile`).
  module: {
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  modulePressed: { backgroundColor: colors.accentFaint },
  moduleLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textDim, paddingHorizontal: 4 },
  skCard: { marginBottom: 26 },
  skEyebrow: { marginBottom: 12 },
  rivalCard: { paddingHorizontal: 16, paddingVertical: 2 },
  proRow: { paddingHorizontal: 16, paddingVertical: 2, marginTop: 12, marginBottom: 0 },
  compartir: { alignSelf: 'flex-start', marginTop: 8 },
  motto: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2.7,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 8,
  },
});

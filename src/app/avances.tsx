import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SystemButton } from '@/components/SystemButton';
import { TrendLine } from '@/components/TrendLine';
import { XPBar } from '@/components/XPBar';
import {
  Card,
  Chip,
  ChipWrap,
  EmptyState,
  FadeIn,
  Row,
  RowValue,
  Screen,
  ScreenHeader,
  Section,
  Stagger,
  Stat,
  StatRow,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { ensureProfile } from '@/lib/data';
import { dateKey } from '@/lib/dates';
import { awardXp } from '@/lib/engine';
import { GOAL_ACHIEVED_XP, goalProgress, WEIGH_IN_XP } from '@/lib/game';
import {
  createGoal,
  currentGoalValue,
  deleteGoal,
  fetchExerciseSeries,
  fetchGoals,
  fetchPersonalRecords,
  fetchWeights,
  updateGoal,
  upsertWeight,
} from '@/lib/progress';
import { colors, fonts } from '@/lib/theme';
import type { BodyMetric, Goal, GoalMetric } from '@/lib/types';

const METRIC_OPTIONS: { key: GoalMetric; label: string }[] = [
  { key: 'peso_corporal', label: 'Peso corporal' },
  { key: 'ejercicio', label: 'Ejercicio (PR)' },
  { key: 'libre', label: 'Libre' },
];

export default function Avances() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { width } = useWindowDimensions();
  // Ancho de la gráfica: el de la pantalla menos el padding de Screen (20+20)
  // y el de la Card (16+16).
  const chartWidth = Math.min(width - 72, 340);

  const [weights, setWeights] = useState<BodyMetric[]>([]);
  const [weightInput, setWeightInput] = useState('');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [prs, setPrs] = useState<{ exercise: string; weight: number }[]>([]);
  const [series, setSeries] = useState<{ exercise: string; values: number[] } | null>(null);
  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [gTitle, setGTitle] = useState('');
  const [gMetric, setGMetric] = useState<GoalMetric>('peso_corporal');
  const [gExercise, setGExercise] = useState('');
  const [gStart, setGStart] = useState('');
  const [gTarget, setGTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const lock = useRef(false);

  const load = useCallback(async () => {
    try {
      const [ws, gs, records] = await Promise.all([
        fetchWeights(180),
        fetchGoals(),
        fetchPersonalRecords(),
      ]);
      setWeights(ws);
      setGoals(gs);
      setPrs(records);
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

  const latestWeight = weights.length > 0 ? weights[weights.length - 1]!.weight_kg : null;

  const saveWeight = async () => {
    if (!userId || lock.current) return;
    const value = parseFloat(weightInput.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 20 || value >= 400) {
      Alert.alert('Valor inválido', 'Introduce tu peso en kg, p. ej. 78,4');
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      const { isNew } = await upsertWeight(userId, dateKey(), value);
      if (isNew) {
        const profile = await ensureProfile(userId);
        await awardXp(profile, WEIGH_IN_XP, 'VIT', 'weigh_in', { weight: value });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setWeightInput('');
      await load();
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const addGoal = async () => {
    if (!userId || lock.current) return;
    const start = parseFloat(gStart.replace(',', '.'));
    const target = parseFloat(gTarget.replace(',', '.'));
    if (!gTitle.trim() || !Number.isFinite(start) || !Number.isFinite(target) || start === target) {
      Alert.alert('Meta incompleta', 'Título, valor inicial y valor objetivo (distintos).');
      return;
    }
    if (gMetric === 'ejercicio' && !gExercise.trim()) {
      Alert.alert('Falta el ejercicio', 'Escribe el nombre EXACTO del ejercicio del gym.');
      return;
    }
    lock.current = true;
    try {
      await createGoal(userId, {
        title: gTitle.trim(),
        metric_type: gMetric,
        exercise_name: gMetric === 'ejercicio' ? gExercise.trim() : null,
        start_value: start,
        target_value: target,
        unit: 'kg',
      });
      setGTitle('');
      setGStart('');
      setGTarget('');
      setGoalFormOpen(false);
      await load();
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    } finally {
      lock.current = false;
    }
  };

  const achieveGoal = (goal: Goal) => {
    Alert.alert('META CONSEGUIDA', `"${goal.title}" — el sistema otorgará +${GOAL_ACHIEVED_XP} XP.`, [
      { text: 'Aún no', style: 'cancel' },
      {
        text: 'Reclamar',
        onPress: async () => {
          if (!userId || lock.current) return;
          lock.current = true;
          try {
            await updateGoal(goal.id, { status: 'achieved', achieved_at: new Date().toISOString() });
            const profile = await ensureProfile(userId);
            await awardXp(profile, GOAL_ACHIEVED_XP, 'AGI', 'goal_achieved', { goal: goal.title });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await load();
          } catch (e) {
            Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
          } finally {
            lock.current = false;
          }
        },
      },
    ]);
  };

  const removeGoal = (goal: Goal) => {
    Alert.alert('Eliminar meta', goal.title, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteGoal(goal.id);
            await load();
          } catch (e) {
            Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
          }
        },
      },
    ]);
  };

  const [freeGoal, setFreeGoal] = useState<Goal | null>(null);
  const [freeValue, setFreeValue] = useState('');

  const saveFreeGoal = async () => {
    if (!freeGoal) return;
    const v = parseFloat(freeValue.replace(',', '.'));
    if (!Number.isFinite(v)) {
      Alert.alert('Valor inválido', 'Introduce un número.');
      return;
    }
    try {
      await updateGoal(freeGoal.id, { current_value: v });
      setFreeGoal(null);
      setFreeValue('');
      await load();
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    }
  };

  const showSeries = async (exercise: string) => {
    try {
      const s = await fetchExerciseSeries(exercise);
      setSeries({ exercise, values: s.map((p) => p.weight) });
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    }
  };

  const activeGoals = goals.filter((g) => g.status === 'active');
  const achievedGoals = goals.filter((g) => g.status === 'achieved');
  const firstWeight = weights.length > 0 ? weights[0]!.weight_kg : null;
  const deltaPeso = latestWeight !== null && firstWeight !== null ? Math.round((latestWeight - firstWeight) * 10) / 10 : null;

  const subtitulo =
    latestWeight === null
      ? 'Registra tu primer pesaje: es tu línea de salida.'
      : `Último pesaje: ${latestWeight} kg${deltaPeso !== null && deltaPeso !== 0 ? ` (${deltaPeso > 0 ? '+' : ''}${deltaPeso} kg en ${weights.length} pesajes)` : ''}.`;

  return (
    <Screen refreshing={refrescando} onRefresh={refrescar}>
      <Stagger>
        <FadeIn index={0}>
          <ScreenHeader
            onBack={() => router.back()}
            eyebrow="Progreso"
            title="Avances"
            subtitle={subtitulo}
            action={{ icon: 'add', label: 'Nueva meta', onPress: () => setGoalFormOpen(true), solid: true }}
          />
        </FadeIn>

        <FadeIn index={1}>
          <Card>
            <StatRow>
              <Stat value={latestWeight ?? '—'} unit={latestWeight === null ? undefined : 'kg'} label="Peso" size="lg" />
              <Stat value={activeGoals.length} label="Metas" />
              <Stat value={achievedGoals.length} label="Logradas" tone={achievedGoals.length > 0 ? 'gold' : 'text'} />
              <Stat value={prs.length} label="Récords" />
            </StatRow>
            <View style={styles.pesajeFila}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={weightInput}
                onChangeText={setWeightInput}
                keyboardType="decimal-pad"
                placeholder="Peso de hoy (kg)"
                placeholderTextColor={colors.textFaint}
                accessibilityLabel="Peso de hoy en kilogramos"
              />
              <SystemButton title={`Pesar +${WEIGH_IN_XP} XP`} variant="outline" onPress={saveWeight} loading={busy} />
            </View>
            {weights.length > 1 ? (
              <View style={styles.grafica}>
                <TrendLine values={weights.map((w) => w.weight_kg)} width={chartWidth} />
              </View>
            ) : null}
          </Card>
        </FadeIn>

        <FadeIn index={2}>
          <Section title="Metas" meta={activeGoals.length > 0 ? `${activeGoals.length} activas` : undefined}>
            {activeGoals.length === 0 ? (
              <Card variant="outline">
                <EmptyState
                  compact
                  icon="flag-outline"
                  title="Sin metas fijadas"
                  body="Una meta es un número con fecha: press banca 100 kg, bajar a 78 kg. Ponle cifra a tu objetivo."
                  action={{ label: 'Fijar la primera', onPress: () => setGoalFormOpen(true) }}
                />
              </Card>
            ) : (
              activeGoals.map((g, i) => {
                const current = currentGoalValue(g, latestWeight, prs);
                const progress = current === null ? 0 : goalProgress(g.start_value, g.target_value, current);
                const done = progress >= 1;
                return (
                  <FadeIn key={g.id} index={i}>
                    <Card accent={done ? colors.gold : undefined}>
                      <View style={styles.metaCabecera}>
                        <Text style={styles.metaTitulo} numberOfLines={2}>
                          {g.title}
                        </Text>
                        <Text style={[styles.metaPct, done && styles.oro]}>{Math.round(progress * 100)}%</Text>
                      </View>
                      <View style={{ marginTop: 10 }}>
                        <XPBar ratio={progress} color={done ? colors.gold : colors.accent} height={7} />
                      </View>
                      <View style={styles.metaPie}>
                        <Text style={styles.metaDetalle} numberOfLines={1}>
                          {g.start_value} → <Text style={styles.metaActual}>{current ?? '?'}</Text> → {g.target_value} {g.unit}
                        </Text>
                        <View style={styles.metaAcciones}>
                          {done ? (
                            <Chip
                              label="Reclamar"
                              small
                              tone="gold"
                              icon="ribbon-outline"
                              onPress={() => achieveGoal(g)}
                              accessibilityLabel={`Reclamar meta ${g.title}`}
                            />
                          ) : g.metric_type === 'libre' ? (
                            <Chip
                              label="Actualizar"
                              small
                              onPress={() => {
                                setFreeGoal(g);
                                setFreeValue(String(g.current_value ?? g.start_value));
                              }}
                              accessibilityLabel={`Actualizar progreso de ${g.title}`}
                            />
                          ) : null}
                          <Pressable
                            onPress={() => removeGoal(g)}
                            hitSlop={8}
                            style={({ pressed }) => [styles.papelera, pressed && styles.pulsado]}
                            accessibilityRole="button"
                            accessibilityLabel={`Eliminar meta ${g.title}`}
                          >
                            <Ionicons name="trash-outline" size={16} color={colors.textFaint} />
                          </Pressable>
                        </View>
                      </View>
                    </Card>
                  </FadeIn>
                );
              })
            )}
          </Section>
        </FadeIn>

        {achievedGoals.length > 0 ? (
          <FadeIn index={3}>
            <Section title="Conseguidas" meta={`${achievedGoals.length}`} tone="gold">
              <Card padded={false} style={styles.lista}>
                {achievedGoals.map((g, i) => (
                  <Row
                    key={g.id}
                    first={i === 0}
                    leading={<Ionicons name="ribbon" size={18} color={colors.gold} />}
                    title={g.title}
                    muted
                    detail={g.achieved_at ? `Conseguida el ${g.achieved_at.slice(0, 10)}` : undefined}
                    trailing={
                      <RowValue tone="gold">
                        {g.target_value} {g.unit}
                      </RowValue>
                    }
                  />
                ))}
              </Card>
            </Section>
          </FadeIn>
        ) : null}

        <FadeIn index={4}>
          <Section title="Récords personales" meta={prs.length > 0 ? `${prs.length}` : undefined}>
            {prs.length === 0 ? (
              <Card variant="outline">
                <EmptyState
                  compact
                  icon="barbell-outline"
                  title="Sin récords todavía"
                  body="Aparecen aquí al registrar sesiones de gimnasio con peso."
                />
              </Card>
            ) : (
              <Card padded={false} style={styles.lista}>
                {prs.map((r, i) => (
                  <Row
                    key={r.exercise}
                    first={i === 0}
                    title={r.exercise}
                    detail={series?.exercise === r.exercise ? 'Progresión abierta' : undefined}
                    trailing={<RowValue strong tone="accent">{r.weight} kg</RowValue>}
                    chevron
                    onPress={() => showSeries(r.exercise)}
                    accessibilityLabel={`Ver progresión de ${r.exercise}`}
                  />
                ))}
              </Card>
            )}
            {series ? (
              <Card>
                <Text style={styles.eyebrow}>Progresión · {series.exercise}</Text>
                <TrendLine values={series.values} width={chartWidth} />
              </Card>
            ) : null}
          </Section>
        </FadeIn>
      </Stagger>

      <Modal visible={freeGoal !== null} transparent animationType="slide" onRequestClose={() => setFreeGoal(null)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.backdropTap} onPress={() => setFreeGoal(null)} accessibilityLabel="Cerrar" />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetEyebrow}>PROGRESO MANUAL</Text>
            <Text style={styles.sheetTitle} numberOfLines={2}>
              {freeGoal?.title}
            </Text>
            <Text style={styles.label}>Valor actual ({freeGoal?.unit})</Text>
            <TextInput
              style={styles.input}
              value={freeValue}
              onChangeText={setFreeValue}
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textFaint}
              accessibilityLabel="Valor actual de la meta"
              autoFocus
            />
            <SystemButton title="Guardar" onPress={saveFreeGoal} style={{ marginTop: 22 }} />
            <SystemButton title="Cancelar" variant="ghost" onPress={() => setFreeGoal(null)} style={{ marginTop: 6 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={goalFormOpen} transparent animationType="slide" onRequestClose={() => setGoalFormOpen(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.backdropTap} onPress={() => setGoalFormOpen(false)} accessibilityLabel="Cerrar" />
          <View style={[styles.sheet, styles.sheetAlta]}>
            <View style={styles.sheetHandle} />
            <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetEyebrow}>NUEVA META</Text>
              <Text style={styles.sheetTitle}>¿Qué cifra vas a alcanzar?</Text>
              <Text style={styles.label}>Título</Text>
              <TextInput
                style={styles.input}
                value={gTitle}
                onChangeText={setGTitle}
                placeholder="Ej. Press banca 100 kg"
                placeholderTextColor={colors.textFaint}
                accessibilityLabel="Título de la meta"
                autoFocus
              />
              <Text style={styles.label}>Se mide con</Text>
              <ChipWrap>
                {METRIC_OPTIONS.map((m) => (
                  <Chip
                    key={m.key}
                    label={m.label}
                    selected={gMetric === m.key}
                    onPress={() => setGMetric(m.key)}
                    accessibilityLabel={`Medir con ${m.label}`}
                  />
                ))}
              </ChipWrap>
              {gMetric === 'ejercicio' ? (
                <>
                  <Text style={styles.label}>Ejercicio (nombre exacto del gym)</Text>
                  <TextInput
                    style={styles.input}
                    value={gExercise}
                    onChangeText={setGExercise}
                    placeholder="Ej. Press banca"
                    placeholderTextColor={colors.textFaint}
                    accessibilityLabel="Nombre del ejercicio"
                  />
                </>
              ) : null}
              <View style={styles.inlineInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Valor inicial</Text>
                  <TextInput
                    style={styles.input}
                    value={gStart}
                    onChangeText={setGStart}
                    keyboardType="decimal-pad"
                    placeholder="85"
                    placeholderTextColor={colors.textFaint}
                    accessibilityLabel="Valor inicial"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Objetivo</Text>
                  <TextInput
                    style={styles.input}
                    value={gTarget}
                    onChangeText={setGTarget}
                    keyboardType="decimal-pad"
                    placeholder="78"
                    placeholderTextColor={colors.textFaint}
                    accessibilityLabel="Valor objetivo"
                  />
                </View>
              </View>
              <Text style={styles.hint}>Al alcanzarla, el sistema paga +{GOAL_ACHIEVED_XP} XP.</Text>
              <SystemButton title="Fijar la meta" onPress={addGoal} disabled={!gTitle.trim()} style={{ marginTop: 22 }} />
              <SystemButton title="Cancelar" variant="ghost" onPress={() => setGoalFormOpen(false)} style={{ marginTop: 6 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lista: { paddingHorizontal: 16, paddingVertical: 2 },
  pesajeFila: { flexDirection: 'row', gap: 8, marginTop: 18, alignItems: 'stretch' },
  grafica: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line },
  metaCabecera: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  metaTitulo: { flex: 1, minWidth: 0, fontFamily: fonts.heading, fontSize: 17, letterSpacing: -0.2, color: colors.text },
  metaPct: { fontFamily: fonts.number, fontSize: 18, color: colors.text },
  oro: { color: colors.gold },
  metaPie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12 },
  metaDetalle: { flex: 1, minWidth: 0, fontFamily: fonts.body, fontSize: 12.5, color: colors.textFaint },
  metaActual: { fontFamily: fonts.semibold, color: colors.text },
  metaAcciones: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  papelera: { padding: 4 },
  pulsado: { opacity: 0.6 },
  eyebrow: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: colors.textFaint,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.accentDim,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  backdropTap: { flex: 1 },
  sheet: {
    backgroundColor: colors.panel,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
  },
  sheetAlta: { maxHeight: '88%' },
  sheetHandle: { alignSelf: 'center', width: 36, height: 3, backgroundColor: colors.accentDim, marginBottom: 16 },
  sheetEyebrow: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 2.5, color: colors.accentText },
  sheetTitle: { fontFamily: fonts.heading, fontSize: 24, letterSpacing: -0.5, color: colors.text, marginTop: 6, marginBottom: 4 },
  label: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textFaint,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
  },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 12, lineHeight: 17 },
  inlineInputs: { flexDirection: 'row', gap: 10 },
});

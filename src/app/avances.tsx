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
import { SafeAreaView } from 'react-native-safe-area-context';
import { SystemButton } from '@/components/SystemButton';
import { SystemWindow } from '@/components/SystemWindow';
import { TrendLine } from '@/components/TrendLine';
import { XPBar } from '@/components/XPBar';
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
  const chartWidth = Math.min(width - 64, 340);

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

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Volver">
            <Ionicons name="chevron-back" size={24} color={colors.cyan} />
          </Pressable>
          <Text style={styles.title}>MIS AVANCES</Text>
          <Pressable
            onPress={() => setGoalFormOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Nueva meta"
          >
            <Ionicons name="add" size={24} color={colors.cyan} />
          </Pressable>
        </View>

        <SystemWindow color={colors.cyanDim}>
          <Text style={styles.windowTitle}>PESO CORPORAL</Text>
          {latestWeight !== null ? (
            <Text style={styles.bigValue}>
              {latestWeight} <Text style={styles.bigUnit}>kg</Text>
            </Text>
          ) : (
            <Text style={styles.empty}>Registra tu primer pesaje: es tu línea de salida.</Text>
          )}
          <View style={styles.weighRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="decimal-pad"
              placeholder="Peso de hoy (kg)"
              placeholderTextColor={colors.textFaint}
              accessibilityLabel="Peso de hoy en kilogramos"
            />
            <SystemButton title={`Registrar +${WEIGH_IN_XP} XP`} onPress={saveWeight} loading={busy} />
          </View>
          {weights.length > 1 ? (
            <View style={{ marginTop: 14 }}>
              <TrendLine values={weights.map((w) => w.weight_kg)} width={chartWidth} />
            </View>
          ) : null}
        </SystemWindow>

        <SystemWindow color={colors.cyanDim}>
          <Text style={styles.windowTitle}>METAS · {activeGoals.length} ACTIVAS</Text>
          {activeGoals.length === 0 ? (
            <Text style={styles.empty}>
              Una meta es un número con fecha: &quot;press banca 100 kg&quot;, &quot;bajar a 78 kg&quot;. Pulsa + y
              ponle cifra a tu objetivo.
            </Text>
          ) : (
            activeGoals.map((g) => {
              const current = currentGoalValue(g, latestWeight, prs);
              const progress = current === null ? 0 : goalProgress(g.start_value, g.target_value, current);
              const done = progress >= 1;
              return (
                <View key={g.id} style={styles.goalRow}>
                  <View style={styles.goalHeader}>
                    <Text style={styles.goalTitle} numberOfLines={1}>
                      {g.title}
                    </Text>
                    <Pressable onPress={() => removeGoal(g)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Eliminar meta ${g.title}`}>
                      <Ionicons name="trash-outline" size={16} color={colors.textFaint} />
                    </Pressable>
                  </View>
                  <View style={{ marginTop: 6 }}>
                    <XPBar ratio={progress} color={done ? colors.amber : colors.cyan} />
                  </View>
                  <View style={styles.goalMetaRow}>
                    <Text style={styles.goalMeta}>
                      {g.start_value} → {current ?? '?'} → {g.target_value} {g.unit} ·{' '}
                      {Math.round(progress * 100)}%
                    </Text>
                    {done ? (
                      <Pressable onPress={() => achieveGoal(g)} style={styles.claimBtn} accessibilityRole="button" accessibilityLabel={`Reclamar meta ${g.title}`}>
                        <Text style={styles.claimBtnText}>RECLAMAR</Text>
                      </Pressable>
                    ) : g.metric_type === 'libre' ? (
                      <Pressable
                        onPress={() => {
                          setFreeGoal(g);
                          setFreeValue(String(g.current_value ?? g.start_value));
                        }}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel="Actualizar progreso manual"
                      >
                        <Text style={styles.updateText}>actualizar</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
          {achievedGoals.length > 0 ? (
            <Text style={styles.achievedLine}>
              Conseguidas: {achievedGoals.map((g) => g.title).join(' · ')}
            </Text>
          ) : null}
        </SystemWindow>

        <SystemWindow color={colors.cyanDim}>
          <Text style={styles.windowTitle}>RÉCORDS PERSONALES</Text>
          {prs.length === 0 ? (
            <Text style={styles.empty}>
              Tus PRs aparecerán aquí al registrar sesiones en el Gym con peso.
            </Text>
          ) : (
            prs.map((r) => (
              <Pressable
                key={r.exercise}
                onPress={() => showSeries(r.exercise)}
                style={styles.prRow}
                accessibilityRole="button"
                accessibilityLabel={`Ver progresión de ${r.exercise}`}
              >
                <Text style={styles.prName} numberOfLines={1}>
                  {r.exercise}
                </Text>
                <Text style={styles.prWeight}>{r.weight} kg</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textFaint} />
              </Pressable>
            ))
          )}
          {series ? (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.seriesTitle}>PROGRESIÓN · {series.exercise.toUpperCase()}</Text>
              <TrendLine values={series.values} width={chartWidth} color={colors.amber} />
            </View>
          ) : null}
        </SystemWindow>
      </ScrollView>

      <Modal visible={freeGoal !== null} transparent animationType="slide" onRequestClose={() => setFreeGoal(null)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>ACTUALIZAR PROGRESO</Text>
            <Text style={styles.label}>{freeGoal?.title} ({freeGoal?.unit})</Text>
            <TextInput
              style={styles.input}
              value={freeValue}
              onChangeText={setFreeValue}
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textFaint}
              accessibilityLabel="Valor actual de la meta"
            />
            <SystemButton title="Guardar" onPress={saveFreeGoal} style={{ marginTop: 18 }} />
            <SystemButton title="Cancelar" variant="outline" onPress={() => setFreeGoal(null)} style={{ marginTop: 10 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={goalFormOpen} transparent animationType="slide" onRequestClose={() => setGoalFormOpen(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.sheetTitle}>NUEVA META</Text>
              <Text style={styles.label}>Título</Text>
              <TextInput
                style={styles.input}
                value={gTitle}
                onChangeText={setGTitle}
                placeholder="Ej. Press banca 100 kg"
                placeholderTextColor={colors.textFaint}
              />
              <Text style={styles.label}>Se mide con</Text>
              <View style={styles.chips}>
                {METRIC_OPTIONS.map((m) => (
                  <Pressable
                    key={m.key}
                    onPress={() => setGMetric(m.key)}
                    style={[styles.chip, gMetric === m.key && styles.chipOn]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: gMetric === m.key }}
                  >
                    <Text style={[styles.chipText, gMetric === m.key && styles.chipTextOn]}>{m.label}</Text>
                  </Pressable>
                ))}
              </View>
              {gMetric === 'ejercicio' ? (
                <>
                  <Text style={styles.label}>Ejercicio (nombre exacto del gym)</Text>
                  <TextInput
                    style={styles.input}
                    value={gExercise}
                    onChangeText={setGExercise}
                    placeholder="Ej. Press banca"
                    placeholderTextColor={colors.textFaint}
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
                  />
                </View>
              </View>
              <SystemButton title="Fijar la meta" onPress={addGoal} style={{ marginTop: 18 }} />
              <SystemButton title="Cancelar" variant="outline" onPress={() => setGoalFormOpen(false)} style={{ marginTop: 10 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    marginBottom: 8,
  },
  bigValue: { fontFamily: fonts.brand, fontSize: 34, color: colors.text },
  bigUnit: { fontFamily: fonts.heading, fontSize: 16, color: colors.textDim },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, lineHeight: 19 },
  weighRow: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'stretch' },
  input: {
    borderWidth: 1,
    borderColor: colors.cyanDim,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  goalRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  goalTitle: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  goalMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
  },
  goalMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim },
  claimBtn: { borderWidth: 1, borderColor: colors.amber, paddingHorizontal: 10, paddingVertical: 4 },
  claimBtnText: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 1.5, color: colors.amber },
  updateText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.cyanText },
  achievedLine: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 10, lineHeight: 17 },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  prName: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  prWeight: { fontFamily: fonts.heading, fontSize: 14, color: colors.amber },
  seriesTitle: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textDim,
    marginBottom: 8,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 14, 0.85)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.panel,
    borderTopWidth: 1.5,
    borderTopColor: colors.cyanDim,
    padding: 20,
    paddingBottom: 34,
    maxHeight: '88%',
  },
  sheetTitle: { fontFamily: fonts.heading, fontSize: 15, letterSpacing: 3, color: colors.cyan, marginBottom: 6 },
  label: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 1.5,
    color: colors.textDim,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 7,
  },
  inlineInputs: { flexDirection: 'row', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.cyanDim, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.cyanFaint, borderColor: colors.cyan },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textDim },
  chipTextOn: { color: colors.cyan },
});

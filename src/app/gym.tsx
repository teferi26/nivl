import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LevelUpOverlay } from '@/components/LevelUpOverlay';
import { SystemButton } from '@/components/SystemButton';
import { SystemWindow } from '@/components/SystemWindow';
import { evaluateAchievements, unlockAchievements } from '@/lib/achievements';
import { useAuth } from '@/lib/auth';
import {
  createGymDay,
  createGymExercise,
  createSession,
  deleteGymDay,
  deleteGymExercise,
  fetchGymDays,
  fetchGymExercises,
  fetchMaxLifts,
  fetchSessionForDate,
  insertLifts,
} from '@/lib/body';
import { ensureProfile, insertEvent } from '@/lib/data';
import { dateKey, isoWeekday } from '@/lib/dates';
import { awardXp } from '@/lib/engine';
import { GYM_SESSION_XP, PR_XP } from '@/lib/game';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';
import { voice } from '@/lib/voice';
import type { GymDay, GymExercise, GymSession } from '@/lib/types';

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

interface LiftInput {
  exercise: string;
  weight: string;
  reps: string;
}

export default function Gym() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [days, setDays] = useState<GymDay[]>([]);
  const [exercises, setExercises] = useState<GymExercise[]>([]);
  const [todaySession, setTodaySession] = useState<GymSession | null>(null);
  const [training, setTraining] = useState(false);
  const [lifts, setLifts] = useState<LiftInput[]>([]);
  const [dayFormOpen, setDayFormOpen] = useState(false);
  const [newDayOfWeek, setNewDayOfWeek] = useState(1);
  const [newDayName, setNewDayName] = useState('');
  const [exFormDay, setExFormDay] = useState<GymDay | null>(null);
  const [exName, setExName] = useState('');
  const [exSets, setExSets] = useState('3');
  const [exReps, setExReps] = useState('10');
  const [exWeight, setExWeight] = useState('');
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);

  const today = dateKey();
  const todayWd = isoWeekday(new Date());

  const load = useCallback(async () => {
    try {
      setDays(await fetchGymDays());
      setExercises(await fetchGymExercises());
      setTodaySession(await fetchSessionForDate(dateKey()));
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    }
  }, []);

  // Era la única pantalla con useEffect: no se refrescaba al volver de entrenar.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const todayPlan = days.find((d) => d.day_of_week === todayWd);
  const exercisesFor = (dayId: string) => exercises.filter((e) => e.gym_day_id === dayId);

  const startTraining = () => {
    if (!todayPlan) return;
    setLifts(
      exercisesFor(todayPlan.id).map((e) => ({
        exercise: e.name,
        weight: e.weight !== null ? String(e.weight) : '',
        reps: String(e.reps),
      })),
    );
    setTraining(true);
  };

  const finishTraining = async () => {
    // Cerrojo síncrono: el doble toque chocaba con unique(user_id,date) (23505)
    // dejando una sesión fantasma. busy solo no bloquea de forma síncrona.
    if (!userId || busy || saving.current) return;
    saving.current = true;
    setBusy(true);
    try {
      const valid = lifts
        .map((l) => ({
          exercise_name: l.exercise,
          weight: parseFloat(l.weight.replace(',', '.')) || 0,
          reps: parseInt(l.reps, 10) || 0,
        }))
        .filter((l) => l.reps > 0 || l.weight > 0);

      const previousMax = await fetchMaxLifts();
      const prs = valid.filter((l) => l.weight > 0 && l.weight > (previousMax[l.exercise_name] ?? 0));

      const gymSession = await createSession(userId, {
        date: today,
        gym_day_id: todayPlan?.id ?? null,
        xp_awarded: GYM_SESSION_XP + prs.length * PR_XP,
      });
      await insertLifts(userId, gymSession.id, valid);

      let profile = await ensureProfile(userId);
      const totalXp = GYM_SESSION_XP + prs.length * PR_XP;
      const res = await awardXp(profile, totalXp, 'FUE', 'gym_session', {
        day: todayPlan?.name ?? 'libre',
        prs: prs.map((p) => p.exercise_name),
      });
      for (const pr of prs) {
        await insertEvent(userId, 'gym_pr', { exercise: pr.exercise_name, weight: pr.weight });
      }

      const { count: prCount } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'gym_pr');
      const fresh = await unlockAchievements(userId, evaluateAchievements({ prCount: prCount ?? 0 }));

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const prText = prs.length > 0 ? `\n${prs.map((p) => voice.pr(p.exercise_name)).join('\n')}` : '';
      const achText = fresh.length > 0 ? `\nLogro: ${fresh.map((a) => a.name).join(', ')}` : '';
      Alert.alert('SESIÓN REGISTRADA', `+${totalXp} XP a FUE${prText}${achText}`);
      if (res.leveledUp) setLevelUp(res.newLevel);
      setTraining(false);
      await load();
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  const addDay = async () => {
    if (!userId || !newDayName.trim()) return;
    await createGymDay(userId, newDayOfWeek, newDayName.trim());
    setNewDayName('');
    setDayFormOpen(false);
    await load();
  };

  const addExercise = async () => {
    if (!userId || !exFormDay || !exName.trim()) return;
    await createGymExercise(userId, exFormDay.id, {
      name: exName.trim(),
      sets: parseInt(exSets, 10) || 3,
      reps: parseInt(exReps, 10) || 10,
      weight: exWeight ? parseFloat(exWeight.replace(',', '.')) : null,
      position: exercisesFor(exFormDay.id).length,
    });
    setExName('');
    setExWeight('');
    setExFormDay(null);
    await load();
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color={colors.cyan} />
          </Pressable>
          <Text style={styles.title}>ENTRENAMIENTO</Text>
          <Pressable onPress={() => setDayFormOpen(true)} hitSlop={10}>
            <Ionicons name="add" size={24} color={colors.cyan} />
          </Pressable>
        </View>

        <SystemWindow color={colors.cyanDim}>
          <Text style={styles.windowTitle}>SESIÓN DE HOY · {DAY_NAMES[todayWd - 1]?.toUpperCase()}</Text>
          {todaySession ? (
            <Text style={styles.doneText}>
              Sesión registrada (+{todaySession.xp_awarded} XP). FUE crece.
            </Text>
          ) : !todayPlan ? (
            <Text style={styles.empty}>
              Hoy no hay rutina asignada. Añade un día de rutina con + si quieres entrenar los {DAY_NAMES[todayWd - 1]?.toLowerCase()}.
            </Text>
          ) : !training ? (
            <>
              <Text style={styles.planName}>{todayPlan.name}</Text>
              {exercisesFor(todayPlan.id).map((e) => (
                <Text key={e.id} style={styles.exLine}>
                  {e.name} · {e.sets}×{e.reps}
                  {e.weight !== null ? ` · ${e.weight} kg` : ''}
                </Text>
              ))}
              <SystemButton title={`Entrenar · +${GYM_SESSION_XP} XP`} onPress={startTraining} style={{ marginTop: 14 }} />
            </>
          ) : (
            <>
              <Text style={styles.planName}>{todayPlan.name} — serie top por ejercicio</Text>
              {lifts.map((l, i) => (
                <View key={l.exercise} style={styles.liftRow}>
                  <Text style={styles.liftName} numberOfLines={1}>
                    {l.exercise}
                  </Text>
                  <TextInput
                    style={styles.liftInput}
                    value={l.weight}
                    onChangeText={(v) => setLifts((prev) => prev.map((x, j) => (j === i ? { ...x, weight: v } : x)))}
                    keyboardType="decimal-pad"
                    placeholder="kg"
                    placeholderTextColor={colors.textFaint}
                  />
                  <TextInput
                    style={styles.liftInput}
                    value={l.reps}
                    onChangeText={(v) => setLifts((prev) => prev.map((x, j) => (j === i ? { ...x, reps: v } : x)))}
                    keyboardType="number-pad"
                    placeholder="reps"
                    placeholderTextColor={colors.textFaint}
                  />
                </View>
              ))}
              <SystemButton title="Terminar sesión" onPress={finishTraining} loading={busy} style={{ marginTop: 14 }} />
            </>
          )}
        </SystemWindow>

        <Text style={styles.sectionTitle}>RUTINA SEMANAL</Text>
        {days.length === 0 ? (
          <SystemWindow color={colors.line}>
            <Text style={styles.empty}>Sin rutina aún. Pulsa + y crea tus días (ej. Lunes — Empuje).</Text>
          </SystemWindow>
        ) : (
          days.map((d) => (
            <SystemWindow key={d.id} color={d.day_of_week === todayWd ? colors.cyanDim : colors.line}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayTitle}>
                  {DAY_NAMES[d.day_of_week - 1]?.toUpperCase()} · {d.name}
                </Text>
                <View style={{ flexDirection: 'row', gap: 14 }}>
                  <Pressable onPress={() => setExFormDay(d)} hitSlop={8}>
                    <Ionicons name="add" size={20} color={colors.cyan} />
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      Alert.alert('Eliminar día', `¿Eliminar ${d.name} y sus ejercicios?`, [
                        { text: 'Cancelar', style: 'cancel' },
                        {
                          text: 'Eliminar',
                          style: 'destructive',
                          onPress: async () => {
                            await deleteGymDay(d.id);
                            await load();
                          },
                        },
                      ])
                    }
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.textFaint} />
                  </Pressable>
                </View>
              </View>
              {exercisesFor(d.id).map((e) => (
                <Pressable
                  key={e.id}
                  onLongPress={() =>
                    Alert.alert('Eliminar ejercicio', e.name, [
                      { text: 'Cancelar', style: 'cancel' },
                      {
                        text: 'Eliminar',
                        style: 'destructive',
                        onPress: async () => {
                          await deleteGymExercise(e.id);
                          await load();
                        },
                      },
                    ])
                  }
                >
                  <Text style={styles.exLine}>
                    {e.name} · {e.sets}×{e.reps}
                    {e.weight !== null ? ` · ${e.weight} kg` : ''}
                  </Text>
                </Pressable>
              ))}
            </SystemWindow>
          ))
        )}
      </ScrollView>

      <Modal visible={dayFormOpen} transparent animationType="slide" onRequestClose={() => setDayFormOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>NUEVO DÍA DE RUTINA</Text>
            <View style={styles.chips}>
              {DAY_NAMES.map((name, i) => (
                <Pressable
                  key={name}
                  onPress={() => setNewDayOfWeek(i + 1)}
                  style={[styles.chip, newDayOfWeek === i + 1 && styles.chipOn]}
                >
                  <Text style={[styles.chipText, newDayOfWeek === i + 1 && styles.chipTextOn]}>
                    {name.slice(0, 3)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={[styles.input, { marginTop: 14 }]}
              value={newDayName}
              onChangeText={setNewDayName}
              placeholder="Nombre · ej. Empuje, Pierna, Full body"
              placeholderTextColor={colors.textFaint}
            />
            <SystemButton title="Crear" onPress={addDay} disabled={!newDayName.trim()} style={{ marginTop: 18 }} />
            <SystemButton title="Cancelar" variant="outline" onPress={() => setDayFormOpen(false)} style={{ marginTop: 10 }} />
          </View>
        </View>
      </Modal>

      <Modal visible={exFormDay !== null} transparent animationType="slide" onRequestClose={() => setExFormDay(null)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>EJERCICIO · {exFormDay?.name.toUpperCase()}</Text>
            <TextInput
              style={styles.input}
              value={exName}
              onChangeText={setExName}
              placeholder="Ej. Press banca"
              placeholderTextColor={colors.textFaint}
            />
            <View style={styles.inlineInputs}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Series</Text>
                <TextInput style={styles.input} value={exSets} onChangeText={setExSets} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Reps</Text>
                <TextInput style={styles.input} value={exReps} onChangeText={setExReps} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Kg</Text>
                <TextInput
                  style={styles.input}
                  value={exWeight}
                  onChangeText={setExWeight}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  placeholderTextColor={colors.textFaint}
                />
              </View>
            </View>
            <SystemButton title="Añadir" onPress={addExercise} disabled={!exName.trim()} style={{ marginTop: 18 }} />
            <SystemButton title="Cancelar" variant="outline" onPress={() => setExFormDay(null)} style={{ marginTop: 10 }} />
          </View>
        </View>
      </Modal>

      <LevelUpOverlay level={levelUp} onClose={() => setLevelUp(null)} />
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
  sectionTitle: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 2.5,
    color: colors.textFaint,
    marginTop: 8,
    marginBottom: 10,
  },
  doneText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.cyan },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, lineHeight: 19 },
  planName: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text, marginBottom: 6 },
  exLine: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, paddingVertical: 3 },
  liftRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  liftName: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  liftInput: {
    width: 64,
    borderWidth: 1,
    borderColor: colors.cyanDim,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 14,
    paddingHorizontal: 8,
    paddingVertical: 7,
    textAlign: 'center',
  },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  dayTitle: { fontFamily: fonts.heading, fontSize: 13, letterSpacing: 1, color: colors.text },
  backdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 14, 0.85)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.panel,
    borderTopWidth: 1.5,
    borderTopColor: colors.cyanDim,
    padding: 20,
    paddingBottom: 34,
  },
  sheetTitle: { fontFamily: fonts.heading, fontSize: 15, letterSpacing: 3, color: colors.cyan, marginBottom: 12 },
  label: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.textDim,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
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
  inlineInputs: { flexDirection: 'row', gap: 10, marginTop: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.cyanDim, paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { backgroundColor: colors.cyanFaint, borderColor: colors.cyan },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textDim },
  chipTextOn: { color: colors.cyan },
});

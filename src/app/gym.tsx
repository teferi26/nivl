import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Platform,
  KeyboardAvoidingView,
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
import { fetchPrescription, type Prescription } from '@/lib/bodywork';
import {
  createGymDay,
  createGymExercise,
  updateGymExercise,
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
import { subirFotoMision } from '@/lib/photos';
import { colors, fonts } from '@/lib/theme';
import { voice } from '@/lib/voice';
import type { GymDay, GymExercise, GymSession } from '@/lib/types';

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

interface SerieInput {
  weight: string;
  reps: string;
  // El RPE es lo que decide la carga de la próxima sesión: sin él, el coach
  // sube peso por calendario en vez de por cómo salió la serie.
  rpe: string;
}

/**
 * Un ejercicio con SUS series, cada una con su peso y sus repeticiones.
 *
 * Antes era una sola fila por ejercicio —el mismo peso para todas las series—
 * y eso no es entrenar: una pirámide de 12 a 60 kg, 8 a 70 y 5 a 80 se
 * registraba como si hubieran sido tres series iguales, y el coach programaba
 * la siguiente sesión sobre un dato falso.
 */
interface LiftInput {
  exercise: string;
  series: SerieInput[];
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
  const [prescrito, setPrescrito] = useState<Prescription[]>([]);
  const [newDayOfWeek, setNewDayOfWeek] = useState(1);
  const [newDayName, setNewDayName] = useState('');
  const [exFormDay, setExFormDay] = useState<GymDay | null>(null);
  // Cuando no es null, el formulario edita en vez de crear.
  const [exEditando, setExEditando] = useState<GymExercise | null>(null);
  const [notas, setNotas] = useState('');
  const [fotoB64, setFotoB64] = useState<string | null>(null);
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
      setPrescrito(await fetchPrescription(dateKey()).catch(() => []));
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

  const cambiarSerie = (iEj: number, iSerie: number, campo: keyof SerieInput, valor: string) =>
    setLifts((prev) =>
      prev.map((l, j) =>
        j !== iEj
          ? l
          : { ...l, series: l.series.map((s, k) => (k === iSerie ? { ...s, [campo]: valor } : s)) },
      ),
    );

  /** Copia la última serie: lo normal es repetir y tocar un solo número. */
  const anadirSerie = (iEj: number) =>
    setLifts((prev) =>
      prev.map((l, j) => {
        if (j !== iEj) return l;
        const ultima = l.series[l.series.length - 1] ?? { weight: '', reps: '', rpe: '' };
        return { ...l, series: [...l.series, { ...ultima, rpe: '' }] };
      }),
    );

  const quitarSerie = (iEj: number, iSerie: number) =>
    setLifts((prev) =>
      prev.map((l, j) =>
        // Nunca por debajo de una: un ejercicio sin series no es un ejercicio.
        j !== iEj || l.series.length === 1
          ? l
          : { ...l, series: l.series.filter((_, k) => k !== iSerie) },
      ),
    );

  const startTraining = () => {
    if (!todayPlan) return;
    setLifts(
      exercisesFor(todayPlan.id).map((e) => ({
        exercise: e.name,
        // Tantas filas como series diga la rutina, ya rellenas con el peso y
        // las reps de referencia: lo normal es tocar solo lo que cambie.
        series: Array.from({ length: Math.max(1, e.sets) }, () => ({
          weight: e.weight !== null ? String(e.weight) : '',
          reps: String(e.reps),
          rpe: '',
        })),
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
        .flatMap((l) =>
          l.series.map((serie, idx) => ({
            exercise_name: l.exercise,
            weight: parseFloat(serie.weight.replace(',', '.')) || 0,
            reps: parseInt(serie.reps, 10) || 0,
            rpe: serie.rpe.trim() ? parseFloat(serie.rpe.replace(',', '.')) : null,
            set_index: idx,
          })),
        )
        .filter((l) => l.reps > 0 || l.weight > 0);

      const previousMax = await fetchMaxLifts();
      // El récord es por EJERCICIO, no por serie: con series de peso creciente,
      // contar cada una daría tres PR del mismo movimiento en una sesión.
      const mejorPorEjercicio = new Map<string, (typeof valid)[number]>();
      for (const l of valid) {
        const previo = mejorPorEjercicio.get(l.exercise_name);
        if (!previo || l.weight > previo.weight) mejorPorEjercicio.set(l.exercise_name, l);
      }
      const prs = [...mejorPorEjercicio.values()].filter(
        (l) => l.weight > 0 && l.weight > (previousMax[l.exercise_name] ?? 0),
      );

      const gymSession = await createSession(userId, {
        date: today,
        gym_day_id: todayPlan?.id ?? null,
        xp_awarded: GYM_SESSION_XP + prs.length * PR_XP,
        notes: notas.trim() || null,
      });

      // La foto del entreno entra en quest_photos: así la ve el coach y así
      // aparece en el resumen del domingo. Si falla, la sesión no se cae — ya
      // está registrada y perderla por una foto sería absurdo.
      if (fotoB64) {
        await subirFotoMision(userId, {
          base64: fotoB64,
          questId: null,
          completionId: null,
          date: today,
          caption: `Entreno ${todayPlan?.name ?? 'libre'}${notas.trim() ? ` — ${notas.trim()}` : ''}`,
        }).catch(() => {});
      }
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
      setNotas('');
      setFotoB64(null);
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

  const abrirEjercicio = (dia: GymDay, ejercicio: GymExercise | null) => {
    setExEditando(ejercicio);
    setExName(ejercicio?.name ?? '');
    setExSets(String(ejercicio?.sets ?? 3));
    setExReps(String(ejercicio?.reps ?? 10));
    setExWeight(ejercicio?.weight !== null && ejercicio !== null ? String(ejercicio.weight) : '');
    setExFormDay(dia);
  };

  const guardarEjercicio = async () => {
    if (!userId || !exFormDay || !exName.trim()) return;
    const datos = {
      name: exName.trim(),
      sets: parseInt(exSets, 10) || 3,
      reps: parseInt(exReps, 10) || 10,
      weight: exWeight ? parseFloat(exWeight.replace(',', '.')) : null,
    };
    if (exEditando) {
      await updateGymExercise(exEditando.id, datos);
    } else {
      await createGymExercise(userId, exFormDay.id, {
        ...datos,
        position: exercisesFor(exFormDay.id).length,
      });
    }
    setExName('');
    setExWeight('');
    setExEditando(null);
    setExFormDay(null);
    await load();
  };

  const fotoSesion = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Sin cámara', 'El sistema necesita la cámara para el registro del entreno.');
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.4, base64: true });
    if (r.canceled) return;
    setFotoB64(r.assets[0]?.base64 ?? null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            onPress={() => router.back()}
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={24} color={colors.cyan} />
          </Pressable>
          <Text style={styles.title}>ENTRENAMIENTO</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Añadir día de rutina"
            onPress={() => setDayFormOpen(true)}
            hitSlop={10}
          >
            <Ionicons name="add" size={24} color={colors.cyan} />
          </Pressable>
        </View>

        {prescrito.length > 0 ? (
          <SystemWindow color={colors.cyan}>
            <Text style={styles.windowTitle}>EL SISTEMA HA PRESCRITO</Text>
            {prescrito.map((p) => (
              <Text key={p.id} style={styles.prescLine}>
                {p.exercise_name} · {p.sets}×{p.reps}
                {p.weight ? ` @ ${p.weight} kg` : ''}
                {p.rpe_target ? ` · RPE ${p.rpe_target}` : ''}
                {p.notes ? `\n   ${p.notes}` : ''}
              </Text>
            ))}
          </SystemWindow>
        ) : null}

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
              <Text style={styles.planName}>{todayPlan.name} — serie a serie</Text>
              <Text style={styles.rpeHint}>
                RPE = cuánto te quedaba. 7 son tres repeticiones en el depósito, 10 es no poder
                con una más. Es el dato con el que el sistema decide la carga de la próxima.
              </Text>
              {lifts.map((l, i) => (
                <View key={l.exercise} style={styles.ejercicioBloque}>
                  <View style={styles.ejercicioCabecera}>
                    <Text style={styles.liftName} numberOfLines={1}>
                      {l.exercise}
                    </Text>
                    <Pressable
                      onPress={() => anadirSerie(i)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Añadir serie a ${l.exercise}`}
                    >
                      <Ionicons name="add-circle-outline" size={19} color={colors.cyan} />
                    </Pressable>
                  </View>

                  <View style={styles.serieCabecera}>
                    <Text style={styles.serieNum}>#</Text>
                    <Text style={styles.serieEtiqueta}>kg</Text>
                    <Text style={styles.serieEtiqueta}>reps</Text>
                    <Text style={styles.serieEtiqueta}>RPE</Text>
                    <View style={{ width: 22 }} />
                  </View>

                  {l.series.map((serie, si) => (
                    <View key={si} style={styles.liftRow}>
                      <Text style={styles.serieNum}>{si + 1}</Text>
                      <TextInput
                        style={styles.liftInput}
                        value={serie.weight}
                        onChangeText={(v) => cambiarSerie(i, si, 'weight', v)}
                        keyboardType="decimal-pad"
                        placeholder="kg"
                        placeholderTextColor={colors.textFaint}
                        accessibilityLabel={`Peso de la serie ${si + 1} de ${l.exercise}`}
                      />
                      <TextInput
                        style={styles.liftInput}
                        value={serie.reps}
                        onChangeText={(v) => cambiarSerie(i, si, 'reps', v)}
                        keyboardType="number-pad"
                        placeholder="reps"
                        placeholderTextColor={colors.textFaint}
                        accessibilityLabel={`Repeticiones de la serie ${si + 1} de ${l.exercise}`}
                      />
                      <TextInput
                        style={styles.liftInput}
                        value={serie.rpe}
                        onChangeText={(v) => cambiarSerie(i, si, 'rpe', v)}
                        keyboardType="decimal-pad"
                        placeholder="RPE"
                        placeholderTextColor={colors.textFaint}
                        accessibilityLabel={`Esfuerzo de la serie ${si + 1} de ${l.exercise}`}
                      />
                      <Pressable
                        onPress={() => quitarSerie(i, si)}
                        hitSlop={6}
                        disabled={l.series.length === 1}
                        style={{ width: 22, opacity: l.series.length === 1 ? 0.25 : 1 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Quitar la serie ${si + 1}`}
                      >
                        <Ionicons name="close" size={15} color={colors.textFaint} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ))}
              <Text style={styles.label}>Cómo fue</Text>
              <TextInput
                style={styles.notasInput}
                value={notas}
                onChangeText={setNotas}
                placeholder="Cómo te has encontrado, qué se torció, qué notaste"
                placeholderTextColor={colors.textFaint}
                multiline
                accessibilityLabel="Notas de la sesión"
              />
              <Text style={styles.notasHint}>
                Esto lo lee el coach: es lo que le dice por qué un día salió mal aunque los kilos
                fueran los mismos.
              </Text>

              <Pressable
                onPress={fotoSesion}
                style={[styles.fotoBoton, fotoB64 && styles.fotoBotonHecha]}
                accessibilityRole="button"
                accessibilityLabel="Hacer una foto del entreno"
              >
                <Ionicons
                  name={fotoB64 ? 'checkmark-circle' : 'camera-outline'}
                  size={18}
                  color={fotoB64 ? colors.cyan : colors.cyanText}
                />
                <Text style={styles.fotoTexto}>
                  {fotoB64 ? 'Foto lista · entra en tu resumen' : 'Foto del entreno'}
                </Text>
              </Pressable>

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
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Añadir ejercicio"
                    onPress={() => abrirEjercicio(d, null)}
                    hitSlop={8}
                  >
                    <Ionicons name="add" size={20} color={colors.cyan} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Eliminar el día ${d.name}`}
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
                  accessibilityRole="button"
                  accessibilityLabel={`Editar ${e.name}`}
                  accessibilityHint="Mantén pulsado para eliminar el ejercicio"
                  onPress={() => abrirEjercicio(d, e)}
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
                  <View style={styles.exFila}>
                    <Text style={styles.exLine}>
                      {e.name} · {e.sets}×{e.reps}
                      {e.weight !== null ? ` · ${e.weight} kg` : ''}
                    </Text>
                    <Ionicons name="create-outline" size={15} color={colors.textFaint} />
                  </View>
                </Pressable>
              ))}
            </SystemWindow>
          ))
        )}
      </ScrollView>

      <Modal visible={dayFormOpen} transparent animationType="slide" onRequestClose={() => setDayFormOpen(false)}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>NUEVO DÍA DE RUTINA</Text>
            <View style={styles.chips}>
              {DAY_NAMES.map((name, i) => (
                <Pressable
                  key={name}
                  onPress={() => setNewDayOfWeek(i + 1)}
                  style={[styles.chip, newDayOfWeek === i + 1 && styles.chipOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: newDayOfWeek === i + 1 }}
                  accessibilityLabel={name}
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
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={exFormDay !== null} transparent animationType="slide" onRequestClose={() => setExFormDay(null)}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {exEditando ? 'EDITAR' : 'NUEVO'} EJERCICIO · {exFormDay?.name.toUpperCase()}
            </Text>
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
            <SystemButton
              title={exEditando ? 'Guardar cambios' : 'Añadir'}
              onPress={guardarEjercicio}
              disabled={!exName.trim()}
              style={{ marginTop: 18 }}
            />
            <SystemButton
              title="Cancelar"
              variant="outline"
              onPress={() => {
                setExEditando(null);
                setExFormDay(null);
              }}
              style={{ marginTop: 10 }}
            />
          </View>
        </KeyboardAvoidingView>
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
  prescLine: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 19,
    color: colors.cyanText,
    marginBottom: 4,
  },
  planName: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text, marginBottom: 6 },
  ejercicioBloque: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 10,
    marginTop: 10,
  },
  ejercicioCabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  serieCabecera: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  serieNum: {
    width: 16,
    fontFamily: fonts.heading,
    fontSize: 11,
    color: colors.textFaint,
    textAlign: 'center',
  },
  serieEtiqueta: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 9.5,
    letterSpacing: 1,
    color: colors.textFaint,
    textAlign: 'center',
  },
  notasInput: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 13.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  notasHint: {
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textFaint,
    marginTop: 6,
  },
  fotoBoton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.cyanFaint,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  fotoBotonHecha: { borderColor: colors.cyan },
  fotoTexto: { fontFamily: fonts.semibold, fontSize: 13, color: colors.cyanText },
  exFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  exLine: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, paddingVertical: 3 },
  liftRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  liftName: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  rpeHint: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textFaint,
    marginBottom: 10,
  },
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

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
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LevelUpOverlay } from '@/components/LevelUpOverlay';
import { SystemButton } from '@/components/SystemButton';
import {
  Card,
  Check,
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
  Tag,
} from '@/components/ui';
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

  const confirmarBorrarDia = (d: GymDay) =>
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
    ]);

  const confirmarBorrarEjercicio = (e: GymExercise) =>
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
    ]);

  const cerrarFormEjercicio = () => {
    setExEditando(null);
    setExFormDay(null);
  };

  // Solo presentación: el dato del día para el subtítulo de la cabecera.
  const nombreHoy = DAY_NAMES[todayWd - 1] ?? '';
  const ejerciciosHoy = todayPlan ? exercisesFor(todayPlan.id) : [];
  const subtitulo = todaySession
    ? `Sesión registrada. +${todaySession.xp_awarded} XP a FUE.`
    : training && todayPlan
      ? `${todayPlan.name}, serie a serie.`
      : todayPlan
        ? `Hoy toca ${todayPlan.name}. ${ejerciciosHoy.length} ${ejerciciosHoy.length === 1 ? 'ejercicio' : 'ejercicios'}.`
        : `Hoy, ${nombreHoy.toLowerCase()}, no hay rutina asignada.`;

  return (
    <Screen>
      <Stagger>
        <FadeIn index={0}>
          <ScreenHeader
            onBack={() => router.back()}
            eyebrow="Cuerpo"
            title="Gimnasio"
            subtitle={subtitulo}
            action={{ icon: 'add', label: 'Añadir día de rutina', onPress: () => setDayFormOpen(true) }}
          />
        </FadeIn>

        <FadeIn index={1}>
          <Card>
            <StatRow>
              <Stat value={days.length} label="Días / semana" />
              <Stat value={exercises.length} label="Ejercicios" />
              <Stat
                value={todaySession ? todaySession.xp_awarded : GYM_SESSION_XP}
                unit="XP"
                label={todaySession ? 'Ganados hoy' : 'En juego'}
                tone={todaySession ? 'accent' : 'text'}
              />
            </StatRow>
          </Card>
        </FadeIn>

        {prescrito.length > 0 ? (
          <FadeIn index={2}>
            <Section title="Prescrito por el sistema" meta={`${prescrito.length}`} tone="accent">
              <Card padded={false} style={styles.lista}>
                {prescrito.map((p, i) => (
                  <Row
                    key={p.id}
                    first={i === 0}
                    leading={<Text style={styles.ordinal}>{i + 1}</Text>}
                    title={p.exercise_name}
                    detail={[`${p.sets}×${p.reps}`, p.rpe_target ? `RPE ${p.rpe_target}` : null, p.notes]
                      .filter(Boolean)
                      .join(' · ')}
                    trailing={p.weight ? <RowValue tone="accent">{p.weight} kg</RowValue> : undefined}
                  />
                ))}
              </Card>
            </Section>
          </FadeIn>
        ) : null}

        <FadeIn index={3}>
          <Section title="Sesión de hoy" meta={nombreHoy}>
            {todaySession ? (
              <Card variant="tinted">
                <View style={styles.hechoFila}>
                  <Check checked />
                  <View style={styles.hechoTexto}>
                    <Text style={styles.hechoTitulo}>Sesión registrada</Text>
                    <Text style={styles.hechoDetalle}>+{todaySession.xp_awarded} XP a FUE. FUE crece.</Text>
                  </View>
                </View>
              </Card>
            ) : !todayPlan ? (
              <Card variant="outline">
                <EmptyState
                  compact
                  icon="barbell-outline"
                  title="Hoy no hay rutina"
                  body={`Añade un día de rutina si quieres entrenar los ${nombreHoy.toLowerCase()}.`}
                  action={{ label: 'Añadir día', onPress: () => setDayFormOpen(true) }}
                />
              </Card>
            ) : !training ? (
              <>
                <Card padded={false} style={styles.lista}>
                  {ejerciciosHoy.length === 0 ? (
                    <Text style={styles.sinEjercicios}>
                      Sin ejercicios en {todayPlan.name}. Añádelos en la rutina semanal.
                    </Text>
                  ) : (
                    ejerciciosHoy.map((e, i) => (
                      <Row
                        key={e.id}
                        first={i === 0}
                        leading={<Text style={styles.ordinal}>{i + 1}</Text>}
                        title={e.name}
                        detail={`${e.sets}×${e.reps}`}
                        trailing={e.weight !== null ? <RowValue>{e.weight} kg</RowValue> : undefined}
                      />
                    ))
                  )}
                </Card>
                <SystemButton
                  title={`Entrenar · +${GYM_SESSION_XP} XP`}
                  onPress={startTraining}
                  icon="barbell-outline"
                  style={{ marginTop: 4 }}
                />
              </>
            ) : (
              <>
                <Text style={styles.rpeHint}>
                  RPE = cuánto te quedaba. 7 son tres repeticiones en el depósito, 10 es no poder
                  con una más. Es el dato con el que el sistema decide la carga de la próxima.
                </Text>
                {lifts.map((l, i) => (
                  <Card key={l.exercise}>
                    <View style={styles.ejercicioCabecera}>
                      <Text style={styles.liftName} numberOfLines={1}>
                        {l.exercise}
                      </Text>
                      <Pressable
                        onPress={() => anadirSerie(i)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Añadir serie a ${l.exercise}`}
                        style={styles.serieMas}
                      >
                        <Ionicons name="add" size={16} color={colors.text} />
                        <Text style={styles.serieMasTexto}>Serie</Text>
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
                  </Card>
                ))}

                <Card>
                  <Text style={styles.labelPrimero}>Cómo fue</Text>
                  <TextInput
                    style={styles.notasInput}
                    value={notas}
                    onChangeText={setNotas}
                    placeholder="Cómo te has encontrado, qué se torció, qué notaste"
                    placeholderTextColor={colors.textFaint}
                    multiline
                    accessibilityLabel="Notas de la sesión"
                  />
                  <Text style={styles.hint}>
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
                      color={fotoB64 ? colors.accent : colors.accentText}
                    />
                    <Text style={[styles.fotoTexto, fotoB64 && styles.fotoTextoHecha]}>
                      {fotoB64 ? 'Foto lista. Entra en tu resumen.' : 'Foto del entreno'}
                    </Text>
                  </Pressable>
                </Card>

                <SystemButton title="Terminar sesión" onPress={finishTraining} loading={busy} style={{ marginTop: 4 }} />
              </>
            )}
          </Section>
        </FadeIn>

        <FadeIn index={4}>
          <Section
            title="Rutina semanal"
            meta={days.length > 0 ? `${days.length}` : undefined}
            action={{ label: 'Añadir día', icon: 'add', onPress: () => setDayFormOpen(true) }}
          >
            {days.length === 0 ? (
              <Card variant="outline">
                <EmptyState
                  icon="calendar-outline"
                  title="Sin rutina aún"
                  body="Crea tus días de entreno, por ejemplo Lunes · Empuje, y añade ejercicios a cada uno."
                  action={{ label: 'Crear el primer día', onPress: () => setDayFormOpen(true) }}
                />
              </Card>
            ) : (
              days.map((d, di) => {
                const esHoy = d.day_of_week === todayWd;
                const exs = exercisesFor(d.id);
                return (
                  <FadeIn key={d.id} index={di}>
                    <Card padded={false} style={styles.lista} accent={esHoy ? colors.accent : undefined}>
                      <View style={styles.dayHeader}>
                        <View style={styles.dayTexto}>
                          <Text style={styles.dayEyebrow}>{DAY_NAMES[d.day_of_week - 1]}</Text>
                          <Text style={styles.dayTitle} numberOfLines={1}>
                            {d.name}
                          </Text>
                        </View>
                        {esHoy ? <Tag tone="accent">Hoy</Tag> : null}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Añadir ejercicio a ${d.name}`}
                          onPress={() => abrirEjercicio(d, null)}
                          hitSlop={8}
                          style={styles.dayBoton}
                        >
                          <Ionicons name="add" size={18} color={colors.text} />
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Eliminar el día ${d.name}`}
                          onPress={() => confirmarBorrarDia(d)}
                          hitSlop={8}
                          style={styles.dayBoton}
                        >
                          <Ionicons name="trash-outline" size={16} color={colors.textFaint} />
                        </Pressable>
                      </View>
                      {exs.length === 0 ? (
                        <Text style={styles.sinEjercicios}>Sin ejercicios. Toca + para añadir el primero.</Text>
                      ) : (
                        exs.map((e) => (
                          <Row
                            key={e.id}
                            title={e.name}
                            detail={e.weight !== null ? `${e.weight} kg de referencia` : 'Sin peso de referencia'}
                            trailing={<RowValue>{`${e.sets}×${e.reps}`}</RowValue>}
                            chevron
                            onPress={() => abrirEjercicio(d, e)}
                            onLongPress={() => confirmarBorrarEjercicio(e)}
                            accessibilityLabel={`Editar ${e.name}. Mantén pulsado para eliminarlo.`}
                          />
                        ))
                      )}
                    </Card>
                  </FadeIn>
                );
              })
            )}
          </Section>
        </FadeIn>
      </Stagger>

      <Modal visible={dayFormOpen} transparent animationType="slide" onRequestClose={() => setDayFormOpen(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable
            style={styles.backdropTap}
            onPress={() => setDayFormOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetEyebrow}>NUEVO DÍA DE RUTINA</Text>
            <Text style={styles.sheetTitle}>¿Qué día entrenas?</Text>
            <Text style={styles.label}>Día</Text>
            <ChipWrap>
              {DAY_NAMES.map((name, i) => (
                <Chip
                  key={name}
                  label={name.slice(0, 3)}
                  selected={newDayOfWeek === i + 1}
                  onPress={() => setNewDayOfWeek(i + 1)}
                  accessibilityLabel={name}
                />
              ))}
            </ChipWrap>
            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={styles.input}
              value={newDayName}
              onChangeText={setNewDayName}
              placeholder="Ej. Empuje · Pierna · Full body"
              placeholderTextColor={colors.textFaint}
              accessibilityLabel="Nombre del día de rutina"
            />
            <SystemButton title="Crear día" onPress={addDay} disabled={!newDayName.trim()} style={{ marginTop: 22 }} />
            <SystemButton title="Cancelar" variant="ghost" onPress={() => setDayFormOpen(false)} style={{ marginTop: 6 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={exFormDay !== null} transparent animationType="slide" onRequestClose={cerrarFormEjercicio}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable
            style={styles.backdropTap}
            onPress={cerrarFormEjercicio}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetEyebrow}>
              {exEditando ? 'EDITAR EJERCICIO' : 'NUEVO EJERCICIO'} · {exFormDay?.name.toUpperCase()}
            </Text>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {exEditando ? exEditando.name : '¿Qué movimiento?'}
            </Text>
            <Text style={styles.label}>Ejercicio</Text>
            <TextInput
              style={styles.input}
              value={exName}
              onChangeText={setExName}
              placeholder="Ej. Press banca"
              placeholderTextColor={colors.textFaint}
              accessibilityLabel="Nombre del ejercicio"
            />
            <View style={styles.inlineInputs}>
              <View style={styles.columna}>
                <Text style={styles.label}>Series</Text>
                <TextInput
                  style={styles.input}
                  value={exSets}
                  onChangeText={setExSets}
                  keyboardType="number-pad"
                  accessibilityLabel="Número de series"
                />
              </View>
              <View style={styles.columna}>
                <Text style={styles.label}>Reps</Text>
                <TextInput
                  style={styles.input}
                  value={exReps}
                  onChangeText={setExReps}
                  keyboardType="number-pad"
                  accessibilityLabel="Repeticiones por serie"
                />
              </View>
              <View style={styles.columna}>
                <Text style={styles.label}>Kg</Text>
                <TextInput
                  style={styles.input}
                  value={exWeight}
                  onChangeText={setExWeight}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  placeholderTextColor={colors.textFaint}
                  accessibilityLabel="Peso de referencia en kilos"
                />
              </View>
            </View>
            <SystemButton
              title={exEditando ? 'Guardar cambios' : 'Añadir ejercicio'}
              onPress={guardarEjercicio}
              disabled={!exName.trim()}
              style={{ marginTop: 22 }}
            />
            <SystemButton title="Cancelar" variant="ghost" onPress={cerrarFormEjercicio} style={{ marginTop: 6 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <LevelUpOverlay level={levelUp} onClose={() => setLevelUp(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  lista: { paddingHorizontal: 16, paddingVertical: 2 },
  ordinal: { width: 22, fontFamily: fonts.number, fontSize: 13, color: colors.textFaint, textAlign: 'center' },
  sinEjercicios: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textFaint, paddingVertical: 12 },
  hechoFila: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  hechoTexto: { flex: 1, minWidth: 0 },
  hechoTitulo: { fontFamily: fonts.heading, fontSize: 16, letterSpacing: -0.2, color: colors.text },
  hechoDetalle: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, marginTop: 2 },
  rpeHint: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.textFaint, marginBottom: 12 },
  ejercicioCabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  liftName: { flex: 1, minWidth: 0, fontFamily: fonts.heading, fontSize: 16, letterSpacing: -0.2, color: colors.text },
  serieMas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.accentDim,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  serieMasTexto: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text },
  serieCabecera: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  serieNum: { width: 16, fontFamily: fonts.number, fontSize: 11, color: colors.textFaint, textAlign: 'center' },
  serieEtiqueta: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 9.5,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.textFaint,
    textAlign: 'center',
  },
  liftRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  liftInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.accentDim,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 15,
    paddingHorizontal: 8,
    paddingVertical: 9,
    textAlign: 'center',
  },
  notasInput: {
    borderWidth: 1,
    borderColor: colors.accentDim,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  hint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textFaint, marginTop: 8 },
  fotoBoton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.accentDim,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginTop: 14,
  },
  fotoBotonHecha: { borderColor: colors.accent, backgroundColor: colors.accentFaint },
  fotoTexto: { fontFamily: fonts.semibold, fontSize: 13, color: colors.accentText },
  fotoTextoHecha: { color: colors.text },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  dayTexto: { flex: 1, minWidth: 0 },
  dayEyebrow: {
    fontFamily: fonts.heading,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  dayTitle: { fontFamily: fonts.heading, fontSize: 16, letterSpacing: -0.2, color: colors.text, marginTop: 2 },
  dayBoton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
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
  labelPrimero: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textFaint,
    textTransform: 'uppercase',
    marginBottom: 8,
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
  inlineInputs: { flexDirection: 'row', gap: 10 },
  columna: { flex: 1 },
});

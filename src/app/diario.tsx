import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SystemButton } from '@/components/SystemButton';
import { SystemWindow } from '@/components/SystemWindow';
import { evaluateAchievements, unlockAchievements } from '@/lib/achievements';
import { useAuth } from '@/lib/auth';
import {
  deleteJournalPhoto,
  fetchJournalPhotos,
  journalPhotoUrl,
  uploadJournalPhoto,
} from '@/lib/contract';
import { ensureProfile } from '@/lib/data';
import { dateKey } from '@/lib/dates';
import { awardXp } from '@/lib/engine';
import { JOURNAL_XP } from '@/lib/game';
import {
  countEntries,
  fetchEntryForDate,
  fetchEventsForDate,
  fetchRecentEntries,
  promptForDate,
  upsertEntry,
  type SystemEvent,
} from '@/lib/journal';
import { colors, fonts } from '@/lib/theme';
import type { JournalEntry, JournalPhoto } from '@/lib/types';

const MOOD_LABELS = ['Hundido', 'Bajo', 'Normal', 'Bien', 'Imparable'];

function chronicleLine(e: SystemEvent): string | null {
  const p = e.payload as Record<string, unknown>;
  switch (e.type) {
    case 'quest_completed':
      return `Misión completada: ${String(p.quest ?? '')} (+${Number(p.xp ?? 0)} XP)`;
    case 'level_up':
      return `SUBIDA DE NIVEL → ${Number(p.level ?? 0)}`;
    case 'penalty':
      return `Penalización aplicada: −${Number(p.xp ?? 0)} XP`;
    case 'dungeon_task':
      return `Objetivo de mazmorra: ${String(p.task ?? '')}`;
    case 'dungeon_cleared':
      return `Mazmorra despejada: ${String(p.dungeon ?? '')}`;
    case 'gym_session':
      return `Sesión de gimnasio registrada (+${Number(p.xp ?? 0)} XP)`;
    case 'gym_pr':
      return `RÉCORD personal: ${String(p.exercise ?? '')} · ${Number(p.weight ?? 0)} kg`;
    case 'stone_used':
      return 'Una Piedra de Protección se consumió por ti';
    case 'stone_earned':
      return 'Piedra de Protección forjada';
    default:
      return null;
  }
}

export default function Diario() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const today = dateKey();

  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [plan, setPlan] = useState('');
  const [photos, setPhotos] = useState<{ photo: JournalPhoto; url: string | null }[]>([]);
  const [savedToday, setSavedToday] = useState(false);
  const [recent, setRecent] = useState<JournalEntry[]>([]);
  const [chronicle, setChronicle] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);

  const load = useCallback(async () => {
    const todayKey = dateKey();
    try {
      const entry = await fetchEntryForDate(todayKey);
      if (entry) {
        setMood(entry.mood);
        setEnergy(entry.energy);
        setText(entry.text ?? '');
        setPlan(entry.plan ?? '');
        setSavedToday(true);
      }
      const todayPhotos = await fetchJournalPhotos(todayKey);
      setPhotos(
        await Promise.all(
          todayPhotos.map(async (photo) => ({ photo, url: await journalPhotoUrl(photo.path) })),
        ),
      );
      // Pide 15 y recorta a 14 tras excluir hoy (antes mostraba 13 si hoy ya existía).
      setRecent((await fetchRecentEntries(15)).filter((e) => e.date !== todayKey).slice(0, 14));
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const events = await fetchEventsForDate(start.toISOString(), end.toISOString());
      setChronicle(events.map(chronicleLine).filter((l): l is string => l !== null));
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    }
  }, []);

  const addPhoto = async () => {
    if (!userId || saving.current) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Sin cámara', 'El sistema necesita la cámara para los comprobantes del diario.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.4,
      base64: true,
    });
    if (result.canceled) return;
    const b64 = result.assets[0]?.base64;
    if (!b64) return;
    saving.current = true;
    try {
      const photo = await uploadJournalPhoto(userId, dateKey(), b64);
      const url = await journalPhotoUrl(photo.path);
      setPhotos((prev) => [...prev, { photo, url }]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'No se pudo subir la foto');
    } finally {
      saving.current = false;
    }
  };

  const removePhoto = (item: { photo: JournalPhoto; url: string | null }) => {
    Alert.alert('Eliminar comprobante', '¿Borrar esta foto del diario?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteJournalPhoto(item.photo);
            setPhotos((prev) => prev.filter((p) => p.photo.id !== item.photo.id));
          } catch (e) {
            Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
          }
        },
      },
    ]);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const save = async () => {
    // Cerrojo síncrono: dos toques rápidos ya no insertan dos entradas ni duplican XP.
    if (!userId || busy || saving.current) return;
    saving.current = true;
    setBusy(true);
    const today = dateKey();
    try {
      const { isNew } = await upsertEntry(userId, {
        date: today,
        mood,
        energy,
        text: text.trim() || null,
        plan: plan.trim() || null,
      });
      if (isNew) {
        const profile = await ensureProfile(userId);
        await awardXp(profile, JOURNAL_XP, 'PER', 'journal_entry', { date: today });
        const total = await countEntries();
        const fresh = await unlockAchievements(userId, evaluateAchievements({ journalCount: total }));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'ENTRADA REGISTRADA',
          `+${JOURNAL_XP} XP a PER${fresh.length > 0 ? `\nLogro: ${fresh.map((a) => a.name).join(', ')}` : ''}`,
        );
      }
      setSavedToday(true);
      await load();
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color={colors.cyan} />
          </Pressable>
          <Text style={styles.title}>DIARIO DEL CAZADOR</Text>
          <View style={{ width: 24 }} />
        </View>

        <SystemWindow color={colors.cyanDim}>
          <Text style={styles.prompt}>{promptForDate(today)}</Text>

          <Text style={styles.label}>Ánimo</Text>
          <View style={styles.scale}>
            {MOOD_LABELS.map((lbl, i) => (
              <Pressable key={lbl} onPress={() => setMood(i + 1)} style={[styles.scaleChip, mood === i + 1 && styles.scaleChipOn]}>
                <Text style={[styles.scaleNum, mood === i + 1 && styles.scaleNumOn]}>{i + 1}</Text>
              </Pressable>
            ))}
          </View>
          {mood !== null ? <Text style={styles.scaleLabel}>{MOOD_LABELS[mood - 1]}</Text> : null}

          <Text style={styles.label}>Energía</Text>
          <View style={styles.scale}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setEnergy(n)} style={[styles.scaleChip, energy === n && styles.scaleChipOn]}>
                <Text style={[styles.scaleNum, energy === n && styles.scaleNumOn]}>{n}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Hoja 1 · Lo vivido y aprendido</Text>
          <TextInput
            style={styles.textarea}
            value={text}
            onChangeText={setText}
            placeholder="Qué hice, qué aprendí, qué haría distinto…"
            placeholderTextColor={colors.textFaint}
            multiline
          />

          <Text style={styles.label}>Hoja 2 · El plan de hoy</Text>
          <TextInput
            style={styles.textarea}
            value={plan}
            onChangeText={setPlan}
            placeholder="Las tareas y batallas del día…"
            placeholderTextColor={colors.textFaint}
            multiline
          />

          <Text style={styles.label}>Comprobantes ({photos.length})</Text>
          <View style={styles.photoStrip}>
            {photos.map((item) => (
              <Pressable
                key={item.photo.id}
                onLongPress={() => removePhoto(item)}
                accessibilityRole="imagebutton"
                accessibilityLabel="Comprobante del diario; mantén pulsado para eliminar"
              >
                {item.url ? (
                  <Image source={{ uri: item.url }} style={styles.photo} contentFit="cover" />
                ) : (
                  <View style={[styles.photo, styles.photoPlaceholder]} />
                )}
              </Pressable>
            ))}
            <Pressable
              onPress={addPhoto}
              style={[styles.photo, styles.photoAdd]}
              accessibilityRole="button"
              accessibilityLabel="Añadir foto comprobante con la cámara"
            >
              <Ionicons name="camera-outline" size={22} color={colors.cyan} />
            </Pressable>
          </View>
          <Text style={styles.photoHint}>
            Fotos hechas en el momento: la prueba de que cumples tus propias normas.
          </Text>

          <SystemButton
            title={savedToday ? 'Actualizar entrada' : `Registrar día · +${JOURNAL_XP} XP`}
            onPress={save}
            loading={busy}
            style={{ marginTop: 14 }}
          />
        </SystemWindow>

        <SystemWindow color={colors.line}>
          <Text style={styles.windowTitle}>CRÓNICA AUTOMÁTICA DE HOY</Text>
          {chronicle.length === 0 ? (
            <Text style={styles.empty}>El sistema aún no ha registrado actividad hoy.</Text>
          ) : (
            chronicle.map((line, i) => (
              <Text key={i} style={styles.chronicleLine}>
                · {line}
              </Text>
            ))
          )}
        </SystemWindow>

        {recent.length > 0 ? (
          <SystemWindow color={colors.line}>
            <Text style={styles.windowTitle}>ENTRADAS ANTERIORES</Text>
            {recent.map((e) => (
              <View key={e.id} style={styles.entryRow}>
                <Text style={styles.entryDate}>{e.date}</Text>
                <Text style={styles.entryMeta}>
                  {e.mood ? `ánimo ${e.mood}/5` : ''}
                  {e.mood && e.energy ? ' · ' : ''}
                  {e.energy ? `energía ${e.energy}/5` : ''}
                </Text>
                {e.text ? (
                  <Text style={styles.entryText} numberOfLines={3}>
                    {e.text}
                  </Text>
                ) : null}
              </View>
            ))}
          </SystemWindow>
        ) : null}
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
  prompt: { fontFamily: fonts.semibold, fontSize: 15, color: colors.cyanText, lineHeight: 21 },
  label: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 1.5,
    color: colors.textDim,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
  },
  scale: { flexDirection: 'row', gap: 8 },
  scaleChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.cyanDim,
    paddingVertical: 10,
    alignItems: 'center',
  },
  scaleChipOn: { backgroundColor: colors.cyanFaint, borderColor: colors.cyan },
  scaleNum: { fontFamily: fonts.heading, fontSize: 15, color: colors.textDim },
  scaleNumOn: { color: colors.cyan },
  scaleLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.cyanText, marginTop: 6 },
  textarea: {
    borderWidth: 1,
    borderColor: colors.cyanDim,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 110,
    textAlignVertical: 'top',
    lineHeight: 21,
  },
  photoStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo: { width: 72, height: 72, backgroundColor: colors.cyanFaint },
  photoPlaceholder: { borderWidth: 1, borderColor: colors.line },
  photoAdd: {
    borderWidth: 1,
    borderColor: colors.cyanDim,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoHint: { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint, marginTop: 8, lineHeight: 15 },
  windowTitle: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 2.5,
    color: colors.textFaint,
    marginBottom: 8,
  },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.textFaint },
  chronicleLine: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, paddingVertical: 2.5, lineHeight: 18 },
  entryRow: { borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 9 },
  entryDate: { fontFamily: fonts.heading, fontSize: 12, letterSpacing: 1, color: colors.cyanText },
  entryMeta: { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint, marginTop: 1 },
  entryText: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, marginTop: 4, lineHeight: 18 },
});

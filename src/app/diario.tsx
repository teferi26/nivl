import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SystemButton } from '@/components/SystemButton';
import {
  Card,
  Chip,
  EmptyState,
  FadeIn,
  Row,
  RowValue,
  Screen,
  ScreenHeader,
  Section,
  Stagger,
  Tag,
} from '@/components/ui';
import { evaluateAchievements, unlockAchievements } from '@/lib/achievements';
import { useAuth } from '@/lib/auth';
import {
  deleteJournalPhoto,
  fetchJournalPhotos,
  journalPhotoUrl,
  uploadJournalPhoto,
} from '@/lib/contract';
import { ensureProfile } from '@/lib/data';
import { addDays, dateKey, nombreDia, relativoDe } from '@/lib/dates';
import { awardXp } from '@/lib/engine';
import { propagarActo, restoDelModulo } from '@/lib/links';
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
const ENERGY_LABELS = ['Vacío', 'Poca', 'Normal', 'Alta', 'A tope'];
const ESCALA = [1, 2, 3, 4, 5];

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
      return `Objetivo de campaña: ${String(p.task ?? '')}`;
    case 'dungeon_cleared':
      return `Campaña despejada: ${String(p.dungeon ?? '')}`;
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

/** Cinco chips numéricos a lo ancho: ánimo y energía se puntúan igual. */
function Escala({
  valor,
  onChange,
  etiquetas,
  nombre,
}: {
  valor: number | null;
  onChange: (n: number) => void;
  etiquetas: string[];
  nombre: string;
}) {
  return (
    <View>
      <View style={styles.escala}>
        {ESCALA.map((n) => (
          <Chip
            key={n}
            label={String(n)}
            selected={valor === n}
            onPress={() => onChange(n)}
            style={styles.escalaChip}
            accessibilityLabel={`${nombre} ${n} de 5: ${etiquetas[n - 1]}`}
          />
        ))}
      </View>
      <Text style={styles.escalaTexto}>{valor === null ? 'Sin puntuar' : etiquetas[valor - 1]}</Text>
    </View>
  );
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
  // El día que se está escribiendo. No siempre es hoy: se puede retroceder
  // para completar o corregir lo de días pasados.
  const [dia, setDia] = useState(today);
  const [registrado, setRegistrado] = useState(false);
  const [sucio, setSucio] = useState(false);
  const [recent, setRecent] = useState<JournalEntry[]>([]);
  const [chronicle, setChronicle] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);

  const load = useCallback(async () => {
    try {
      const entry = await fetchEntryForDate(dia);
      // Siempre se reinicia: al cambiar de día, si no se limpiara, quedaría en
      // pantalla lo escrito del día anterior y se guardaría en el equivocado.
      setMood(entry?.mood ?? null);
      setEnergy(entry?.energy ?? null);
      setText(entry?.text ?? '');
      setPlan(entry?.plan ?? '');
      setRegistrado(!!entry);
      setSucio(false);
      const todayPhotos = await fetchJournalPhotos(dia);
      setPhotos(
        await Promise.all(
          todayPhotos.map(async (photo) => ({ photo, url: await journalPhotoUrl(photo.path) })),
        ),
      );
      setRecent((await fetchRecentEntries(30)).filter((e) => e.date !== dia).slice(0, 20));
      const start = new Date(`${dia}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const events = await fetchEventsForDate(start.toISOString(), end.toISOString());
      setChronicle(events.map(chronicleLine).filter((l): l is string => l !== null));
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    }
  }, [dia]);

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
      const photo = await uploadJournalPhoto(userId, dia, b64);
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
    try {
      const { isNew } = await upsertEntry(userId, {
        date: dia,
        mood,
        energy,
        text: text.trim() || null,
        plan: plan.trim() || null,
      });
      // El XP solo se paga por escribir el día en caliente: hoy o ayer. Rellenar
      // dos semanas de golpe completaría el archivo igual, pero no debe pagar
      // 20 entradas de una sentada — eso convierte la reflexión en granja.
      const enCaliente = dia === dateKey() || dia === addDays(dateKey(), -1);
      if (isNew && enCaliente) {
        const profile = await ensureProfile(userId);
        // Un solo gesto: escribir el día marca sola la misión del diario. Solo
        // hoy (una misión no se completa con fecha de ayer), y si la había paga
        // ella: el módulo no vuelve a cobrar por lo mismo.
        const eco = dia === dateKey() ? await propagarActo(profile, 'diario', dia) : null;
        const resto = restoDelModulo(JOURNAL_XP, eco);
        if (resto > 0) {
          await awardXp(eco?.profile ?? profile, resto, 'PER', 'journal_entry', { date: dia });
        }
        const pagado = resto + (eco?.xp ?? 0);
        const marcado = eco?.marcadas.length ? `\nMarcado solo: ${eco.marcadas.join(', ')}` : '';
        const total = await countEntries();
        const fresh = await unlockAchievements(userId, evaluateAchievements({ journalCount: total }));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'ENTRADA REGISTRADA',
          `+${pagado} XP a PER${marcado}${fresh.length > 0 ? `\nLogro: ${fresh.map((a) => a.name).join(', ')}` : ''}`,
        );
      }
      if (isNew && !(dia === dateKey() || dia === addDays(dateKey(), -1))) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('ENTRADA REGISTRADA', 'Día completado en tu archivo. Sin XP: solo lo paga el día en caliente.');
      }
      setRegistrado(true);
      await load();
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  const enCaliente = dia === today || dia === addDays(today, -1);
  const esHoy = dia >= today;

  return (
    <Screen>
      <Stagger>
        <FadeIn index={0}>
          <ScreenHeader
            onBack={() => router.back()}
            eyebrow={`Mente · ${relativoDe(dia)}`}
            title="Diario"
            subtitle={nombreDia(dia)}
            right={
              <View style={styles.navDias}>
                <Pressable
                  onPress={() => setDia((d) => addDays(d, -1))}
                  hitSlop={8}
                  style={({ pressed }) => [styles.navBoton, pressed && styles.navPulsado]}
                  accessibilityRole="button"
                  accessibilityLabel="Día anterior"
                >
                  <Ionicons name="chevron-back" size={18} color={colors.text} />
                </Pressable>
                <Pressable
                  onPress={() => setDia((d) => (d < today ? addDays(d, 1) : d))}
                  hitSlop={8}
                  disabled={esHoy}
                  style={({ pressed }) => [styles.navBoton, esHoy && styles.navBotonOff, pressed && styles.navPulsado]}
                  accessibilityRole="button"
                  accessibilityLabel="Día siguiente"
                  accessibilityState={{ disabled: esHoy }}
                >
                  <Ionicons name="chevron-forward" size={18} color={colors.text} />
                </Pressable>
              </View>
            }
          />
        </FadeIn>

        <FadeIn index={1}>
          {/* Que se vea de un vistazo si ese día ya está escrito: el fallo era
              entrar de nuevo y no saber si se había enviado. */}
          <Card variant={registrado ? 'tinted' : 'outline'} accent={sucio ? colors.red : undefined}>
            <View style={styles.estadoFila}>
              <Tag tone={registrado ? 'accent' : 'dim'}>{registrado ? 'Registrado' : 'Sin registrar'}</Tag>
              {sucio ? <Tag tone="red">Cambios sin guardar</Tag> : null}
              {enCaliente && !registrado ? <Tag tone="dim">+{JOURNAL_XP} XP</Tag> : null}
            </View>
            <Text style={styles.prompt}>{promptForDate(dia)}</Text>
          </Card>
        </FadeIn>

        <FadeIn index={2}>
          <Section title="Ánimo">
            <Escala valor={mood} etiquetas={MOOD_LABELS} nombre="Ánimo" onChange={(n) => { setMood(n); setSucio(true); }} />
          </Section>
        </FadeIn>

        <FadeIn index={3}>
          <Section title="Energía">
            <Escala valor={energy} etiquetas={ENERGY_LABELS} nombre="Energía" onChange={(n) => { setEnergy(n); setSucio(true); }} />
          </Section>
        </FadeIn>

        <FadeIn index={4}>
          <Section title="Hoja 1 · Lo vivido y aprendido">
            <TextInput
              style={styles.textarea}
              value={text}
              onChangeText={(v) => { setText(v); setSucio(true); }}
              placeholder="Qué hice, qué aprendí, qué haría distinto…"
              placeholderTextColor={colors.textFaint}
              multiline
              accessibilityLabel="Lo vivido y aprendido"
            />
          </Section>
        </FadeIn>

        <FadeIn index={5}>
          <Section title="Hoja 2 · El plan del día">
            <TextInput
              style={styles.textarea}
              value={plan}
              onChangeText={(v) => { setPlan(v); setSucio(true); }}
              placeholder="Las tareas y batallas del día…"
              placeholderTextColor={colors.textFaint}
              multiline
              accessibilityLabel="El plan del día"
            />
          </Section>
        </FadeIn>

        <FadeIn index={6}>
          <Section title="Comprobantes" meta={photos.length > 0 ? `${photos.length}` : undefined}>
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
                style={({ pressed }) => [styles.photo, styles.photoAdd, pressed && styles.navPulsado]}
                accessibilityRole="button"
                accessibilityLabel="Añadir foto comprobante con la cámara"
              >
                <Ionicons name="camera-outline" size={22} color={colors.text} />
              </Pressable>
            </View>
            <Text style={styles.nota}>Fotos hechas en el momento: la prueba de que cumples tus propias normas.</Text>
            <SystemButton
              title={registrado ? 'Guardar cambios' : enCaliente ? `Registrar el día · +${JOURNAL_XP} XP` : 'Registrar el día'}
              onPress={save}
              loading={busy}
              icon={registrado ? 'save-outline' : 'checkmark'}
              style={{ marginTop: 18 }}
            />
            {sucio ? <Text style={styles.avisoSucio}>Hay cambios sin guardar. Se pierden si cambias de día.</Text> : null}
          </Section>
        </FadeIn>

        <FadeIn index={7}>
          <Section title="Crónica automática" meta={chronicle.length > 0 ? `${chronicle.length}` : undefined}>
            {chronicle.length === 0 ? (
              <Card variant="outline">
                <EmptyState compact icon="time-outline" title="Sin actividad ese día" body="El sistema no registró nada." />
              </Card>
            ) : (
              <Card padded={false} style={styles.lista}>
                {chronicle.map((line, i) => (
                  <Row
                    key={`${i}-${line}`}
                    first={i === 0}
                    leading={<Ionicons name="ellipse" size={6} color={colors.accentDim} />}
                    title={line}
                  />
                ))}
              </Card>
            )}
          </Section>
        </FadeIn>

        {recent.length > 0 ? (
          <FadeIn index={8}>
            <Section title="Entradas anteriores" meta={`${recent.length}`}>
              <Card padded={false} style={styles.lista}>
                {recent.map((e, i) => (
                  <Row
                    key={e.id}
                    first={i === 0}
                    title={nombreDia(e.date)}
                    detail={
                      <View>
                        <Text style={styles.entradaMeta}>{relativoDe(e.date)}</Text>
                        {e.text ? (
                          <Text style={styles.entradaTexto} numberOfLines={2}>
                            {e.text}
                          </Text>
                        ) : null}
                      </View>
                    }
                    trailing={
                      e.mood || e.energy ? (
                        <RowValue>
                          {e.mood ? `Á ${e.mood}` : ''}
                          {e.mood && e.energy ? ' · ' : ''}
                          {e.energy ? `E ${e.energy}` : ''}
                        </RowValue>
                      ) : undefined
                    }
                    chevron
                    onPress={() => setDia(e.date)}
                    accessibilityLabel={`Abrir el diario del ${nombreDia(e.date)}`}
                  />
                ))}
              </Card>
              <Text style={styles.nota}>Toca una entrada para leerla entera o editarla. Á es ánimo, E energía.</Text>
            </Section>
          </FadeIn>
        ) : null}
      </Stagger>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lista: { paddingHorizontal: 16, paddingVertical: 2 },
  navDias: { flexDirection: 'row', gap: 8, marginBottom: 2 },
  navBoton: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBotonOff: { opacity: 0.3 },
  navPulsado: { opacity: 0.7 },
  estadoFila: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  prompt: { fontFamily: fonts.semibold, fontSize: 15.5, lineHeight: 22, color: colors.text },
  escala: { flexDirection: 'row', gap: 8 },
  escalaChip: { flex: 1, justifyContent: 'center', paddingHorizontal: 0 },
  escalaTexto: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textDim, marginTop: 8 },
  textarea: {
    borderWidth: 1,
    borderColor: colors.accentDim,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 15.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 130,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  photoStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo: { width: 76, height: 76, backgroundColor: colors.accentFaint },
  photoPlaceholder: { borderWidth: 1, borderColor: colors.line },
  photoAdd: {
    borderWidth: 1,
    borderColor: colors.accentDim,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nota: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textFaint, marginTop: 8 },
  avisoSucio: { fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 17, color: colors.red, marginTop: 10, textAlign: 'center' },
  entradaMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
  entradaTexto: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textDim, marginTop: 3 },
});

import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Archivo } from '@/components/diario/Archivo';
import { Cronica, lineaDeCronica, type LineaCronica } from '@/components/diario/Cronica';
import { EmotionPicker } from '@/components/diario/EmotionPicker';
import { Pregunta } from '@/components/diario/Pregunta';
import { SleepStepper } from '@/components/diario/SleepStepper';
import { WinsEditor } from '@/components/diario/WinsEditor';
import { SystemButton } from '@/components/SystemButton';
import { Card, Chip, FadeIn, Screen, ScreenHeader, Skeleton, Stagger, Tag } from '@/components/ui';
import { evaluateAchievements, unlockAchievements } from '@/lib/achievements';
import { useAuth } from '@/lib/auth';
import {
  deleteJournalPhoto,
  fetchJournalPhotos,
  fetchJournalPhotosForDates,
  journalPhotoUrl,
  uploadJournalPhoto,
} from '@/lib/contract';
import { ensureProfile } from '@/lib/data';
import { addDays, dateKey, nombreDia, relativoDe } from '@/lib/dates';
import { awardXp } from '@/lib/engine';
import { JOURNAL_XP } from '@/lib/game';
import {
  countEntries,
  fetchEntriesForDates,
  fetchEntryForDate,
  fetchEventsForDate,
  fetchRecentEntries,
  promptForDate,
  upsertEntry,
} from '@/lib/journal';
import {
  MAX_VICTORIAS,
  completitud,
  entradaVacia,
  fechasFlashback,
  limpiarVictorias,
  type SeccionId,
} from '@/lib/journalmath';
import { propagarActo, restoDelModulo } from '@/lib/links';
import { colors, fonts } from '@/lib/theme';
import type { JournalEntry, JournalPhoto } from '@/lib/types';
import { mensajeSistema } from '@/lib/validation';

const MOOD_LABELS = ['Hundido', 'Bajo', 'Normal', 'Bien', 'Imparable'];
const ENERGY_LABELS = ['Vacío', 'Poca', 'Normal', 'Alta', 'A tope'];
const ESCALA = [1, 2, 3, 4, 5];
/** Entradas que estudia el Archivo: dos meses dan tendencia sin traer la vida entera. */
const RECIENTES = 60;

type Segmento = 'escribir' | 'archivo';

/** Cinco chips numéricos a lo ancho: ánimo y energía se puntúan igual. */
function Escala({
  valor,
  onChange,
  etiquetas,
  nombre,
}: {
  valor: number | null;
  onChange: (n: number | null) => void;
  etiquetas: string[];
  nombre: string;
}) {
  return (
    <View style={styles.escalaBloque}>
      <View style={styles.escalaCabecera}>
        <Text style={styles.escalaNombre}>{nombre}</Text>
        <Text style={styles.escalaTexto}>{valor === null ? 'Sin puntuar' : etiquetas[valor - 1]}</Text>
      </View>
      <View style={styles.escala} accessibilityRole="radiogroup" accessibilityLabel={nombre}>
        {ESCALA.map((n) => (
          <Chip
            key={n}
            label={String(n)}
            selected={valor === n}
            // Tocar la nota ya marcada la quita: todas las preguntas se pueden dejar en blanco.
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(valor === n ? null : n);
            }}
            style={styles.escalaChip}
            accessibilityLabel={`${nombre} ${n} de 5: ${etiquetas[n - 1]}`}
          />
        ))}
      </View>
    </View>
  );
}

export default function Diario() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const today = dateKey();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Ancho de las gráficas: pantalla menos el padding de la pantalla (20+20) y el de la Card (16+16).
  const chartWidth = Math.min(width - 72, 420);

  const [segmento, setSegmento] = useState<Segmento>('escribir');

  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [emotions, setEmotions] = useState<string[]>([]);
  const [sleep, setSleep] = useState<number | null>(null);
  const [wins, setWins] = useState<string[]>(['']);
  const [text, setText] = useState('');
  const [lesson, setLesson] = useState('');
  const [gratitude, setGratitude] = useState('');
  const [plan, setPlan] = useState('');
  const [photos, setPhotos] = useState<{ photo: JournalPhoto; url: string | null }[]>([]);
  // El día que se está escribiendo. No siempre es hoy: se puede retroceder
  // para completar o corregir lo de días pasados.
  const [dia, setDia] = useState(today);
  const [registrado, setRegistrado] = useState(false);
  const [sucio, setSucio] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [chronicle, setChronicle] = useState<LineaCronica[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const saving = useRef(false);
  // Espejo síncrono de `sucio`: al volver a la pantalla o al refrescar no se
  // recarga el día si hay algo a medio escribir (antes se perdía sin avisar).
  const sucioRef = useRef(false);
  // Turno de carga: al pasar de día deprisa, una respuesta vieja no pisa a la nueva.
  const turno = useRef(0);
  const scroll = useRef<ScrollView>(null);

  const [recent, setRecent] = useState<JournalEntry[]>([]);
  const [recuerdos, setRecuerdos] = useState<JournalEntry[]>([]);
  const [photoCounts, setPhotoCounts] = useState<Map<string, number>>(new Map());
  const [archivoLoaded, setArchivoLoaded] = useState(false);
  const fotosPorDia = useRef(new Map<string, JournalPhoto[]>());
  const urlsPorDia = useRef(new Map<string, Promise<string[]>>());

  const marcar = () => {
    sucioRef.current = true;
    setSucio(true);
    setAviso(null);
  };

  const loadDia = useCallback(async () => {
    const mio = ++turno.current;
    try {
      const start = new Date(`${dia}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const [entry, dayPhotos, events] = await Promise.all([
        fetchEntryForDate(dia),
        fetchJournalPhotos(dia),
        fetchEventsForDate(start.toISOString(), end.toISOString()),
      ]);
      const conUrl = await Promise.all(
        dayPhotos.map(async (photo) => ({ photo, url: await journalPhotoUrl(photo.path) })),
      );
      if (mio !== turno.current) return;
      // Siempre se reinicia: al cambiar de día, si no se limpiara, quedaría en
      // pantalla lo escrito del día anterior y se guardaría en el equivocado.
      setMood(entry?.mood ?? null);
      setEnergy(entry?.energy ?? null);
      setEmotions(entry?.emotions ?? []);
      setSleep(entry?.sleep_hours ?? null);
      setWins(entry?.wins.length ? entry.wins : ['']);
      setText(entry?.text ?? '');
      setLesson(entry?.lesson ?? '');
      setGratitude(entry?.gratitude ?? '');
      setPlan(entry?.plan ?? '');
      setRegistrado(!!entry);
      sucioRef.current = false;
      setSucio(false);
      setPhotos(conUrl);
      setChronicle(events.map(lineaDeCronica).filter((l): l is LineaCronica => l !== null));
    } catch (e) {
      if (mio === turno.current) Alert.alert('Error del sistema', mensajeSistema(e));
    } finally {
      if (mio === turno.current) setLoaded(true);
    }
  }, [dia]);

  const loadArchivo = useCallback(async () => {
    try {
      const hoy = dateKey();
      const [entries, viejas] = await Promise.all([
        fetchRecentEntries(RECIENTES),
        fetchEntriesForDates(Object.values(fechasFlashback(hoy))),
      ]);
      // Una sola consulta para saber qué días tienen fotos; las URL firmadas
      // se piden después, tarjeta a tarjeta y solo si se van a ver.
      const fotos = await fetchJournalPhotosForDates(entries.map((e) => e.date));
      const porDia = new Map<string, JournalPhoto[]>();
      for (const f of fotos) porDia.set(f.date, [...(porDia.get(f.date) ?? []), f]);
      fotosPorDia.current = porDia;
      urlsPorDia.current = new Map();
      setPhotoCounts(new Map([...porDia].map(([d, l]) => [d, l.length])));
      setRecent(entries);
      setRecuerdos(viejas);
    } catch {
      // El Archivo es lectura: si falla, se queda lo que hubiera y escribir sigue funcionando.
    } finally {
      setArchivoLoaded(true);
    }
  }, []);

  const loadPhotos = useCallback((date: string): Promise<string[]> => {
    const ya = urlsPorDia.current.get(date);
    if (ya) return ya;
    const pedido = Promise.all((fotosPorDia.current.get(date) ?? []).map((f) => journalPhotoUrl(f.path))).then(
      (urls) => urls.filter((u): u is string => !!u),
    );
    urlsPorDia.current.set(date, pedido);
    return pedido;
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!sucioRef.current) loadDia();
    }, [loadDia]),
  );

  useFocusEffect(
    useCallback(() => {
      loadArchivo();
    }, [loadArchivo]),
  );

  const refrescar = async () => {
    setRefreshing(true);
    await Promise.all([sucioRef.current ? Promise.resolve() : loadDia(), loadArchivo()]);
    setRefreshing(false);
  };

  /** Cambiar de día tira lo no guardado: se pregunta una vez, no se pierde en silencio. */
  const irADia = (next: string, alEscribir = false) => {
    const ir = () => {
      sucioRef.current = false;
      setSucio(false);
      setAviso(null);
      if (next !== dia) {
        setLoaded(false);
        setDia(next);
      }
      if (alEscribir) setSegmento('escribir');
      scroll.current?.scrollTo({ y: 0, animated: false });
    };
    if (!sucioRef.current || next === dia) return ir();
    Alert.alert('Cambios sin guardar', 'Si cambias de día se pierde lo que has escrito.', [
      { text: 'Seguir escribiendo', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: ir },
    ]);
  };

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
      loadArchivo();
    } catch (e) {
      Alert.alert('Error del sistema', mensajeSistema(e));
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
            loadArchivo();
          } catch (e) {
            Alert.alert('Error del sistema', mensajeSistema(e));
          }
        },
      },
    ]);
  };

  /** Lo que se guardaría ahora mismo: de aquí salen la completitud y el guardado. */
  const borrador = useMemo(
    () => ({
      mood,
      energy,
      emotions,
      sleep_hours: sleep,
      wins: limpiarVictorias(wins),
      text: text.trim() || null,
      lesson: lesson.trim() || null,
      gratitude: gratitude.trim() || null,
      plan: plan.trim() || null,
    }),
    [mood, energy, emotions, sleep, wins, text, lesson, gratitude, plan],
  );
  const hecho = completitud(borrador);
  const lista = (s: SeccionId) => hecho.porSeccion[s];

  const reclamadas = useMemo(() => new Set(borrador.wins.map((w) => w.toLocaleLowerCase('es'))), [borrador.wins]);
  const cabenMas = borrador.wins.length < MAX_VICTORIAS;

  /** Lo que el sistema vio pasa a ser algo que él reclama: ocupa la primera fila vacía. */
  const reclamar = (victoria: string) => {
    if (!cabenMas || reclamadas.has(victoria.toLocaleLowerCase('es'))) return;
    Haptics.selectionAsync().catch(() => {});
    const hueco = wins.findIndex((w) => !w.trim());
    setWins(hueco >= 0 ? wins.map((w, i) => (i === hueco ? victoria : w)) : [...wins, victoria]);
    marcar();
  };

  const save = async () => {
    // Cerrojo síncrono: dos toques rápidos ya no insertan dos entradas ni duplican XP.
    if (!userId || busy || saving.current) return;
    // Una entrada en blanco no es un cierre: ni ocupa el archivo ni cobra XP.
    if (entradaVacia(borrador)) {
      setAviso('Aún no hay nada que registrar. Responde al menos una pregunta; las demás pueden esperar.');
      return;
    }
    saving.current = true;
    setBusy(true);
    setAviso(null);
    try {
      const { isNew } = await upsertEntry(userId, { date: dia, ...borrador });
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
      if (!isNew) {
        Haptics.selectionAsync().catch(() => {});
        setAviso('Cambios guardados.');
      }
      setRegistrado(true);
      await Promise.all([loadDia(), loadArchivo()]);
    } catch (e) {
      Alert.alert('Error del sistema', mensajeSistema(e));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  const enCaliente = dia === today || dia === addDays(today, -1);
  const esHoy = dia >= today;
  const escribiendo = segmento === 'escribir';

  const cambiarSegmento = (s: Segmento) => {
    if (s === segmento) return;
    Haptics.selectionAsync().catch(() => {});
    setSegmento(s);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  return (
    <Screen plain>
      {/* Un solo mecanismo de teclado: el ScrollView ajusta sus insets y lleva el
          campo con foco a la vista. Sin KeyboardAvoidingView, que junto a esto
          suma el teclado dos veces en iOS. El pie queda bajo el teclado mientras
          se escribe; arrastrar la pantalla lo cierra y el botón vuelve. */}
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refrescar} tintColor={colors.accent} />}
      >
        <ScreenHeader
          onBack={() => router.back()}
          eyebrow={escribiendo ? `Mente · ${relativoDe(dia)}` : 'Mente · Archivo'}
          title="Diario"
          subtitle={escribiendo ? nombreDia(dia) : 'Lo que has vivido, día a día.'}
          right={
            escribiendo ? (
              <View style={styles.navDias}>
                <Pressable
                  onPress={() => irADia(addDays(dia, -1))}
                  hitSlop={8}
                  style={({ pressed }) => [styles.navBoton, pressed && styles.navPulsado]}
                  accessibilityRole="button"
                  accessibilityLabel="Día anterior"
                >
                  <Ionicons name="chevron-back" size={18} color={colors.text} />
                </Pressable>
                <Pressable
                  onPress={() => irADia(dia < today ? addDays(dia, 1) : dia)}
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
            ) : undefined
          }
        />

        {/* Escribir y recordar son dos gestos distintos: cada uno con su sitio,
            ninguno enterrado debajo del otro. */}
        <View style={styles.segmentos} accessibilityRole="radiogroup" accessibilityLabel="Sección del diario">
          <Chip
            label={dia === today ? 'Hoy' : relativoDe(dia)}
            icon="create-outline"
            selected={escribiendo}
            onPress={() => cambiarSegmento('escribir')}
            style={styles.segmento}
            accessibilityLabel={`Escribir el día: ${relativoDe(dia)}`}
          />
          <Chip
            label="Archivo"
            icon="albums-outline"
            selected={!escribiendo}
            onPress={() => cambiarSegmento('archivo')}
            style={styles.segmento}
            accessibilityLabel="Archivo: leer los días anteriores"
          />
        </View>

        {!escribiendo ? (
          <Archivo
            loaded={archivoLoaded}
            hoy={today}
            entries={recent}
            recuerdos={recuerdos}
            photoCounts={photoCounts}
            loadPhotos={loadPhotos}
            chartWidth={chartWidth}
            onOpen={(date) => irADia(date, true)}
            onWriteToday={() => irADia(today, true)}
          />
        ) : !loaded ? (
          <View accessibilityRole="progressbar" accessibilityLabel="Cargando el día">
            <Skeleton height={84} style={styles.hueco} />
            <Skeleton height={150} style={styles.hueco} />
            <Skeleton height={70} style={styles.hueco} />
            <Skeleton height={130} />
          </View>
        ) : (
          // La clave remonta el formulario al cambiar de día: ninguna fila de
          // victorias ni foco se hereda del día anterior.
          <Stagger key={dia}>
            <FadeIn index={0}>
              {/* Que se vea de un vistazo si ese día ya está escrito: el fallo era
                  entrar de nuevo y no saber si se había enviado. */}
              <Card variant={registrado ? 'tinted' : 'outline'} accent={sucio ? colors.red : undefined} style={styles.estado}>
                <View style={styles.estadoFila}>
                  <Tag tone={registrado ? 'accent' : 'dim'}>{registrado ? 'Registrado' : 'Sin registrar'}</Tag>
                  {sucio ? <Tag tone="red">Cambios sin guardar</Tag> : null}
                  {enCaliente && !registrado ? <Tag tone="dim">+{JOURNAL_XP} XP</Tag> : null}
                </View>
                <Text style={styles.estadoTexto}>
                  El cierre del día. Siete preguntas cortas, ninguna obligatoria: responde las que hoy tengan algo que decir.
                </Text>
              </Card>
            </FadeIn>

            <FadeIn index={1}>
              <Pregunta numeral="I" title="Cómo me sentí" hint="Dos notas y, sobre todo, un nombre." done={lista('sentir')}>
                <Escala valor={mood} etiquetas={MOOD_LABELS} nombre="Ánimo" onChange={(n) => { setMood(n); marcar(); }} />
                <Escala valor={energy} etiquetas={ENERGY_LABELS} nombre="Energía" onChange={(n) => { setEnergy(n); marcar(); }} />
                <EmotionPicker value={emotions} onChange={(next) => { setEmotions(next); marcar(); }} />
              </Pregunta>
            </FadeIn>

            <FadeIn index={2}>
              <Pregunta numeral="II" title="Cómo dormí" hint="El sueño es lo primero que mira el coach." done={lista('sueno')}>
                <SleepStepper value={sleep} onChange={(next) => { setSleep(next); marcar(); }} />
              </Pregunta>
            </FadeIn>

            <FadeIn index={3}>
              <Pregunta
                numeral="III"
                title="Qué logré"
                hint="Victorias del día. Una por línea, por pequeña que sea."
                done={lista('victorias')}
              >
                <WinsEditor value={wins} onChange={(next) => { setWins(next); marcar(); }} />
                <Text style={styles.subrotulo}>Lo que registró el sistema</Text>
                <Cronica lineas={chronicle} reclamadas={reclamadas} cabenMas={cabenMas} onReclamar={reclamar} />
              </Pregunta>
            </FadeIn>

            <FadeIn index={4}>
              <Pregunta numeral="IV" title="Lo vivido" hint={promptForDate(dia)} done={lista('vivido')}>
                <TextInput
                  style={styles.textarea}
                  value={text}
                  onChangeText={(v) => { setText(v); marcar(); }}
                  placeholder="Lo que pasó, tal como lo contarías."
                  placeholderTextColor={colors.textFaint}
                  multiline
                  scrollEnabled={false}
                  accessibilityLabel="Lo vivido"
                />
              </Pregunta>
            </FadeIn>

            <FadeIn index={5}>
              <Pregunta numeral="V" title="Qué aprendí" hint="Una lección. Lo que harías distinto." done={lista('leccion')}>
                <TextInput
                  style={[styles.textarea, styles.textareaCorta]}
                  value={lesson}
                  onChangeText={(v) => { setLesson(v); marcar(); }}
                  placeholder="La próxima vez…"
                  placeholderTextColor={colors.textFaint}
                  multiline
                  scrollEnabled={false}
                  maxLength={600}
                  accessibilityLabel="Qué aprendí"
                />
              </Pregunta>
            </FadeIn>

            <FadeIn index={6}>
              <Pregunta numeral="VI" title="Qué agradezco" hint="Una línea. Opcional, como todo." done={lista('gratitud')}>
                <TextInput
                  style={styles.linea}
                  value={gratitude}
                  onChangeText={(v) => { setGratitude(v); marcar(); }}
                  placeholder="A quién o a qué"
                  placeholderTextColor={colors.textFaint}
                  maxLength={240}
                  returnKeyType="done"
                  accessibilityLabel="Qué agradezco"
                />
              </Pregunta>
            </FadeIn>

            <FadeIn index={7}>
              <Pregunta
                numeral="VII"
                title="Mañana, lo primero"
                hint="Una sola cosa, con hora si puedes. El plan entero lo escribe el coach."
                done={lista('manana')}
              >
                <TextInput
                  style={styles.linea}
                  value={plan}
                  onChangeText={(v) => { setPlan(v); marcar(); }}
                  placeholder="A las 8:00, …"
                  placeholderTextColor={colors.textFaint}
                  maxLength={240}
                  returnKeyType="done"
                  accessibilityLabel="Mañana, lo primero"
                />
              </Pregunta>
            </FadeIn>

            <FadeIn index={8}>
              <Pregunta numeral="VIII" title="Comprobantes" done={photos.length > 0}>
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
                <Text style={styles.nota}>
                  Fotos hechas en el momento: la prueba de que cumples tus propias normas. Se guardan al hacerlas.
                </Text>
              </Pregunta>
            </FadeIn>
          </Stagger>
        )}
      </ScrollView>

      {/* Pie fijo: registrar siempre a mano, sin bajar ocho secciones. */}
      {escribiendo && loaded ? (
        <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
          <View style={styles.progresoFila}>
            <View
              style={styles.progreso}
              accessibilityRole="progressbar"
              accessibilityLabel={`${hecho.hechas} de ${hecho.total} preguntas respondidas`}
            >
              {Array.from({ length: hecho.total }, (_, i) => (
                <View key={i} style={[styles.tramo, i < hecho.hechas && styles.tramoOn]} />
              ))}
            </View>
            <Text style={styles.progresoTexto}>
              {hecho.hechas} de {hecho.total}
            </Text>
          </View>
          {aviso ? (
            <Text style={styles.aviso} accessibilityLiveRegion="polite">
              {aviso}
            </Text>
          ) : sucio ? (
            <Text style={styles.avisoSucio}>Hay cambios sin guardar.</Text>
          ) : null}
          <SystemButton
            title={registrado ? 'Guardar cambios' : enCaliente ? `Registrar el día · +${JOURNAL_XP} XP` : 'Registrar el día'}
            onPress={save}
            loading={busy}
            icon={registrado ? 'save-outline' : 'checkmark'}
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  hueco: { marginBottom: 14 },
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
  segmentos: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  segmento: { flex: 1, justifyContent: 'center' },
  estado: { marginBottom: 28 },
  estadoFila: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  estadoTexto: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.textDim },
  escalaBloque: { marginBottom: 16 },
  escalaCabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  escalaNombre: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  escala: { flexDirection: 'row', gap: 8 },
  escalaChip: { flex: 1, justifyContent: 'center', paddingHorizontal: 0 },
  escalaTexto: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textDim },
  subrotulo: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.textFaint,
    marginTop: 18,
    marginBottom: 10,
  },
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
  textareaCorta: { minHeight: 76 },
  linea: {
    borderWidth: 1,
    borderColor: colors.accentDim,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 15.5,
    paddingHorizontal: 14,
    paddingVertical: 13,
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
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
  progresoFila: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  progreso: { flex: 1, flexDirection: 'row', gap: 4 },
  tramo: { flex: 1, height: 3, backgroundColor: colors.track },
  tramoOn: { backgroundColor: colors.accent },
  progresoTexto: { fontFamily: fonts.number, fontSize: 12, letterSpacing: 0.5, color: colors.textDim },
  aviso: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: colors.accentText, marginBottom: 10 },
  avisoSucio: { fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 17, color: colors.red, marginBottom: 10 },
});

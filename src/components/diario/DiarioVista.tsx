// NIVL · Diario: la vista (patrón L-RADICAL §C). Pura: todo llega por props
// desde useDiario (o desde la galería con datos de mentira) y no carga nada.

import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import type { RefObject } from 'react';
import {
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
import { SystemButton } from '@/components/SystemButton';
import { Card, Chip, FadeIn, Screen, ScreenHeader, Skeleton, Stagger, Tag } from '@/components/ui';
import { addDays, nombreDia, relativoDe } from '@/lib/dates';
import type { Completitud, SeccionId } from '@/lib/journalmath';
import { colors, fonts } from '@/lib/theme';
import type { JournalEntry, JournalPhoto } from '@/lib/types';
import { Archivo } from './Archivo';
import { Cronica, type LineaCronica } from './Cronica';
import { EmotionPicker } from './EmotionPicker';
import { Pregunta } from './Pregunta';
import { SleepStepper } from './SleepStepper';
import { WinsEditor } from './WinsEditor';

export type Segmento = 'escribir' | 'archivo';

export interface FotoDiario {
  photo: JournalPhoto;
  url: string | null;
}

export interface RespuestasDiario {
  mood: number | null;
  energy: number | null;
  emotions: string[];
  sleep: number | null;
  /** Las filas tal cual están en pantalla, vacías incluidas. */
  wins: string[];
  text: string;
  lesson: string;
  gratitude: string;
  plan: string;
}

export interface DiarioVistaProps {
  segmento: Segmento;
  hoy: string;
  /** El día que se escribe (hoy o uno pasado). */
  dia: string;
  /** Hasta la primera carga del día se pintan huecos. */
  cargado: boolean;
  registrado: boolean;
  sucio: boolean;
  /** Guardando: el botón espera. */
  ocupado: boolean;
  refrescando: boolean;
  aviso: string | null;
  /** XP del día en caliente (JOURNAL_XP). */
  xp: number;
  /** La pista de «Lo vivido» de ese día (promptForDate). */
  pista: string;
  respuestas: RespuestasDiario;
  hecho: Completitud;
  /** Victorias ya escritas, en minúsculas. */
  reclamadas: Set<string>;
  cabenMas: boolean;
  fotos: FotoDiario[];
  cronica: LineaCronica[];
  archivo: {
    cargado: boolean;
    entries: JournalEntry[];
    recuerdos: JournalEntry[];
    photoCounts: Map<string, number>;
    loadPhotos: (date: string) => Promise<string[]>;
  };
  /** El hook vuelve arriba al cambiar de día o de segmento. */
  scrollRef?: RefObject<ScrollView | null>;
  acciones: {
    onVolver: () => void;
    onSegmento: (s: Segmento) => void;
    onIrADia: (date: string, alEscribir?: boolean) => void;
    onMood: (n: number | null) => void;
    onEnergy: (n: number | null) => void;
    onEmotions: (next: string[]) => void;
    onSleep: (next: number | null) => void;
    onWins: (next: string[]) => void;
    onText: (v: string) => void;
    onLesson: (v: string) => void;
    onGratitude: (v: string) => void;
    onPlan: (v: string) => void;
    onReclamar: (victoria: string) => void;
    onAnadirFoto: () => void;
    onQuitarFoto: (item: FotoDiario) => void;
    onGuardar: () => void;
    onRefrescar: () => void;
  };
}

const MOOD_LABELS = ['Hundido', 'Bajo', 'Normal', 'Bien', 'Imparable'];
const ENERGY_LABELS = ['Vacío', 'Poca', 'Normal', 'Alta', 'A tope'];
const ESCALA = [1, 2, 3, 4, 5];

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
            // El Chip ya vibra al elegir (Lote 0): aquí no se vuelve a vibrar.
            onPress={() => onChange(valor === n ? null : n)}
            style={styles.escalaChip}
            accessibilityLabel={`${nombre} ${n} de 5: ${etiquetas[n - 1]}`}
          />
        ))}
      </View>
    </View>
  );
}

export function DiarioVista({
  segmento,
  hoy: today,
  dia,
  cargado: loaded,
  registrado,
  sucio,
  ocupado: busy,
  refrescando: refreshing,
  aviso,
  xp,
  pista,
  respuestas,
  hecho,
  reclamadas,
  cabenMas,
  fotos: photos,
  cronica: chronicle,
  archivo,
  scrollRef,
  acciones,
}: DiarioVistaProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Ancho de las gráficas: pantalla menos el padding de la pantalla (20+20) y el de la Card (16+16).
  const chartWidth = Math.min(width - 72, 420);
  const { mood, energy, emotions, sleep, wins, text, lesson, gratitude, plan } = respuestas;
  const lista = (s: SeccionId) => hecho.porSeccion[s];
  const irADia = acciones.onIrADia;

  const enCaliente = dia === today || dia === addDays(today, -1);
  const esHoy = dia >= today;
  const escribiendo = segmento === 'escribir';

  return (
    <Screen plain>
      {/* Un solo mecanismo de teclado: el ScrollView ajusta sus insets y lleva el
          campo con foco a la vista. Sin KeyboardAvoidingView, que junto a esto
          suma el teclado dos veces en iOS. El pie queda bajo el teclado mientras
          se escribe; arrastrar la pantalla lo cierra y el botón vuelve. */}
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={acciones.onRefrescar} tintColor={colors.accent} />}
      >
        <ScreenHeader
          onBack={acciones.onVolver}
          eyebrow={escribiendo ? `Mente · ${relativoDe(dia, today)}` : 'Mente · Archivo'}
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
            label={dia === today ? 'Hoy' : relativoDe(dia, today)}
            icon="create-outline"
            selected={escribiendo}
            onPress={() => acciones.onSegmento('escribir')}
            style={styles.segmento}
            accessibilityLabel={`Escribir el día: ${relativoDe(dia, today)}`}
          />
          <Chip
            label="Archivo"
            icon="albums-outline"
            selected={!escribiendo}
            onPress={() => acciones.onSegmento('archivo')}
            style={styles.segmento}
            accessibilityLabel="Archivo: leer los días anteriores"
          />
        </View>

        {!escribiendo ? (
          <Archivo
            loaded={archivo.cargado}
            hoy={today}
            entries={archivo.entries}
            recuerdos={archivo.recuerdos}
            photoCounts={archivo.photoCounts}
            loadPhotos={archivo.loadPhotos}
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
                  {enCaliente && !registrado ? <Tag tone="dim">+{xp} XP</Tag> : null}
                </View>
                <Text style={styles.estadoTexto}>
                  El cierre del día. Siete preguntas cortas, ninguna obligatoria: responde las que hoy tengan algo que decir.
                </Text>
              </Card>
            </FadeIn>

            <FadeIn index={1}>
              <Pregunta numeral="I" title="Cómo me sentí" hint="Dos notas y, sobre todo, un nombre." done={lista('sentir')}>
                <Escala valor={mood} etiquetas={MOOD_LABELS} nombre="Ánimo" onChange={acciones.onMood} />
                <Escala valor={energy} etiquetas={ENERGY_LABELS} nombre="Energía" onChange={acciones.onEnergy} />
                <EmotionPicker value={emotions} onChange={acciones.onEmotions} />
              </Pregunta>
            </FadeIn>

            <FadeIn index={2}>
              <Pregunta numeral="II" title="Cómo dormí" hint="El sueño es lo primero que mira el coach." done={lista('sueno')}>
                <SleepStepper value={sleep} onChange={acciones.onSleep} />
              </Pregunta>
            </FadeIn>

            <FadeIn index={3}>
              <Pregunta
                numeral="III"
                title="Qué logré"
                hint="Victorias del día. Una por línea, por pequeña que sea."
                done={lista('victorias')}
              >
                <WinsEditor value={wins} onChange={acciones.onWins} />
                <Text style={styles.subrotulo}>Lo que registró el sistema</Text>
                <Cronica lineas={chronicle} reclamadas={reclamadas} cabenMas={cabenMas} onReclamar={acciones.onReclamar} />
              </Pregunta>
            </FadeIn>

            <FadeIn index={4}>
              <Pregunta numeral="IV" title="Lo vivido" hint={pista} done={lista('vivido')}>
                <TextInput
                  style={styles.textarea}
                  value={text}
                  onChangeText={acciones.onText}
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
                  onChangeText={acciones.onLesson}
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
                  onChangeText={acciones.onGratitude}
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
                  onChangeText={acciones.onPlan}
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
                      onLongPress={() => acciones.onQuitarFoto(item)}
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
                    onPress={acciones.onAnadirFoto}
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
            title={registrado ? 'Guardar cambios' : enCaliente ? `Registrar el día · +${xp} XP` : 'Registrar el día'}
            onPress={acciones.onGuardar}
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

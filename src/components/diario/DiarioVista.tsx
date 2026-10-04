// NIVL · Diario: la vista (patrón L-RADICAL §C, FASE3 Lote D). Pura: todo
// llega por props desde useDiario (o desde la galería con datos de mentira) y
// no carga nada.
//
// Escritura, de arriba abajo: el encabezado grabado («Mente · hoy» /
// «DIARIO», con la acción «Archivo» en contorno), la fila del día con sus
// flechas de 44, el estado del día en una TarjetaArena (grano «Registrado»,
// trama «Cambios sin guardar», contorno «Sin registrar») con la barra de
// 7 segmentos de lo respondido (las preguntas que cuenta el guardado; los
// comprobantes, VIII, se guardan solos y quedan fuera de la cuenta), y las
// ocho preguntas I a VIII entre hairlines. Si la carga del día falla, un
// ErrorSistema con «Reintentar» ocupa el formulario y el pie desaparece: una
// entrada que ya existe nunca se pisa con un formulario en blanco.
// INVERSIÓN única: el pie fijo «Registrar el día · hasta +N XP».
//
// Archivo: «ARCHIVO» y su contenido (Archivo.tsx), con su propia inversión
// («Escribir hoy») solo si el día de hoy falta.
//
// Un solo mecanismo de teclado: el KeyboardAvoidingView de la pantalla (plain)
// sube el pie fijo y encoge el scroll; el ScrollView no ajusta sus insets
// (con los dos, iOS suma el teclado dos veces). Los bloques con campos de
// texto no llevan Entrada: un campo con el foco no debe moverse al aparecer.
// En iPad la escritura se acota a 640 y el Archivo va a dos columnas.

import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import type { RefObject } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Barra,
  Campo,
  CargaArena,
  EncabezadoArena,
  Entrada,
  ErrorSistema,
  TarjetaArena,
  type VarianteArena,
} from '@/components/arena';
import { Button, Chip, Screen } from '@/components/ui';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { useSizeClass } from '@/design/useSizeClass';
import { addDays, nombreDia, relativoDe } from '@/lib/dates';
import type { Completitud, SeccionId } from '@/lib/journalmath';
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
  /** Fallo del último guardado, ya escrito para el usuario. */
  errorGuardado: string | null;
  /** Fallo al cargar el día, ya escrito para el usuario: sin formulario ni pie. */
  errorCarga: string | null;
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
    /** El Archivo no ha cargado (mensajeSistema). */
    error: string | null;
    reintentando: boolean;
    onReintentar: () => void;
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
    /** Vuelve a pedir el día tras un fallo de carga. */
    onReintentarCarga: () => void;
  };
}

const MOOD_LABELS = ['Hundido', 'Bajo', 'Normal', 'Bien', 'Imparable'];
const ENERGY_LABELS = ['Vacío', 'Poca', 'Normal', 'Alta', 'A tope'];
const ESCALA = [1, 2, 3, 4, 5];
/** La escritura no pasa de aquí, ni en iPad ni en la web. */
const ANCHO_ESCRITURA = 640;
const BOTON = 44;
const FOTO = 76;

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
        <Text style={styles.escalaNombre} maxFontSizeMultiplier={1.35}>
          {nombre}
        </Text>
        <Text style={styles.escalaTexto} maxFontSizeMultiplier={1.35}>
          {valor === null ? 'Sin puntuar' : etiquetas[valor - 1]}
        </Text>
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

/** El estado del día: si ya está escrito, si hay algo sin guardar y cuánto se ha respondido. */
function EstadoDia({
  registrado,
  sucio,
  enCaliente,
  xp,
  hechas,
  total,
}: {
  registrado: boolean;
  sucio: boolean;
  enCaliente: boolean;
  xp: number;
  hechas: number;
  total: number;
}) {
  const variante: VarianteArena = sucio ? 'trama' : registrado ? 'grano' : 'contorno';
  const rotulo = sucio ? 'Cambios sin guardar' : registrado ? 'Registrado' : 'Sin registrar';
  const linea = sucio
    ? 'Lo que has cambiado aún no está guardado.'
    : registrado
      ? 'Ya está en tu archivo. Puedes corregirlo cuando quieras.'
      : 'El cierre del día. Siete preguntas cortas; los comprobantes se guardan solos.';
  return (
    <TarjetaArena variante={variante} rotulo={rotulo} meta={enCaliente && !registrado ? `hasta +${xp} XP` : undefined}>
      <Barra
        ratio={total > 0 ? hechas / total : 0}
        alto={4}
        segmentos={total}
        etiqueta={`${hechas} de ${total} preguntas respondidas`}
      />
      <Text style={styles.respondidas} maxFontSizeMultiplier={1.35}>
        {hechas} de {total} respondidas
      </Text>
      <Text style={styles.estadoTexto} maxFontSizeMultiplier={1.6}>
        {linea}
      </Text>
    </TarjetaArena>
  );
}

export function DiarioVista({
  segmento,
  hoy,
  dia,
  cargado,
  registrado,
  sucio,
  ocupado,
  refrescando,
  aviso,
  errorGuardado,
  errorCarga,
  xp,
  pista,
  respuestas,
  hecho,
  reclamadas,
  cabenMas,
  fotos,
  cronica,
  archivo,
  scrollRef,
  acciones,
}: DiarioVistaProps) {
  const insets = useSafeAreaInsets();
  const { gutter } = useSizeClass();
  const { mood, energy, emotions, sleep, wins, text, lesson, gratitude, plan } = respuestas;
  const lista = (s: SeccionId) => hecho.porSeccion[s];
  const irADia = acciones.onIrADia;

  const enCaliente = dia === hoy || dia === addDays(hoy, -1);
  const esHoy = dia >= hoy;
  const escribiendo = segmento === 'escribir';
  // La barra cuenta lo mismo que el guardado (`completitud`): las siete
  // preguntas I a VII. Los comprobantes (VIII) se guardan solos al hacerlos y
  // no entran en la cuenta, aunque su numeral se marque si hay alguno.
  const total = hecho.total;
  const hechas = hecho.hechas;

  // La escritura se acota a 640; el Archivo usa la columna entera de la pantalla.
  const columna: ViewStyle = escribiendo
    ? { width: '100%', maxWidth: ANCHO_ESCRITURA + 2 * gutter, alignSelf: 'center' }
    : { width: '100%' };

  return (
    <Screen plain>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, columna, { paddingHorizontal: gutter }]}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={acciones.onRefrescar} tintColor={ink.ink10} />}
        >
          <Entrada indice={0}>
            {escribiendo ? (
              <EncabezadoArena
                onVolver={acciones.onVolver}
                eyebrow={`Mente · ${relativoDe(dia, hoy)}`}
                titulo="Diario"
                accion={{ icono: 'library-outline', etiqueta: 'Archivo', onPress: () => acciones.onSegmento('archivo') }}
              />
            ) : (
              <EncabezadoArena
                onVolver={acciones.onVolver}
                eyebrow="Mente · Archivo"
                titulo="Archivo"
                subtitulo="Lo que has vivido, día a día."
                accion={{ icono: 'create-outline', etiqueta: 'Escribir el día', onPress: () => acciones.onSegmento('escribir') }}
              />
            )}
          </Entrada>

          {!escribiendo ? (
            <Archivo
              loaded={archivo.cargado}
              hoy={hoy}
              entries={archivo.entries}
              recuerdos={archivo.recuerdos}
              photoCounts={archivo.photoCounts}
              loadPhotos={archivo.loadPhotos}
              error={archivo.error}
              reintentando={archivo.reintentando}
              onReintentar={archivo.onReintentar}
              onOpen={(date) => irADia(date, true)}
              onWriteToday={() => irADia(hoy, true)}
            />
          ) : (
            <>
              {/* El día que se escribe, con sus flechas: no siempre es hoy. */}
              <View style={styles.navDia}>
                <Pressable
                  onPress={() => irADia(addDays(dia, -1))}
                  style={({ pressed }) => [styles.navBoton, pressed && styles.pulsado]}
                  accessibilityRole="button"
                  accessibilityLabel="Día anterior"
                >
                  <Ionicons name="chevron-back" size={20} color={ink.ink9} />
                </Pressable>
                <Text style={styles.navFecha} numberOfLines={2} maxFontSizeMultiplier={1.35} accessibilityRole="text">
                  {nombreDia(dia)}
                </Text>
                <Pressable
                  onPress={() => irADia(dia < hoy ? addDays(dia, 1) : dia)}
                  disabled={esHoy}
                  style={({ pressed }) => [styles.navBoton, esHoy && styles.navOff, pressed && styles.pulsado]}
                  accessibilityRole="button"
                  accessibilityLabel="Día siguiente"
                  accessibilityState={{ disabled: esHoy }}
                >
                  <Ionicons name="chevron-forward" size={20} color={esHoy ? ink.ink4 : ink.ink9} />
                </Pressable>
              </View>

              {errorCarga ? (
                // Sin el día no hay formulario: guardar uno en blanco pisaría la entrada.
                <ErrorSistema mensaje={errorCarga} onReintentar={acciones.onReintentarCarga} />
              ) : !cargado ? (
                <CargaArena etiqueta="Cargando el día" formas={['tarjeta', 'rotulo', 'filas', 'rotulo', 'filas']} />
              ) : (
                // La clave remonta el formulario al cambiar de día: ninguna fila de
                // victorias ni foco se hereda del día anterior.
                <View key={dia}>
                  <Entrada indice={1}>
                    {/* Que se vea de un vistazo si ese día ya está escrito: el fallo era
                        entrar de nuevo y no saber si se había enviado. */}
                    <EstadoDia
                      registrado={registrado}
                      sucio={sucio}
                      enCaliente={enCaliente}
                      xp={xp}
                      hechas={hechas}
                      total={total}
                    />
                  </Entrada>

                  <Entrada indice={2}>
                    <Pregunta numeral="I" title="Cómo me sentí" hint="Dos notas y, sobre todo, un nombre." done={lista('sentir')} primera>
                      <Escala valor={mood} etiquetas={MOOD_LABELS} nombre="Ánimo" onChange={acciones.onMood} />
                      <Escala valor={energy} etiquetas={ENERGY_LABELS} nombre="Energía" onChange={acciones.onEnergy} />
                      <EmotionPicker value={emotions} onChange={acciones.onEmotions} />
                    </Pregunta>
                  </Entrada>

                  <Entrada indice={3}>
                    <Pregunta numeral="II" title="Cómo dormí" hint="El sueño es lo primero que mira el coach." done={lista('sueno')}>
                      <SleepStepper value={sleep} onChange={acciones.onSleep} />
                    </Pregunta>
                  </Entrada>

                  {/* De aquí abajo hay campos de texto: sin Entrada. */}
                  <Pregunta
                    numeral="III"
                    title="Qué logré"
                    hint="Victorias del día. Una por línea, por pequeña que sea."
                    done={lista('victorias')}
                  >
                    <WinsEditor value={wins} onChange={acciones.onWins} />
                    <Text style={styles.subrotulo} maxFontSizeMultiplier={1.35}>
                      Lo que registró el sistema
                    </Text>
                    <Cronica lineas={cronica} reclamadas={reclamadas} cabenMas={cabenMas} onReclamar={acciones.onReclamar} />
                  </Pregunta>

                  <Pregunta numeral="IV" title="Lo vivido" hint={pista} done={lista('vivido')}>
                    <Campo
                      etiqueta="En tus palabras"
                      value={text}
                      onChangeText={acciones.onText}
                      placeholder="Lo que pasó, tal como lo contarías."
                      multiline
                      scrollEnabled={false}
                      style={styles.largo}
                      accessibilityLabel="Lo vivido"
                    />
                  </Pregunta>

                  <Pregunta numeral="V" title="Qué aprendí" hint="Una lección. Lo que harías distinto." done={lista('leccion')}>
                    <Campo
                      etiqueta="La lección"
                      value={lesson}
                      onChangeText={acciones.onLesson}
                      placeholder="La próxima vez…"
                      multiline
                      scrollEnabled={false}
                      maxLength={600}
                      accessibilityLabel="Qué aprendí"
                    />
                  </Pregunta>

                  <Pregunta numeral="VI" title="Qué agradezco" hint="Una línea. Opcional, como todo." done={lista('gratitud')}>
                    <Campo
                      etiqueta="A quién o a qué"
                      value={gratitude}
                      onChangeText={acciones.onGratitude}
                      placeholder="Una línea"
                      maxLength={240}
                      returnKeyType="done"
                      accessibilityLabel="Qué agradezco"
                    />
                  </Pregunta>

                  <Pregunta
                    numeral="VII"
                    title="Mañana, lo primero"
                    hint="Una sola cosa, con hora si puedes. El plan entero lo escribe el coach."
                    done={lista('manana')}
                  >
                    <Campo
                      etiqueta="Lo primero"
                      value={plan}
                      onChangeText={acciones.onPlan}
                      placeholder="A las 8:00, …"
                      maxLength={240}
                      returnKeyType="done"
                      accessibilityLabel="Mañana, lo primero"
                    />
                  </Pregunta>

                  <Pregunta
                    numeral="VIII"
                    title="Comprobantes"
                    hint="Fotos hechas en el momento: la prueba de que cumples tus propias normas. Se guardan al hacerlas."
                    done={fotos.length > 0}
                  >
                    <View style={styles.fotos}>
                      {fotos.map((item) => (
                        <View key={item.photo.id} style={styles.fotoMarco}>
                          <Pressable
                            onLongPress={() => acciones.onQuitarFoto(item)}
                            style={({ pressed }) => pressed && styles.pulsado}
                            accessibilityRole="imagebutton"
                            accessibilityLabel="Comprobante del diario; mantén pulsado para eliminar"
                            // Lectores de pantalla: borrar sin depender de la pulsación larga.
                            accessibilityActions={[{ name: 'delete', label: 'Eliminar comprobante' }]}
                            onAccessibilityAction={(e) => {
                              if (e.nativeEvent.actionName === 'delete') acciones.onQuitarFoto(item);
                            }}
                          >
                            {item.url ? (
                              <Image source={{ uri: item.url }} style={styles.foto} contentFit="cover" />
                            ) : (
                              <View style={styles.foto} />
                            )}
                          </Pressable>
                          {Platform.OS === 'web' ? (
                            // En la web no hay pulsación larga fiable: una «x» con su blanco de 44.
                            <Pressable
                              onPress={() => acciones.onQuitarFoto(item)}
                              style={({ pressed }) => [styles.fotoQuitar, pressed && styles.pulsado]}
                              accessibilityRole="button"
                              accessibilityLabel="Eliminar comprobante"
                            >
                              <View style={styles.fotoQuitarMarca}>
                                <Ionicons name="close" size={14} color={ink.ink10} />
                              </View>
                            </Pressable>
                          ) : null}
                        </View>
                      ))}
                      <Pressable
                        onPress={acciones.onAnadirFoto}
                        style={({ pressed }) => [styles.foto, styles.fotoNueva, pressed && styles.pulsado]}
                        accessibilityRole="button"
                        accessibilityLabel="Añadir foto comprobante con la cámara"
                      >
                        <Ionicons name="camera-outline" size={22} color={ink.ink9} />
                      </Pressable>
                    </View>
                    {fotos.length > 0 ? (
                      <Text style={styles.nota} maxFontSizeMultiplier={1.6}>
                        {Platform.OS === 'web'
                          ? 'Toca la x de una foto para eliminarla.'
                          : 'Mantén pulsada una foto para eliminarla.'}
                      </Text>
                    ) : null}
                  </Pregunta>
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* Pie fijo: registrar siempre a mano, sin bajar ocho preguntas. La
            única inversión de la escritura. */}
        {escribiendo && cargado && !errorCarga ? (
          <View style={[styles.pie, { paddingBottom: space.s3 + insets.bottom }]}>
            <View style={[styles.pieDentro, { maxWidth: ANCHO_ESCRITURA + 2 * gutter, paddingHorizontal: gutter }]}>
              {errorGuardado ? (
                <ErrorSistema compacto rotulo="No se ha guardado" mensaje={errorGuardado} style={styles.pieAviso} />
              ) : aviso ? (
                <Text style={[styles.aviso, styles.pieAviso]} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
                  {aviso}
                </Text>
              ) : sucio ? (
                <Text style={[styles.aviso, styles.pieAviso]} maxFontSizeMultiplier={1.6}>
                  Hay cambios sin guardar.
                </Text>
              ) : null}
              <Button
                title={registrado ? 'Guardar cambios' : enCaliente ? `Registrar el día · hasta +${xp} XP` : 'Registrar el día'}
                onPress={acciones.onGuardar}
                loading={ocupado}
                size="lg"
                icon={registrado ? 'save-outline' : 'checkmark'}
              />
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingTop: space.s2, paddingBottom: space.s10 },
  navDia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    marginBottom: space.s6,
    paddingVertical: space.s2,
    borderTopWidth: stroke.hairline,
    borderBottomWidth: stroke.hairline,
    borderColor: ink.ink3,
  },
  navBoton: {
    width: BOTON,
    height: BOTON,
    borderWidth: stroke.hairline,
    borderColor: ink.ink4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navOff: { borderColor: ink.ink3 },
  navFecha: {
    flex: 1,
    textAlign: 'center',
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    lineHeight: tipo.inscripcion.lineHeight,
    letterSpacing: tipo.inscripcion.tracking,
    textTransform: 'uppercase',
    color: ink.ink9,
  },
  pulsado: { opacity: 0.7 },
  respondidas: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    textTransform: 'uppercase',
    color: ink.ink8,
    marginTop: space.s2,
  },
  estadoTexto: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    marginTop: space.s3,
  },
  escalaBloque: { marginBottom: space.s4 },
  escalaCabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: space.s2 },
  escalaNombre: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
  escalaTexto: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, color: ink.ink9 },
  escala: { flexDirection: 'row', gap: space.s2 },
  escalaChip: { flex: 1, justifyContent: 'center', paddingHorizontal: 0, minHeight: BOTON },
  subrotulo: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
    marginTop: space.s5,
    marginBottom: space.s2,
  },
  largo: { minHeight: 130 },
  fotos: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
  foto: { width: FOTO, height: FOTO, backgroundColor: ink.ink2, borderWidth: stroke.hairline, borderColor: ink.ink4 },
  fotoMarco: { position: 'relative' },
  // El blanco de 44 sobresale por la esquina; la marca visible es pequeña.
  fotoQuitar: {
    position: 'absolute',
    top: -space.s2,
    right: -space.s2,
    width: BOTON,
    height: BOTON,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  fotoQuitarMarca: {
    width: 22,
    height: 22,
    marginTop: space.s2,
    marginRight: space.s2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ink.ink0,
    borderWidth: stroke.hairline,
    borderColor: ink.ink6,
  },
  fotoNueva: { backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  nota: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
    marginTop: space.s2,
  },
  pie: {
    paddingTop: space.s3,
    borderTopWidth: stroke.hairline,
    borderTopColor: ink.ink3,
    backgroundColor: ink.ink0,
  },
  pieDentro: { width: '100%', alignSelf: 'center' },
  pieAviso: { marginBottom: space.s3 },
  aviso: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink8 },
});

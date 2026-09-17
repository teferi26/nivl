import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { TextoSistema } from '@/components/TextoSistema';
import { Chip, ChipRow, FadeIn, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import {
  describeAction,
  fetchMainThread,
  fetchMessages,
  isToolResultOnly,
  messageActions,
  messageText,
  streamCoach,
  type CoachAction,
} from '@/lib/coach';
import { colors, fonts } from '@/lib/theme';

interface Burbuja {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  acciones: string[];
}

// Atajos a los rituales: lo que el coach anterior hacía por cadena programada.
const ATAJOS: { etiqueta: string; mensaje: string; icono: keyof typeof Ionicons.glyphMap }[] = [
  { etiqueta: 'Planifica mi día', mensaje: 'Planifica el resto de mi día de hoy.', icono: 'list-outline' },
  { etiqueta: 'Reporte', mensaje: 'Voy a reportar. Pregúntame lo que necesites saber de hoy.', icono: 'clipboard-outline' },
  { etiqueta: 'Dojo de ventas', mensaje: 'Entréname 15 minutos de ventas. Empieza con una objeción real.', icono: 'flash-outline' },
  { etiqueta: 'Revísame', mensaje: 'Haz la revisión de mis últimos 14 días con honestidad brutal.', icono: 'analytics-outline' },
];

/** Mensaje del coach: sin burbuja, con una marca a la izquierda y el texto en editorial. */
function MensajeSistema({ texto, acciones, pensando }: { texto?: string; acciones: { texto: string; ok: boolean }[]; pensando?: boolean }) {
  return (
    <View style={styles.filaSistema}>
      <View style={styles.marcaSistema}>
        <Ionicons name="shield-half" size={12} color={colors.bg} />
      </View>
      <View style={styles.cuerpoSistema}>
        {pensando && !texto ? (
          <View style={styles.pensandoFila}>
            <ActivityIndicator size="small" color={colors.textDim} />
            <Text style={styles.pensando}>El sistema piensa</Text>
          </View>
        ) : null}
        {texto ? <TextoSistema texto={texto} /> : null}
        {acciones.length > 0 ? (
          <View style={styles.acciones}>
            {acciones.map((a, i) => (
              <View key={i} style={styles.accion}>
                <Ionicons
                  name={a.ok ? 'checkmark-circle' : 'alert-circle'}
                  size={13}
                  color={a.ok ? colors.accentText : colors.red}
                />
                <Text style={styles.accionTexto}>{a.texto}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function CoachScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const enviando = useRef(false);
  // Fotos adjuntas al turno en curso. Viven solo hasta que se envía: no se
  // guardan en el hilo, porque meter base64 en el historial lo haría crecer
  // megabytes y se reenviaría entero en cada turno siguiente.
  const [adjuntas, setAdjuntas] = useState<{ media_type: string; data: string }[]>([]);

  const [threadId, setThreadId] = useState<string | null>(null);
  const [burbujas, setBurbujas] = useState<Burbuja[]>([]);
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(true);
  const [pensando, setPensando] = useState(false);
  const [enCurso, setEnCurso] = useState('');
  const [acciones, setAcciones] = useState<CoachAction[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const hilo = await fetchMainThread();
      if (!hilo) {
        setBurbujas([]);
        setCargando(false);
        return;
      }
      setThreadId(hilo.id);
      const mensajes = await fetchMessages(hilo.id);
      setBurbujas(
        mensajes
          .filter((m) => !isToolResultOnly(m))
          .map((m) => ({
            id: m.id,
            role: m.role,
            text: messageText(m),
            acciones: messageActions(m),
          }))
          .filter((b) => b.text || b.acciones.length),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir la conversación.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (session) cargar();
  }, [session, cargar]);

  const alFondo = () => requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

  const adjuntar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('El sistema necesita permiso para leer tus fotos.');
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // Calidad baja a propósito: una foto de móvil sin comprimir son varios
      // megas de base64, y eso se paga como miles de fichas en cada turno.
      quality: 0.35,
      base64: true,
      selectionLimit: 3,
      allowsMultipleSelection: true,
    });
    if (r.canceled) return;
    setAdjuntas(
      r.assets
        .filter((a) => a.base64)
        .map((a) => ({ media_type: a.mimeType ?? 'image/jpeg', data: a.base64! })),
    );
  };

  const enviar = async (mensaje: string) => {
    const limpio = mensaje.trim();
    // Cerrojo: sin él, un doble toque manda el turno dos veces y el coach
    // acaba respondiéndose a sí mismo.
    if ((!limpio && !adjuntas.length) || enviando.current) return;
    enviando.current = true;
    setError(null);
    setTexto('');
    setAcciones([]);
    setEnCurso('');
    const fotos = adjuntas;
    setAdjuntas([]);
    setBurbujas((b) => [
      ...b,
      {
        id: `local-${Date.now()}`,
        role: 'user',
        text: fotos.length ? `[${fotos.length} foto(s)]\n${limpio}` : limpio,
        acciones: [],
      },
    ]);
    alFondo();

    let acumulado = '';
    const ejecutadas: CoachAction[] = [];
    try {
      await streamCoach({
        message: limpio || 'Mira esta foto.',
        threadId: threadId ?? undefined,
        imagenes: fotos.length ? fotos : undefined,
        onEvent: (e) => {
          switch (e.type) {
            case 'start':
              setThreadId(e.threadId);
              break;
            case 'thinking':
              setPensando(true);
              break;
            case 'text':
              setPensando(false);
              acumulado += e.delta;
              setEnCurso(acumulado);
              alFondo();
              break;
            case 'tool':
              ejecutadas.push(e.action);
              setAcciones([...ejecutadas]);
              alFondo();
              break;
            case 'done':
              setBurbujas((b) => [
                ...b,
                {
                  id: `done-${Date.now()}`,
                  role: 'assistant',
                  text: e.text || acumulado,
                  acciones: ejecutadas.map((a) => describeAction(a.name)),
                },
              ]);
              setEnCurso('');
              setAcciones([]);
              alFondo();
              break;
            case 'error':
              setError(e.message);
              break;
          }
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'El sistema no responde.');
      setEnCurso('');
    } finally {
      setPensando(false);
      enviando.current = false;
    }
  };

  if (cargando) {
    return (
      <Screen plain>
        <View style={styles.centro}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }

  const vacio = !burbujas.length && !enCurso;
  const puedeEnviar = (!!texto.trim() || adjuntas.length > 0) && !enviando.current;

  return (
    <Screen plain>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>EL SISTEMA</Text>
          <Text style={styles.titulo}>Coach</Text>
        </View>
        <Pressable
          onPress={() => router.push('/memoria')}
          style={({ pressed }) => [styles.memoria, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel="Ver la memoria del sistema"
          hitSlop={8}
        >
          <Ionicons name="library-outline" size={18} color={colors.text} />
          <Text style={styles.memoriaTexto}>Memoria</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          automaticallyAdjustKeyboardInsets
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.lista}
          onContentSizeChange={alFondo}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {vacio ? (
            <FadeIn>
              <View style={styles.vacio}>
                <View style={styles.vacioEmblema}>
                  <Ionicons name="shield-half" size={26} color={colors.bg} />
                </View>
                <Text style={styles.vacioTitulo}>El sistema te escucha.</Text>
                <Text style={styles.vacioTexto}>
                  Manda en tu día, decide qué puntúa cada cosa, te juzga por la noche y recuerda todo lo que
                  aprende de ti. Habla con él como hablarías con quien lleva tu vida.
                </Text>
              </View>
            </FadeIn>
          ) : null}

          {burbujas.map((b) =>
            b.role === 'user' ? (
              <View key={b.id} style={styles.filaUsuario}>
                <View style={styles.burbujaUsuario}>
                  <Text style={styles.textoUsuario}>{b.text}</Text>
                </View>
              </View>
            ) : (
              <MensajeSistema key={b.id} texto={b.text} acciones={b.acciones.map((texto) => ({ texto, ok: true }))} />
            ),
          )}

          {enCurso || pensando || acciones.length ? (
            <MensajeSistema
              texto={enCurso}
              pensando={pensando}
              acciones={acciones.map((a) => ({ texto: describeAction(a.name), ok: a.ok }))}
            />
          ) : null}

          {error ? (
            <View style={styles.error}>
              <Ionicons name="alert-circle-outline" size={14} color={colors.red} />
              <Text style={styles.errorTexto}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>

        {vacio ? (
          <View style={styles.atajos}>
            <ChipRow>
              {ATAJOS.map((a) => (
                <Chip key={a.etiqueta} label={a.etiqueta} icon={a.icono} onPress={() => enviar(a.mensaje)} />
              ))}
            </ChipRow>
          </View>
        ) : null}

        {adjuntas.length ? (
          <View style={styles.adjuntas}>
            <Ionicons name="image-outline" size={14} color={colors.accentText} />
            <Text style={styles.adjuntasTexto}>{adjuntas.length} foto(s) listas para enviar</Text>
            <Pressable onPress={() => setAdjuntas([])} hitSlop={8} accessibilityRole="button" accessibilityLabel="Quitar las fotos">
              <Ionicons name="close" size={16} color={colors.textDim} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.barra}>
          <Pressable
            onPress={adjuntar}
            disabled={enviando.current}
            style={({ pressed }) => [styles.adjuntar, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel="Adjuntar una foto"
          >
            <Ionicons name="add" size={22} color={colors.textDim} />
          </Pressable>
          <TextInput
            style={styles.input}
            value={texto}
            onChangeText={setTexto}
            placeholder="Habla con el sistema"
            placeholderTextColor={colors.textFaint}
            multiline
            accessibilityLabel="Mensaje para el sistema"
          />
          <Pressable
            onPress={() => enviar(texto)}
            disabled={!puedeEnviar}
            style={({ pressed }) => [styles.enviar, !puedeEnviar && styles.enviarOff, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
            accessibilityLabel="Enviar mensaje"
          >
            <Ionicons name="arrow-up" size={20} color={colors.bg} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  eyebrow: { fontFamily: fonts.heading, fontSize: 10.5, letterSpacing: 2.5, color: colors.textFaint },
  titulo: { fontFamily: fonts.heading, fontSize: 24, letterSpacing: -0.5, color: colors.text, marginTop: 2 },
  memoria: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.line },
  memoriaTexto: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text },
  lista: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  filaUsuario: { alignItems: 'flex-end', marginBottom: 16 },
  burbujaUsuario: {
    maxWidth: '84%',
    backgroundColor: colors.accent,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  textoUsuario: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.bg },
  filaSistema: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  marcaSistema: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  cuerpoSistema: { flex: 1, minWidth: 0 },
  pensandoFila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pensando: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim },
  acciones: { marginTop: 8, borderLeftWidth: 1, borderLeftColor: colors.line, paddingLeft: 10, gap: 4 },
  accion: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  accionTexto: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textDim, flexShrink: 1 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, borderLeftWidth: 2, borderLeftColor: colors.red, paddingLeft: 10, paddingVertical: 6 },
  errorTexto: { fontFamily: fonts.body, fontSize: 13, color: colors.red, flex: 1 },
  vacio: { alignItems: 'center', paddingTop: 48, paddingBottom: 24, paddingHorizontal: 12 },
  vacioEmblema: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  vacioTitulo: { fontFamily: fonts.heading, fontSize: 22, letterSpacing: -0.4, color: colors.text, marginTop: 18 },
  vacioTexto: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.textDim, textAlign: 'center', marginTop: 8 },
  atajos: { paddingBottom: 10 },
  barra: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 130,
    backgroundColor: colors.panel,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 13,
  },
  enviar: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  enviarOff: { opacity: 0.35 },
  adjuntar: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
  },
  adjuntas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  adjuntasTexto: { fontFamily: fonts.body, fontSize: 12, color: colors.accentText, flex: 1 },
});

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
import { SafeAreaView } from 'react-native-safe-area-context';
import { SystemWindow } from '@/components/SystemWindow';
import { TextoSistema } from '@/components/TextoSistema';
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
const ATAJOS: { etiqueta: string; mensaje: string }[] = [
  { etiqueta: 'Planifica mi día', mensaje: 'Planifica el resto de mi día de hoy.' },
  { etiqueta: 'Reporte', mensaje: 'Voy a reportar. Pregúntame lo que necesites saber de hoy.' },
  { etiqueta: 'Dojo de ventas', mensaje: 'Entréname 15 minutos de ventas. Empieza con una objeción real.' },
  { etiqueta: 'Revísame', mensaje: 'Haz la revisión de mis últimos 14 días con honestidad brutal.' },
];

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
        text: fotos.length ? `[${fotos.length} foto(s)]
${limpio}` : limpio,
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
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.centro}>
          <ActivityIndicator color={colors.cyan} />
        </View>
      </SafeAreaView>
    );
  }

  const vacio = !burbujas.length && !enCurso;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.titulo}>EL SISTEMA</Text>
        <Pressable
          onPress={() => router.push('/memoria')}
          accessibilityRole="button"
          accessibilityLabel="Ver la memoria del sistema"
          hitSlop={10}
        >
          <Ionicons name="library-outline" size={20} color={colors.cyanText} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView automaticallyAdjustKeyboardInsets
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.lista}
          onContentSizeChange={alFondo}
          keyboardShouldPersistTaps="handled"
        >
          {vacio ? (
            <SystemWindow>
              <Text style={styles.vacioTitulo}>El sistema te escucha</Text>
              <Text style={styles.vacioTexto}>
                Conserva la memoria de tu coach anterior: tus objetivos, tus proyectos, tus reglas y
                lo que ha aprendido de ti. Habla con él como hablarías con quien lleva tu vida.
              </Text>
            </SystemWindow>
          ) : null}

          {burbujas.map((b) => (
            <View key={b.id} style={b.role === 'user' ? styles.filaUsuario : styles.filaSistema}>
              {b.role === 'user' ? (
                <View style={styles.burbujaUsuario}>
                  <Text style={styles.textoUsuario}>{b.text}</Text>
                </View>
              ) : (
                <SystemWindow style={styles.burbujaSistema}>
                  {b.text ? <TextoSistema texto={b.text} /> : null}
                  {b.acciones.map((a, i) => (
                    <View key={i} style={styles.accion}>
                      <Ionicons name="checkmark-circle-outline" size={13} color={colors.cyan} />
                      <Text style={styles.accionTexto}>{a}</Text>
                    </View>
                  ))}
                </SystemWindow>
              )}
            </View>
          ))}

          {enCurso || pensando || acciones.length ? (
            <View style={styles.filaSistema}>
              <SystemWindow style={styles.burbujaSistema}>
                {pensando && !enCurso ? (
                  <Text style={styles.pensando}>El sistema está pensando</Text>
                ) : null}
                {enCurso ? <TextoSistema texto={enCurso} /> : null}
                {acciones.map((a, i) => (
                  <View key={i} style={styles.accion}>
                    <Ionicons
                      name={a.ok ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                      size={13}
                      color={a.ok ? colors.cyan : colors.red}
                    />
                    <Text style={styles.accionTexto}>{describeAction(a.name)}</Text>
                  </View>
                ))}
              </SystemWindow>
            </View>
          ) : null}

          {error ? (
            <SystemWindow color={colors.redDim} fill={colors.redPanel}>
              <Text style={styles.error}>{error}</Text>
            </SystemWindow>
          ) : null}
        </ScrollView>

        {vacio ? (
          <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.atajos}
          >
            {ATAJOS.map((a) => (
              <Pressable
                key={a.etiqueta}
                onPress={() => enviar(a.mensaje)}
                style={styles.atajo}
                accessibilityRole="button"
                accessibilityLabel={a.etiqueta}
              >
                <Text style={styles.atajoTexto}>{a.etiqueta}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {adjuntas.length ? (
          <View style={styles.adjuntas}>
            <Ionicons name="image-outline" size={14} color={colors.cyanText} />
            <Text style={styles.adjuntasTexto}>
              {adjuntas.length} foto(s) listas para enviar
            </Text>
            <Pressable
              onPress={() => setAdjuntas([])}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Quitar las fotos"
            >
              <Ionicons name="close" size={16} color={colors.textDim} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.barra}>
          <Pressable
            onPress={adjuntar}
            disabled={enviando.current}
            style={styles.adjuntar}
            accessibilityRole="button"
            accessibilityLabel="Adjuntar una foto"
          >
            <Ionicons name="add" size={22} color={colors.cyanText} />
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
            disabled={(!texto.trim() && !adjuntas.length) || enviando.current}
            style={[
              styles.enviar,
              (!texto.trim() && !adjuntas.length) || enviando.current ? styles.enviarOff : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Enviar mensaje"
          >
            <Ionicons name="arrow-up" size={20} color={colors.bg} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  titulo: {
    fontFamily: fonts.heading,
    fontSize: 16,
    letterSpacing: 4,
    color: colors.text,
  },
  lista: { paddingHorizontal: 16, paddingBottom: 12 },
  filaUsuario: { alignItems: 'flex-end', marginBottom: 12 },
  filaSistema: { alignItems: 'stretch' },
  burbujaSistema: { marginBottom: 12 },
  burbujaUsuario: {
    maxWidth: '86%',
    backgroundColor: colors.cyanFaint,
    borderWidth: 1,
    borderColor: colors.cyanDim,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  textoUsuario: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  textoSistema: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
  pensando: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textDim,
    fontStyle: 'italic',
  },
  accion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  accionTexto: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.cyanText,
    flexShrink: 1,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.red,
  },
  vacioTitulo: {
    fontFamily: fonts.heading,
    fontSize: 15,
    letterSpacing: 2,
    color: colors.cyanText,
    marginBottom: 8,
  },
  vacioTexto: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textDim,
  },
  atajos: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  atajo: {
    borderWidth: 1,
    borderColor: colors.cyanDim,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  atajoTexto: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.cyanText,
  },
  barra: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.tabBar,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 130,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingTop: 11,
    paddingBottom: 11,
  },
  enviar: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cyan,
  },
  enviarOff: { opacity: 0.4 },
  adjuntar: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderColor: colors.cyanFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjuntas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  adjuntasTexto: { fontFamily: fonts.body, fontSize: 12, color: colors.cyanText, flex: 1 },
});

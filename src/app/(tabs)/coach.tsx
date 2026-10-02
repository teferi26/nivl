import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
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
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
import { useConsentimientoIA } from '@/components/ConsentimientoIA';
import { DenunciarIA, type RespuestaDenunciada } from '@/components/DenunciarIA';
import { HealthConsentGuard } from '@/components/ConsentimientoSalud';
import { SystemButton } from '@/components/SystemButton';
import { TextoSistema } from '@/components/TextoSistema';
import { Chip, ChipRow, FadeIn, Screen, Skeleton, Tag } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import {
  accessNotice,
  CoachAccessError,
  describeAction,
  fetchMainThread,
  fetchMessages,
  isToolResultOnly,
  messageActions,
  messageText,
  streamCoach,
  type CoachAction,
  type CoachMode,
} from '@/lib/coach';
import { DESCARGO_SALUD, LINEA_CRISIS, olvidarConsentimiento } from '@/lib/consent';
import { ensureProfile } from '@/lib/data';
import { isValidKey, nombreDia } from '@/lib/dates';
import {
  energiaAgotada,
  fetchAiStatus,
  isPro,
  lineaProfundos,
  proSampleBrief,
  proToday,
  puedeProfundo,
  SIN_IA,
  type AiStatus,
} from '@/lib/pro';
import { colors, fonts } from '@/lib/theme';
import { mensajeSistema } from '@/lib/validation';

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
function MensajeSistema({
  texto,
  acciones,
  pensando,
  onDenunciar,
}: {
  texto?: string;
  acciones: { texto: string; ok: boolean }[];
  pensando?: boolean;
  onDenunciar?: () => void;
}) {
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
        {onDenunciar && texto ? (
          <Pressable
            onPress={onDenunciar}
            hitSlop={8}
            style={styles.denunciar}
            accessibilityRole="button"
            accessibilityLabel="Denunciar respuesta"
          >
            <Ionicons name="flag-outline" size={12} color={colors.textFaint} />
            <Text style={styles.denunciarTexto}>Denunciar respuesta</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// Los ids que vienen del servidor son uuid; los de burbujas recién llegadas
// por el stream son locales y no identifican nada en el servidor.
const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * La pestaña de una cuenta sin NIVL Pro. No es un error ni un muro en blanco:
 * enseña lo que el coach estaría haciendo hoy por este perfil y el camino a
 * Pro. El resto de la app no se toca.
 */
function CoachBloqueado({ kind, onPro }: { kind: unknown; onPro: () => void }) {
  return (
    <FadeIn>
      <View style={styles.bloqueado}>
        <View style={styles.bloqueadoEmblema}>
          <Ionicons name="lock-closed-outline" size={24} color={colors.text} />
        </View>
        <Text style={styles.vacioTitulo}>El coach es parte de NIVL Pro.</Text>
        <Text style={styles.vacioTexto}>
          Tus misiones, tu racha, tus campañas y todos los módulos siguen siendo tuyos. Lo que falta es quien lo
          dirige.
        </Text>
        <View style={styles.hoy}>
          <Text style={styles.hoyRotulo}>HOY ESTARÍA</Text>
          {proToday(kind).map((linea, i) => (
            <View key={linea} style={[styles.hoyFila, i > 0 && styles.hoyFilaSep]}>
              <Ionicons name="remove-outline" size={14} color={colors.accentDim} style={styles.hoyIcono} />
              <Text style={styles.hoyTexto}>{linea}</Text>
            </View>
          ))}
        </View>
        {/* Cómo suena un brief de verdad. Es una muestra y se dice: nada aquí
            sale de los datos de esta cuenta. */}
        <View style={styles.muestra} accessible accessibilityLabel={`Ejemplo de brief del coach. ${proSampleBrief(kind).join(' ')}`}>
          <View style={styles.muestraCabecera}>
            <Text style={styles.hoyRotulo}>UN BRIEF SUYO</Text>
            <Tag>Ejemplo</Tag>
          </View>
          {proSampleBrief(kind).map((linea) => (
            <Text key={linea} style={styles.muestraLinea}>
              {linea}
            </Text>
          ))}
        </View>
        <SystemButton title="Ver NIVL Pro" onPress={onPro} style={styles.bloqueadoBoton} />
      </View>
    </FadeIn>
  );
}

export default function CoachScreen() {
  return <HealthConsentGuard routeName="coach"><CoachContent /></HealthConsentGuard>;
}

function CoachContent() {
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
  const [denuncia, setDenuncia] = useState<RespuestaDenunciada | null>(null);
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(true);
  const [pensando, setPensando] = useState(false);
  const [enCurso, setEnCurso] = useState('');
  const [acciones, setAcciones] = useState<CoachAction[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Aviso sereno (energía agotada, turno en curso): no es un fallo, no va en rojo.
  const [aviso, setAviso] = useState<string | null>(null);
  // Estado de la IA de la cuenta. null = aún no se sabe (o no hay red): se deja
  // escribir y, si no hay derecho, el 402 del servidor cierra la puerta igual.
  const [estado, setEstado] = useState<AiStatus | null>(null);
  // Hasta la primera respuesta (o su fallo) no se pinta nada: si no, una cuenta
  // gratuita vería un instante el chat abierto antes del estado bloqueado.
  const [estadoListo, setEstadoListo] = useState(false);
  const [kind, setKind] = useState<unknown>('general');
  // Potencia del próximo turno (solo Élite). Vuelve sola a estándar tras cada
  // turno profundo: que el mes no se queme por despiste.
  const [modo, setModo] = useState<CoachMode>('estandar');
  const userId = session?.user.id;
  // Antes del primer turno, el consentimiento para la IA (0028). El servidor
  // lo vuelve a exigir: sin él responde 403 y aquí se abre la hoja.
  const consentimiento = useConsentimientoIA();

  const releerEstado = useCallback(
    () =>
      fetchAiStatus()
        .then((s) => {
          setEstado(s);
          if (isPro(s) && !energiaAgotada(s)) setAviso(null);
        })
        .catch(() => {}),
    [],
  );

  // Se relee al volver a la pestaña: quien viene de /pro recién suscrito tiene
  // que encontrarse el chat abierto, no el candado de hace un minuto.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      releerEstado().finally(() => setEstadoListo(true));
      ensureProfile(userId)
        .then((p) => setKind(p.profile_kind))
        .catch(() => {});
    }, [userId, releerEstado]),
  );

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
      setError(mensajeSistema(e));
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
    if (!(await consentimiento.asegurar())) {
      enviando.current = false;
      return;
    }
    setError(null);
    setAviso(null);
    setTexto('');
    setAcciones([]);
    setEnCurso('');
    const fotos = adjuntas;
    setAdjuntas([]);
    const localId = `local-${Date.now()}`;
    setBurbujas((b) => [
      ...b,
      {
        id: localId,
        role: 'user',
        text: fotos.length ? `[${fotos.length} ${fotos.length === 1 ? 'foto' : 'fotos'}]\n${limpio}` : limpio,
        acciones: [],
      },
    ]);
    alFondo();

    let acumulado = '';
    const ejecutadas: CoachAction[] = [];
    // Profundo solo si el bolsillo lo permite AHORA: un estado viejo no manda
    // un turno caro que el servidor rechazaría.
    const modoTurno: CoachMode = modo === 'profundo' && puedeProfundo(estado) ? 'profundo' : 'estandar';
    try {
      await streamCoach({
        mode: modoTurno,
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
              setError(mensajeSistema(e));
              break;
          }
        },
      });
    } catch (e) {
      if (e instanceof CoachAccessError) {
        // El candado ha dicho que no: el mensaje no se ha enviado. Se devuelve
        // al cuadro de texto en vez de dejarlo colgado como si esperase
        // respuesta, y se explica sin alarma.
        setBurbujas((b) => b.filter((x) => x.id !== localId));
        setTexto(limpio);
        if (e.reason === 'sin_suscripcion') {
          setEstado(SIN_IA);
        } else if (e.reason === 'sin_consentimiento') {
          // El servidor no lo tiene (retirado en otro dispositivo, versión
          // nueva del texto): se vuelve a preguntar, sin alarma.
          olvidarConsentimiento();
          consentimiento.pedir();
        } else {
          setAviso(accessNotice(e));
        }
      } else {
        setError(mensajeSistema(e));
        // Si el coach no llegó a contestar nada, el mensaje no ha cuajado: se
        // devuelve al cuadro (con sus fotos) para reintentar sin reescribirlo.
        if (!acumulado && !ejecutadas.length) {
          setBurbujas((b) => b.filter((x) => x.id !== localId));
          setTexto(limpio);
          setAdjuntas(fotos);
        }
      }
      setEnCurso('');
    } finally {
      setPensando(false);
      enviando.current = false;
      // Tras un turno profundo (o su negativa), de vuelta a estándar y con los
      // turnos que quedan releídos del servidor.
      if (modoTurno === 'profundo') {
        setModo('estandar');
        releerEstado();
      }
    }
  };

  // En la web, Intro envía y Mayús+Intro hace salto de línea, como en
  // cualquier chat de escritorio. En el móvil el teclado no cambia.
  const alTeclear = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (Platform.OS !== 'web') return;
    const nativo = e.nativeEvent as TextInputKeyPressEventData & { shiftKey?: boolean; isComposing?: boolean };
    if (nativo.key !== 'Enter' || nativo.shiftKey || nativo.isComposing) return;
    e.preventDefault();
    if (puedeEnviar) enviar(texto);
  };

  const elegirModo = (m: CoachMode) => {
    if (m === modo) return;
    Haptics.selectionAsync().catch(() => {});
    setModo(m);
  };

  if (cargando || !estadoListo) {
    // La cabecera ya, y el cuerpo en hueco: un spinner solo en mitad del negro
    // no decía ni en qué pantalla se estaba.
    return (
      <Screen plain>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>EL SISTEMA</Text>
            <Text style={styles.titulo}>Coach</Text>
          </View>
        </View>
        <View style={styles.cargandoCuerpo} accessibilityRole="progressbar" accessibilityLabel="Cargando el coach">
          <Skeleton height={14} width="64%" />
          <Skeleton height={14} width="88%" style={styles.cargandoLinea} />
          <Skeleton height={14} width="46%" style={styles.cargandoLinea} />
          <Skeleton height={88} style={styles.cargandoBloque} />
          <Skeleton height={14} width="72%" style={styles.cargandoBloque} />
          <Skeleton height={14} width="54%" style={styles.cargandoLinea} />
        </View>
      </Screen>
    );
  }

  const vacio = !burbujas.length && !enCurso;
  // Solo con certeza: mientras `estado` sea null no se bloquea a nadie.
  const sinPro = estado !== null && !isPro(estado);
  const recarga = estado?.renews && isValidKey(estado.renews) ? nombreDia(estado.renews).toLowerCase() : null;
  const avisoEnergia =
    aviso ??
    (energiaAgotada(estado)
      ? `La energía del coach de este mes se ha agotado. ${recarga ? `Se recarga el ${recarga}.` : 'Se recarga el día 1.'}`
      : null);
  const puedeEnviar = (!!texto.trim() || adjuntas.length > 0) && !enviando.current;
  // El selector de potencia solo existe si el plan incluye el modo profundo.
  const conPotencia = !sinPro && !!estado?.deepAllowed;
  const profundoAbierto = puedeProfundo(estado);
  const modoVisible: CoachMode = modo === 'profundo' && profundoAbierto ? 'profundo' : 'estandar';

  return (
    <Screen plain>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>EL SISTEMA</Text>
          <Text style={styles.titulo}>Coach</Text>
        </View>
        <View style={styles.headerAcciones}>
          {/* La puerta a /pro para todos: la oferta si no hay coach, y el plan
              y la energía del mes si lo hay. */}
          <Pressable
            onPress={() => router.push('/pro')}
            style={({ pressed }) => [styles.memoria, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel={sinPro ? 'Ver NIVL Pro' : 'Ver tu plan y la energía del coach'}
            hitSlop={8}
          >
            <Ionicons name="flash-outline" size={16} color={colors.text} />
            <Text style={styles.memoriaTexto}>Pro</Text>
          </Pressable>
          {/* La memoria es del coach: sin Pro no ha aprendido nada que
              enseñar. Vuelve en cuanto la cuenta tiene coach. */}
          {sinPro ? null : (
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
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.lista}
          onContentSizeChange={alFondo}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {vacio && sinPro ? <CoachBloqueado kind={kind} onPro={() => router.push('/pro')} /> : null}

          {vacio && !sinPro ? (
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
                <Text style={styles.vacioDescargo}>
                  {DESCARGO_SALUD} {LINEA_CRISIS}
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
              <MensajeSistema
                key={b.id}
                texto={b.text}
                acciones={b.acciones.map((texto) => ({ texto, ok: true }))}
                onDenunciar={() =>
                  setDenuncia({ fuente: 'coach', messageId: ES_UUID.test(b.id) ? b.id : null, texto: b.text })
                }
              />
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

        {vacio && !sinPro ? (
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
            <Text style={styles.adjuntasTexto}>
              {adjuntas.length === 1 ? '1 foto lista para enviar' : `${adjuntas.length} fotos listas para enviar`}
            </Text>
            <Pressable onPress={() => setAdjuntas([])} hitSlop={8} accessibilityRole="button" accessibilityLabel="Quitar las fotos">
              <Ionicons name="close" size={16} color={colors.textDim} />
            </Pressable>
          </View>
        ) : null}

        {avisoEnergia && !sinPro ? (
          <Pressable
            onPress={() => router.push('/pro')}
            style={({ pressed }) => [styles.aviso, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel={`${avisoEnergia} Ver la energía del coach`}
          >
            <Ionicons name="hourglass-outline" size={14} color={colors.accentText} />
            <Text style={styles.avisoTexto}>{avisoEnergia}</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.textFaint} />
          </Pressable>
        ) : null}

        {conPotencia ? (
          <View style={styles.potencia}>
            <View style={styles.potenciaChips} accessibilityRole="radiogroup" accessibilityLabel="Potencia del coach">
              <Chip small label="Estándar" selected={modoVisible === 'estandar'} onPress={() => elegirModo('estandar')} />
              <Chip
                small
                label="Profundo"
                icon="telescope-outline"
                selected={modoVisible === 'profundo'}
                onPress={() => elegirModo('profundo')}
                disabled={!profundoAbierto}
                accessibilityLabel={`Modo profundo. ${lineaProfundos(estado)}`}
              />
            </View>
            <Text style={styles.potenciaTexto} numberOfLines={2}>
              {lineaProfundos(estado)}
            </Text>
          </View>
        ) : null}

        {/* Sin Pro se cierra ESCRIBIR, no leer: con historial (una suscripción
            que venció) la conversación se conserva a la vista. Sin historial,
            el estado bloqueado de arriba ya lleva su propio botón. */}
        {sinPro ? (
          vacio ? null : (
            <View style={styles.bandaPro}>
              <Text style={styles.bandaProTexto}>El coach es parte de NIVL Pro. Tu conversación se conserva.</Text>
              <SystemButton title="Ver NIVL Pro" size="sm" onPress={() => router.push('/pro')} />
            </View>
          )
        ) : (
          <View style={[styles.barra, conPotencia && styles.barraSinLinea]}>
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
              onKeyPress={alTeclear}
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
        )}
      </KeyboardAvoidingView>
      {consentimiento.hoja}
      <DenunciarIA respuesta={denuncia} onClose={() => setDenuncia(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  eyebrow: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 2.2, color: colors.textFaint },
  titulo: { fontFamily: fonts.heading, fontSize: 24, letterSpacing: -0.5, color: colors.text, marginTop: 2 },
  headerAcciones: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  denunciar: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 8, paddingVertical: 2 },
  denunciarTexto: { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint },
  accionTexto: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textDim, flexShrink: 1 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, borderLeftWidth: 2, borderLeftColor: colors.red, paddingLeft: 10, paddingVertical: 6 },
  errorTexto: { fontFamily: fonts.body, fontSize: 13, color: colors.red, flex: 1 },
  vacio: { alignItems: 'center', paddingTop: 48, paddingBottom: 24, paddingHorizontal: 12 },
  vacioEmblema: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  vacioTitulo: { fontFamily: fonts.heading, fontSize: 22, letterSpacing: -0.4, color: colors.text, marginTop: 18 },
  vacioTexto: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.textDim, textAlign: 'center', marginTop: 8 },
  vacioDescargo: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textFaint, textAlign: 'center', marginTop: 14 },
  bloqueado: { alignItems: 'center', paddingTop: 36, paddingBottom: 24, paddingHorizontal: 4 },
  bloqueadoEmblema: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloqueadoBoton: { alignSelf: 'stretch', marginTop: 20 },
  hoy: { alignSelf: 'stretch', marginTop: 24, borderWidth: 1, borderColor: colors.line, padding: 16 },
  hoyRotulo: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 2.5, color: colors.textFaint, marginBottom: 6 },
  hoyFila: { flexDirection: 'row', gap: 10, paddingVertical: 9 },
  hoyFilaSep: { borderTopWidth: 1, borderTopColor: colors.line },
  hoyIcono: { marginTop: 3 },
  muestra: { alignSelf: 'stretch', marginTop: 10, backgroundColor: colors.panel, padding: 16 },
  muestraCabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  muestraLinea: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.textDim, marginTop: 8 },
  cargandoCuerpo: { paddingHorizontal: 20, paddingTop: 20 },
  cargandoLinea: { marginTop: 10 },
  cargandoBloque: { marginTop: 22 },
  hoyTexto: { flex: 1, minWidth: 0, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.text },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  avisoTexto: { flex: 1, minWidth: 0, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.accentText },
  bandaPro: {
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  bandaProTexto: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textDim },
  // ChipRow sangra 20 px a cada lado para pantallas con padding; aquí no lo hay.
  atajos: { paddingBottom: 10, paddingHorizontal: 20 },
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
  potencia: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 2,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  potenciaChips: { flexDirection: 'row', gap: 8 },
  barraSinLinea: { borderTopWidth: 0 },
  potenciaTexto: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textDim, marginTop: 6 },
});

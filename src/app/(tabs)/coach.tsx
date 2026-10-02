import Ionicons from '@expo/vector-icons/Ionicons';
import { vibrar } from '@/design/haptics';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
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
import { useCelebracion } from '@/components/celebracion/contexto';
import { citaDe, esConsulta, sinConsultas } from '@/components/coach/cita';
import { CoachMark } from '@/components/coach/CoachMark';
import { BotonDictar, FranjaGrabacion, useDictado } from '@/components/coach/Dictado';
import { unirDictado } from '@/components/coach/dictadoGesto';
import { HojaPrivacidadDictado } from '@/components/coach/HojaPrivacidadDictado';
import { MensajeCoach } from '@/components/coach/MensajeCoach';
import { aceptarRed } from '@/components/coach/redDictado';
import { useConsentimientoIA } from '@/components/ConsentimientoIA';
import { DenunciarIA, type RespuestaDenunciada } from '@/components/DenunciarIA';
import { HealthConsentGuard } from '@/components/ConsentimientoSalud';
import { ProUpsellLine } from '@/components/ProOffer';
import { SystemButton } from '@/components/SystemButton';
import { Button, Card, Chip, ChipRow, FadeIn, Screen, Skeleton, Tag } from '@/components/ui';
import { ink, space, type } from '@/design/tokens';
import { useAuth } from '@/lib/auth';
import {
  accessNotice,
  CoachAccessError,
  describeAction,
  fetchMainThread,
  fetchMessages,
  isToolResultOnly,
  messageText,
  streamCoach,
  type CoachAction,
  type CoachMessage,
  type CoachMode,
} from '@/lib/coach';
import { cancelarDictado, disponible, disponibleDictado, hablar, parar, suscribirHablando } from '@/lib/coachvoz';
import { DESCARGO_SALUD, LINEA_CRISIS, olvidarConsentimiento } from '@/lib/consent';
import { ensureProfile } from '@/lib/data';
import { isValidKey, nombreDia } from '@/lib/dates';
import {
  energiaAgotada,
  fetchAiStatus,
  isPro,
  lineaProfundos,
  ofrecerSi,
  proSampleBrief,
  proToday,
  puedeProfundo,
  SIN_IA,
  type AiStatus,
  type DecisionOferta,
} from '@/lib/pro';
import { mensajeSistema } from '@/lib/validation';

interface Burbuja {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** Lo que cambió en el sistema, ya legible (sin las consultas). */
  acciones: string[];
  /** Nombres de las herramientas del turno (para la cita de lo consultado). */
  herramientas: string[];
}

/** Nombres de las herramientas que usó un turno guardado. */
function herramientasDe(m: CoachMessage): string[] {
  return (m.content ?? []).filter((b) => b.type === 'tool_use' && b.name).map((b) => b.name!);
}

/**
 * Del hilo guardado a burbujas. Un turno del coach que solo consultó (sin
 * texto ni cambios) no se pinta: su consulta pasa como cita a la siguiente
 * respuesta del coach.
 */
function aBurbujas(mensajes: CoachMessage[]): Burbuja[] {
  const lista: Burbuja[] = [];
  let pendientes: string[] = [];
  for (const m of mensajes) {
    if (isToolResultOnly(m)) continue;
    const propias = herramientasDe(m);
    const herramientas = m.role === 'assistant' ? [...pendientes, ...propias] : propias;
    const text = messageText(m);
    const acciones = sinConsultas(propias).map(describeAction);
    if (!text && !acciones.length) {
      if (m.role === 'assistant') pendientes = herramientas;
      continue;
    }
    pendientes = [];
    lista.push({ id: m.id, role: m.role, text, acciones, herramientas });
  }
  return lista;
}

// Atajos a los rituales: lo que el coach anterior hacía por cadena programada.
const ATAJOS: { etiqueta: string; mensaje: string; icono: keyof typeof Ionicons.glyphMap }[] = [
  { etiqueta: 'Planifica mi día', mensaje: 'Planifica el resto de mi día de hoy.', icono: 'list-outline' },
  { etiqueta: 'Reporte', mensaje: 'Voy a reportar. Pregúntame lo que necesites saber de hoy.', icono: 'clipboard-outline' },
  { etiqueta: 'Dojo de ventas', mensaje: 'Entréname 15 minutos de ventas. Empieza con una objeción real.', icono: 'flash-outline' },
  { etiqueta: 'Revísame', mensaje: 'Haz la revisión de mis últimos 14 días con honestidad brutal.', icono: 'analytics-outline' },
];

// Sin respuesta del estado de la IA en este tiempo, se pinta igual (estado null).
const LIMITE_ESTADO_MS = 5000;

// Los ids que vienen del servidor son uuid; los de burbujas recién llegadas
// por el stream son locales y no identifican nada en el servidor.
const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * La pestaña de una cuenta sin NIVL Pro. No es un error ni un muro en blanco:
 * enseña lo que el coach estaría haciendo hoy por este perfil y el camino a
 * Pro. El resto de la app no se toca.
 */
function CoachBloqueado({ kind, onPro, oferta }: { kind: unknown; onPro: () => void; oferta: DecisionOferta | null }) {
  return (
    <FadeIn>
      <View style={styles.bloqueado}>
        <View style={styles.bloqueadoEmblema}>
          <Ionicons name="lock-closed-outline" size={24} color={ink.ink9} />
        </View>
        {/* Con la línea de la oferta, «El coach es parte de NIVL Pro» ya lo
            dice ella: el título no lo repite. */}
        <Text style={styles.vacioTitulo}>{oferta ? 'El coach no está en tu plan.' : 'El coach es parte de NIVL Pro.'}</Text>
        <Text style={styles.vacioTexto}>
          Tus misiones, tu racha, tus campañas y todos los módulos siguen siendo tuyos. Lo que falta es quien lo
          dirige.
        </Text>
        <View style={styles.hoy}>
          <Text style={styles.hoyRotulo}>HOY ESTARÍA</Text>
          {proToday(kind).map((linea, i) => (
            <View key={linea} style={[styles.hoyFila, i > 0 && styles.hoyFilaSep]}>
              <Ionicons name="remove-outline" size={14} color={ink.ink4} style={styles.hoyIcono} />
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
        {/* Sin decisión (o si no toca), el botón: la pantalla nunca se queda sin salida. */}
        {oferta ? (
          <View style={styles.bloqueadoLinea}>
            <ProUpsellLine momento="coach_cerrado" tier={oferta.tier} />
          </View>
        ) : (
          <SystemButton title="Ver NIVL Pro" onPress={onPro} style={styles.bloqueadoBoton} />
        )}
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
  // `energia` marca el del servidor por energía agotada: con la línea de la
  // oferta delante, lo dice ella y el aviso no se repite.
  const [aviso, setAviso] = useState<{ texto: string; energia: boolean } | null>(null);
  // La conversación no ha cargado: sin esto el vacío decía «El sistema te escucha».
  const [falloCarga, setFalloCarga] = useState(false);
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
  const { celebrando } = useCelebracion();

  // La voz: qué respuesta se está leyendo. `turnoVoz` distingue una lectura de
  // la anterior: hablar() calla lo previo y eso avisa «no habla» antes de que
  // la nueva empiece.
  const [puedeHablar, setPuedeHablar] = useState(() => disponible());
  const [vozId, setVozId] = useState<string | null>(null);
  const turnoVoz = useRef(0);
  const vozIniciada = useRef(-1);
  useEffect(
    () =>
      suscribirHablando((h) => {
        if (!h && vozIniciada.current === turnoVoz.current) setVozId(null);
      }),
    [],
  );
  const escuchar = (b: Burbuja) => {
    const t = ++turnoVoz.current;
    setVozId(b.id);
    void hablar(b.text, {
      onInicio: () => {
        vozIniciada.current = t;
      },
      onFin: () => {
        if (turnoVoz.current === t) setVozId(null);
      },
    });
  };
  const pararVoz = () => {
    turnoVoz.current += 1;
    parar();
    setVozId(null);
  };

  // El dictado: lo dicho va al cuadro de texto y NUNCA se envía solo.
  const [puedeDictar, setPuedeDictar] = useState(() => disponibleDictado());
  const [hojaDictado, setHojaDictado] = useState(false);
  // Lo que dice el dictado (un fallo, qué hacer ahora) va en su franja, junto
  // al micrófono, unos segundos: por la cola de celebraciones salía tarde.
  const [avisoDictado, setAvisoDictado] = useState<string | null>(null);
  const relojAvisoDictado = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mostrarAvisoDictado = useCallback((mensaje: string) => {
    if (relojAvisoDictado.current) clearTimeout(relojAvisoDictado.current);
    setAvisoDictado(mensaje);
    AccessibilityInfo.announceForAccessibility(mensaje);
    relojAvisoDictado.current = setTimeout(() => setAvisoDictado(null), 3000);
  }, []);
  useEffect(
    () => () => {
      if (relojAvisoDictado.current) clearTimeout(relojAvisoDictado.current);
    },
    [],
  );
  const dictado = useDictado({
    onTexto: (t) => setTexto((previo) => unirDictado(previo, t)),
    onError: (e) => mostrarAvisoDictado(e.mensaje),
    onPedirPrivacidad: () => setHojaDictado(true),
    onAviso: mostrarAvisoDictado,
  });
  const dictarPorRed = () => {
    void aceptarRed();
    setHojaDictado(false);
    mostrarAvisoDictado('Mantén pulsado para dictar');
  };

  // Al salir de la pestaña (y al desmontar) se calla y se tira el dictado.
  const cancelarDictadoUi = dictado.cancelar;
  useFocusEffect(
    useCallback(() => {
      setPuedeHablar(disponible());
      setPuedeDictar(disponibleDictado());
      return () => {
        turnoVoz.current += 1;
        parar();
        setVozId(null);
        cancelarDictadoUi();
      };
    }, [cancelarDictadoUi]),
  );
  useEffect(
    () => () => {
      parar();
      cancelarDictado();
    },
    [],
  );

  // Pro sin energía: una línea con la mejora, nunca una hoja ni sola.
  const agotadaPro = isPro(estado) && energiaAgotada(estado);
  const [ofertaEnergia, setOfertaEnergia] = useState<DecisionOferta | null>(null);
  useEffect(() => {
    if (!agotadaPro || celebrando) {
      setOfertaEnergia(null);
      return;
    }
    let vivo = true;
    ofrecerSi('energia_agotada', estado, { celebrando })
      .then((d) => {
        if (vivo) setOfertaEnergia(d.mostrar ? d : null);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [agotadaPro, celebrando, estado]);

  // Sin coach: «Ver NIVL Pro» pasa a la línea de la oferta si toca. Quien tiene
  // coach (Pro, prueba, Élite) no ve nada de esto.
  const sinCoach = estado !== null && !isPro(estado);
  const [ofertaCerrado, setOfertaCerrado] = useState<DecisionOferta | null>(null);
  useEffect(() => {
    if (!sinCoach || celebrando) {
      setOfertaCerrado(null);
      return;
    }
    let vivo = true;
    ofrecerSi('coach_cerrado', estado, { celebrando })
      .then((d) => {
        if (vivo) setOfertaCerrado(d.mostrar ? d : null);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [sinCoach, celebrando, estado]);

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
      // Sin respuesta en 5 s se pinta igual, con el estado que haya (null deja
      // escribir y el servidor cierra la puerta si toca): el esqueleto no se
      // queda para siempre por una red colgada.
      let reloj: ReturnType<typeof setTimeout> | null = null;
      const limite = new Promise<void>((resolver) => {
        reloj = setTimeout(resolver, LIMITE_ESTADO_MS);
      });
      void Promise.race([releerEstado(), limite]).finally(() => {
        if (reloj) clearTimeout(reloj);
        setEstadoListo(true);
      });
      ensureProfile(userId)
        .then((p) => setKind(p.profile_kind))
        .catch(() => {});
    }, [userId, releerEstado]),
  );

  const cargar = useCallback(async () => {
    setFalloCarga(false);
    try {
      const hilo = await fetchMainThread();
      if (!hilo) {
        setBurbujas([]);
        setCargando(false);
        return;
      }
      setThreadId(hilo.id);
      const mensajes = await fetchMessages(hilo.id);
      setBurbujas(aBurbujas(mensajes));
    } catch {
      setFalloCarga(true);
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
        herramientas: [],
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
                  acciones: ejecutadas.filter((a) => !esConsulta(a.name)).map((a) => describeAction(a.name)),
                  herramientas: ejecutadas.filter((a) => a.ok).map((a) => a.name),
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
          setAviso({ texto: accessNotice(e), energia: e.reason === 'presupuesto_agotado' });
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
    vibrar('seleccion');
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
    aviso?.texto ??
    (energiaAgotada(estado)
      ? `La energía del coach de este mes se ha agotado. ${recarga ? `Se recarga el ${recarga}.` : 'Se recarga el día 1.'}`
      : null);
  const puedeEnviar = (!!texto.trim() || adjuntas.length > 0) && !enviando.current;
  // El micrófono ocupa el sitio de «enviar» cuando no hay nada que enviar; y se
  // queda mientras graba, aunque llegue texto, para no soltar el gesto a medias.
  const grabandoUi = dictado.grabando || dictado.preparando;
  const conDictado = puedeDictar && ((!texto.trim() && !adjuntas.length) || grabandoUi);
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
            <Ionicons name="flash-outline" size={16} color={ink.ink9} />
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
              <Ionicons name="library-outline" size={18} color={ink.ink9} />
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
          {vacio && sinPro ? <CoachBloqueado kind={kind} onPro={() => router.push('/pro')} oferta={ofertaCerrado} /> : null}

          {vacio && !sinPro && falloCarga ? (
            <FadeIn>
              <Card variant="outline" style={styles.falloCarga}>
                <Text style={styles.falloCargaTexto}>No se ha podido cargar la conversación.</Text>
                <Button
                  title="Reintentar"
                  variant="secondary"
                  size="sm"
                  onPress={() => {
                    setCargando(true);
                    void cargar();
                  }}
                  style={styles.falloCargaBoton}
                />
              </Card>
            </FadeIn>
          ) : null}

          {vacio && !sinPro && !falloCarga ? (
            <FadeIn>
              <View style={styles.vacio}>
                <CoachMark size={48} />
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
              <MensajeCoach
                key={b.id}
                texto={b.text}
                acciones={b.acciones.map((texto) => ({ texto, ok: true }))}
                cita={citaDe(b.herramientas)}
                voz={
                  puedeHablar && b.text
                    ? {
                        estado: vozId === b.id ? 'hablando' : 'quieto',
                        onEscuchar: () => escuchar(b),
                        onParar: pararVoz,
                      }
                    : undefined
                }
                onDenunciar={() =>
                  setDenuncia({
                    fuente: 'coach',
                    messageId: ES_UUID.test(b.id) ? b.id : null,
                    texto: b.text,
                    contexto: `hilo ${threadId ?? 'desconocido'} · ${new Date().toISOString()}`,
                  })
                }
              />
            ),
          )}

          {enCurso || pensando || acciones.length ? (
            <MensajeCoach
              texto={enCurso}
              pensando={pensando}
              acciones={acciones.filter((a) => !esConsulta(a.name)).map((a) => ({ texto: describeAction(a.name), ok: a.ok }))}
              cita={citaDe(acciones.filter((a) => a.ok).map((a) => a.name))}
            />
          ) : null}

          {/* Alerta v2: la trama hace de borde; el texto, en ink9. */}
          {error ? (
            <Card variant="alerta" padded={false} style={styles.errorTarjeta}>
              <View style={styles.error} accessibilityRole="alert">
                <Ionicons name="alert-circle-outline" size={16} color={ink.ink9} />
                <Text style={styles.errorTexto}>{error}</Text>
              </View>
            </Card>
          ) : null}
        </ScrollView>

        {vacio && !sinPro && !falloCarga ? (
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
            <Ionicons name="image-outline" size={14} color={ink.ink8} />
            <Text style={styles.adjuntasTexto}>
              {adjuntas.length === 1 ? '1 foto lista para enviar' : `${adjuntas.length} fotos listas para enviar`}
            </Text>
            <Pressable onPress={() => setAdjuntas([])} hitSlop={8} accessibilityRole="button" accessibilityLabel="Quitar las fotos">
              <Ionicons name="close" size={16} color={ink.ink8} />
            </Pressable>
          </View>
        ) : null}

        {avisoEnergia && !sinPro ? (
          ofertaEnergia && agotadaPro ? (
            // La línea ya dice que la energía se ha agotado: el aviso propio
            // solo queda si el servidor ha dicho otra cosa.
            <View style={styles.avisoBloque}>
              {aviso && !aviso.energia ? (
                <View style={styles.avisoFila}>
                  <Ionicons name="hourglass-outline" size={14} color={ink.ink8} />
                  <Text style={styles.avisoTexto}>{aviso.texto}</Text>
                </View>
              ) : null}
              <ProUpsellLine momento="energia_agotada" tier={ofertaEnergia.tier} />
            </View>
          ) : (
            <Pressable
              onPress={() => router.push('/pro')}
              style={({ pressed }) => [styles.aviso, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel={`${avisoEnergia} Ver la energía del coach`}
            >
              <Ionicons name="hourglass-outline" size={14} color={ink.ink8} />
              <Text style={styles.avisoTexto}>{avisoEnergia}</Text>
              <Ionicons name="chevron-forward" size={14} color={ink.ink6} />
            </Pressable>
          )
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
              {/* La línea de la oferta ya dice que el coach es parte de NIVL Pro. */}
              <Text style={styles.bandaProTexto}>
                {ofertaCerrado ? 'Tu conversación se conserva.' : 'El coach es parte de NIVL Pro. Tu conversación se conserva.'}
              </Text>
              {ofertaCerrado ? (
                <ProUpsellLine momento="coach_cerrado" tier={ofertaCerrado.tier} />
              ) : (
                <SystemButton title="Ver NIVL Pro" size="sm" onPress={() => router.push('/pro')} />
              )}
            </View>
          )
        ) : (
          <View>
            <FranjaGrabacion dictado={dictado} aviso={avisoDictado} />
            <View style={[styles.barra, (conPotencia || grabandoUi || !!avisoDictado) && styles.barraSinLinea]}>
              <Pressable
                onPress={adjuntar}
                disabled={enviando.current}
                style={({ pressed }) => [styles.adjuntar, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel="Adjuntar una foto"
              >
                <Ionicons name="add" size={22} color={ink.ink8} />
              </Pressable>
              <TextInput
                style={styles.input}
                value={texto}
                onChangeText={setTexto}
                placeholder="Habla con el sistema"
                placeholderTextColor={ink.ink6}
                multiline
                onKeyPress={alTeclear}
                accessibilityLabel="Mensaje para el sistema"
              />
              {conDictado ? (
                <BotonDictar dictado={dictado} disabled={enviando.current} />
              ) : (
                <Pressable
                  onPress={() => enviar(texto)}
                  disabled={!puedeEnviar}
                  style={({ pressed }) => [styles.enviar, !puedeEnviar && styles.enviarOff, pressed && { opacity: 0.8 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Enviar mensaje"
                >
                  <Ionicons name="arrow-up" size={20} color={ink.ink0} />
                </Pressable>
              )}
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
      {consentimiento.hoja}
      <HojaPrivacidadDictado visible={hojaDictado} onAceptar={dictarPorRed} onClose={() => setHojaDictado(false)} />
      <DenunciarIA respuesta={denuncia} onClose={() => setDenuncia(null)} />
    </Screen>
  );
}

// Tokens v2 (src/design/tokens.ts): lectura en bodySm (≥ 14), rótulos en label.
const lectura = { fontFamily: type.bodySm.family, fontSize: type.bodySm.size, lineHeight: type.bodySm.lineHeight } as const;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: space.s5,
    paddingTop: space.s2,
    paddingBottom: space.s3,
    borderBottomWidth: 1,
    borderBottomColor: ink.ink3,
  },
  eyebrow: { fontFamily: type.label.family, fontSize: type.label.size, lineHeight: type.label.lineHeight, letterSpacing: type.label.tracking, color: ink.ink6 },
  titulo: {
    fontFamily: type.headline.family,
    fontSize: type.headline.size,
    lineHeight: type.headline.lineHeight,
    letterSpacing: type.headline.tracking,
    color: ink.ink9,
    marginTop: 2,
  },
  headerAcciones: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  memoria: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    paddingVertical: space.s1 + 2,
    paddingHorizontal: space.s3,
    borderWidth: 1,
    borderColor: ink.ink3,
  },
  memoriaTexto: { fontFamily: type.micro.family, fontSize: type.label.size, lineHeight: type.label.lineHeight, color: ink.ink9 },
  lista: { paddingHorizontal: space.s5, paddingTop: space.s4, paddingBottom: space.s3 },
  filaUsuario: { alignItems: 'flex-end', marginBottom: space.s4 },
  // Sin invertir: la inversión de la pantalla es de enviar y del micrófono.
  burbujaUsuario: {
    maxWidth: '84%',
    backgroundColor: ink.ink2,
    borderWidth: 1,
    borderColor: ink.ink3,
    paddingVertical: space.s3 - 2,
    paddingHorizontal: space.s3 + 2,
  },
  textoUsuario: { ...lectura, color: ink.ink9 },
  errorTarjeta: { marginTop: space.s1, marginBottom: 0 },
  error: { flexDirection: 'row', alignItems: 'center', gap: space.s2, paddingHorizontal: space.s3, paddingVertical: space.s3 - 2 },
  errorTexto: { ...lectura, color: ink.ink9, flex: 1 },
  falloCarga: { marginTop: space.s8, alignItems: 'center', paddingVertical: space.s6 },
  falloCargaTexto: { ...lectura, color: ink.ink9, textAlign: 'center' },
  falloCargaBoton: { marginTop: space.s4 },
  vacio: { alignItems: 'center', paddingTop: space.s10 + space.s2, paddingBottom: space.s6, paddingHorizontal: space.s3 },
  vacioTitulo: {
    fontFamily: type.headline.family,
    fontSize: type.headline.size,
    lineHeight: type.headline.lineHeight,
    letterSpacing: type.headline.tracking,
    color: ink.ink9,
    marginTop: space.s4,
    textAlign: 'center',
  },
  vacioTexto: { ...lectura, color: ink.ink8, textAlign: 'center', marginTop: space.s2 },
  vacioDescargo: { ...lectura, color: ink.ink6, textAlign: 'center', marginTop: space.s3 },
  bloqueado: { alignItems: 'center', paddingTop: space.s8, paddingBottom: space.s6, paddingHorizontal: space.s1 },
  bloqueadoEmblema: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: ink.ink4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloqueadoBoton: { alignSelf: 'stretch', marginTop: space.s5 },
  bloqueadoLinea: { alignSelf: 'stretch', marginTop: space.s5 },
  hoy: { alignSelf: 'stretch', marginTop: space.s6, borderWidth: 1, borderColor: ink.ink3, padding: space.s4 },
  hoyRotulo: {
    fontFamily: type.label.family,
    fontSize: type.label.size,
    lineHeight: type.label.lineHeight,
    letterSpacing: type.label.tracking,
    color: ink.ink6,
    marginBottom: space.s1,
  },
  hoyFila: { flexDirection: 'row', gap: space.s3 - 2, paddingVertical: space.s2 },
  hoyFilaSep: { borderTopWidth: 1, borderTopColor: ink.ink3 },
  hoyIcono: { marginTop: 3 },
  hoyTexto: { ...lectura, flex: 1, minWidth: 0, color: ink.ink9 },
  muestra: { alignSelf: 'stretch', marginTop: space.s3 - 2, backgroundColor: ink.ink1, padding: space.s4 },
  muestraCabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.s1 },
  muestraLinea: { ...lectura, color: ink.ink8, marginTop: space.s2 },
  cargandoCuerpo: { paddingHorizontal: space.s5, paddingTop: space.s5 },
  cargandoLinea: { marginTop: space.s3 - 2 },
  cargandoBloque: { marginTop: space.s6 },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    paddingHorizontal: space.s5,
    paddingVertical: space.s3 - 2,
    borderTopWidth: 1,
    borderTopColor: ink.ink3,
  },
  // La línea de la oferta trae su propio filete arriba: el bloque no pone otro.
  avisoBloque: { paddingHorizontal: space.s5 },
  avisoFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    paddingVertical: space.s3 - 2,
    borderTopWidth: 1,
    borderTopColor: ink.ink3,
  },
  avisoTexto: { ...lectura, flex: 1, minWidth: 0, color: ink.ink8 },
  bandaPro: {
    gap: space.s3 - 2,
    paddingHorizontal: space.s5,
    paddingTop: space.s3,
    paddingBottom: space.s3 + 2,
    borderTopWidth: 1,
    borderTopColor: ink.ink3,
  },
  bandaProTexto: { ...lectura, color: ink.ink8 },
  // ChipRow sangra 20 px a cada lado para pantallas con padding; aquí no lo hay.
  atajos: { paddingBottom: space.s3 - 2, paddingHorizontal: space.s5 },
  barra: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.s2,
    paddingHorizontal: space.s4,
    paddingTop: space.s3 - 2,
    paddingBottom: space.s3,
    borderTopWidth: 1,
    borderTopColor: ink.ink3,
    backgroundColor: ink.ink0,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 130,
    backgroundColor: ink.ink1,
    color: ink.ink9,
    fontFamily: type.body.family,
    fontSize: type.body.size,
    paddingHorizontal: space.s3 + 2,
    paddingTop: space.s3,
    paddingBottom: space.s3,
  },
  enviar: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ink.ink10,
  },
  enviarOff: { opacity: 0.35 },
  adjuntar: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ink.ink1,
  },
  adjuntas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    paddingHorizontal: space.s5,
    paddingBottom: space.s2,
  },
  adjuntasTexto: { ...lectura, color: ink.ink8, flex: 1 },
  potencia: {
    paddingHorizontal: space.s5,
    paddingTop: space.s3 - 2,
    paddingBottom: 2,
    borderTopWidth: 1,
    borderTopColor: ink.ink3,
  },
  potenciaChips: { flexDirection: 'row', gap: space.s2 },
  barraSinLinea: { borderTopWidth: 0 },
  potenciaTexto: { ...lectura, color: ink.ink8, marginTop: space.s1 + 2 },
});

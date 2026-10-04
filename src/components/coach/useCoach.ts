// NIVL · Los datos del Coach (L-RADICAL §C): todo lo que tiene efectos.
//
// Cortado y pegado de src/app/(tabs)/coach.tsx sin reescribir: el hilo, el
// stream con su cerrojo, los adjuntos, el 402/429 (CoachAccessError), el
// consentimiento, la energía y las ofertas (ofrecerSi), la voz (Escuchar /
// Parar), el dictado (que NUNCA envía solo) y el tiempo límite de 5 s del
// estado de la IA. Devuelve `vista` (props de CoachVista, puro) y `hojas`
// (lo que la ruta pinta debajo: consentimiento, privacidad del dictado y
// denuncia).

import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Platform,
  type NativeSyntheticEvent,
  type ScrollView,
  type TextInputKeyPressEventData,
} from 'react-native';
import { useCelebracion } from '@/components/celebracion/contexto';
import { useConsentimientoIA } from '@/components/ConsentimientoIA';
import type { RespuestaDenunciada } from '@/components/DenunciarIA';
import { vibrar } from '@/design/haptics';
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
import { olvidarConsentimiento } from '@/lib/consent';
import { ensureProfile } from '@/lib/data';
import { isValidKey, nombreDia } from '@/lib/dates';
import {
  energiaAgotada,
  fetchAiStatus,
  isPro,
  lineaProfundos,
  ofrecerSi,
  puedeProfundo,
  SIN_IA,
  type AiStatus,
  type DecisionOferta,
} from '@/lib/pro';
import { mensajeSistema } from '@/lib/validation';
import { citaDe, esConsulta, sinConsultas } from './cita';
import type { BurbujaVista, CoachVistaProps } from './CoachVista';
import { useDictado } from './Dictado';
import { unirDictado } from './dictadoGesto';
import { aceptarRed } from './redDictado';

interface Burbuja {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** Lo que cambió en el sistema, ya legible (sin las consultas). */
  acciones: string[];
  /** Nombres de las herramientas del turno (para la cita de lo consultado). */
  herramientas: string[];
  /** Cuándo se escribió (solo las del servidor): da el separador «HOY» / «AYER». */
  fecha?: string;
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
    lista.push({ id: m.id, role: m.role, text, acciones, herramientas, fecha: m.created_at });
  }
  return lista;
}

// Sin respuesta del estado de la IA en este tiempo, se pinta igual (estado null).
const LIMITE_ESTADO_MS = 5000;

// Los ids que vienen del servidor son uuid; los de burbujas recién llegadas
// por el stream son locales y no identifican nada en el servidor.
const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lo que la ruta pinta debajo de la vista. */
export interface HojasCoach {
  /** La hoja del consentimiento para la IA (0028). */
  consentimiento: ReactNode;
  dictado: { visible: boolean; onAceptar: () => void; onClose: () => void };
  denuncia: { respuesta: RespuestaDenunciada | null; onClose: () => void };
}

export function useCoach(): { vista: CoachVistaProps; hojas: HojasCoach } {
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
  // El turno en marcha, en estado (el cerrojo `enviando` es una ref y no
  // repinta): desde que sale el mensaje hasta que llega lo primero del coach
  // (`esperando`) y hasta que se cierra el turno (`ocupado`). Sin esto, entre
  // enviar y el primer token (el servidor arma el contexto y el modelo puede
  // no emitir `thinking`, p. ej. por DeepSeek) no se veía nada en ~20 s.
  const [esperando, setEsperando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
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
    // Sin pedir acceso a la fototeca: el selector del sistema (PHPicker en
    // iOS, el del sistema en Android) solo entrega lo que eliges y no lo
    // necesita. Pedirlo y no tenerlo dejaba el clip sin salida.
    let r: ImagePicker.ImagePickerResult;
    try {
      r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        // Calidad baja a propósito: una foto de móvil sin comprimir son varios
        // megas de base64, y eso se paga como miles de fichas en cada turno.
        quality: 0.35,
        base64: true,
        selectionLimit: 3,
        allowsMultipleSelection: true,
      });
    } catch (e) {
      setError(mensajeSistema(e));
      return;
    }
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
    setEsperando(true);
    setOcupado(true);
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
              setEsperando(false);
              acumulado += e.delta;
              setEnCurso(acumulado);
              alFondo();
              break;
            case 'tool':
              // Una herramienta no es la respuesta: «pensando» sigue hasta el
              // primer texto.
              ejecutadas.push(e.action);
              setAcciones([...ejecutadas]);
              alFondo();
              break;
            case 'done':
              setEsperando(false);
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
              setEsperando(false);
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
      setEsperando(false);
      setOcupado(false);
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

  const vacio = !burbujas.length && !enCurso;
  // Solo con certeza: mientras `estado` sea null no se bloquea a nadie.
  const sinPro = estado !== null && !isPro(estado);
  const recarga = estado?.renews && isValidKey(estado.renews) ? nombreDia(estado.renews).toLowerCase() : null;
  const avisoEnergia =
    aviso?.texto ??
    (energiaAgotada(estado)
      ? `La energía del coach de este mes se ha agotado. ${recarga ? `Se recarga el ${recarga}.` : 'Se recarga el día 1.'}`
      : null);
  const puedeEnviar = (!!texto.trim() || adjuntas.length > 0) && !ocupado && !enviando.current;
  // El micrófono está siempre junto a «enviar» si se puede dictar (lo dictado
  // se suma al texto); grabando, enviar se aparta en la vista.
  const grabandoUi = dictado.grabando || dictado.preparando;
  const conDictado = puedeDictar;
  // El selector de potencia solo existe si el plan incluye el modo profundo.
  const conPotencia = !sinPro && !!estado?.deepAllowed;
  const profundoAbierto = puedeProfundo(estado);
  const modoVisible: CoachMode = modo === 'profundo' && profundoAbierto ? 'profundo' : 'estandar';

  // Las consultas del último turno cerrado del coach: la línea de la cabecera.
  const ultimoCoach = [...burbujas].reverse().find((b) => b.role === 'assistant');
  const consultas = ultimoCoach ? ultimoCoach.herramientas.filter(esConsulta).length : 0;

  const vistaBurbujas: BurbujaVista[] = burbujas.map((b) =>
    b.role === 'user'
      ? { id: b.id, role: 'user', text: b.text, acciones: [], cita: null, fecha: b.fecha }
      : {
          id: b.id,
          role: 'assistant',
          text: b.text,
          acciones: b.acciones.map((t) => ({ texto: t, ok: true })),
          cita: citaDe(b.herramientas),
          fecha: b.fecha,
          voz:
            puedeHablar && b.text
              ? {
                  estado: vozId === b.id ? 'hablando' : 'quieto',
                  onEscuchar: () => escuchar(b),
                  onParar: pararVoz,
                }
              : undefined,
          onDenunciar: () =>
            setDenuncia({
              fuente: 'coach',
              messageId: ES_UUID.test(b.id) ? b.id : null,
              texto: b.text,
              contexto: `hilo ${threadId ?? 'desconocido'} · ${new Date().toISOString()}`,
            }),
        },
  );

  const vista: CoachVistaProps = {
    cargando: cargando || !estadoListo,
    sinPro,
    vacio,
    kind,
    ofertaCerrado: ofertaCerrado ? ofertaCerrado.tier : null,
    falloCarga,
    onReintentar: () => {
      setCargando(true);
      void cargar();
    },
    consultas,
    profundo: conPotencia && modoVisible === 'profundo',
    burbujas: vistaBurbujas,
    enCurso:
      enCurso || pensando || esperando || acciones.length
        ? {
            texto: enCurso,
            pensando: pensando || esperando,
            acciones: acciones.filter((a) => !esConsulta(a.name)).map((a) => ({ texto: describeAction(a.name), ok: a.ok })),
            cita: citaDe(acciones.filter((a) => a.ok).map((a) => a.name)),
          }
        : null,
    error,
    scrollRef,
    alFondo,
    onAtajo: (m) => void enviar(m),
    adjuntas: adjuntas.length,
    onQuitarAdjuntas: () => setAdjuntas([]),
    energia:
      avisoEnergia && !sinPro
        ? {
            texto: avisoEnergia,
            ofertaTier: ofertaEnergia && agotadaPro ? ofertaEnergia.tier : null,
            avisoAparte: aviso && !aviso.energia ? aviso.texto : null,
          }
        : null,
    potencia: conPotencia
      ? { modo: modoVisible, profundoAbierto, linea: lineaProfundos(estado), onElegir: elegirModo }
      : null,
    compositor: {
      texto,
      onCambiarTexto: setTexto,
      onTeclear: alTeclear,
      puedeEnviar,
      onEnviar: () => void enviar(texto),
      ocupado: ocupado || enviando.current,
      conDictado,
      grabando: grabandoUi,
      dictado,
      avisoDictado,
      onAdjuntar: () => void adjuntar(),
      // Manda ai_status.vision (Seguridad/Compras). Hasta que el campo llegue
      // integrado, el nivel: solo Élite y owner van por un modelo con visión.
      conFotos: estado ? puedeVerFotos(estado) : null,
    },
    onPro: () => router.push('/pro'),
    onMemoria: () => router.push('/memoria'),
  };

  return {
    vista,
    hojas: {
      consentimiento: consentimiento.hoja,
      dictado: { visible: hojaDictado, onAceptar: dictarPorRed, onClose: () => setHojaDictado(false) },
      denuncia: { respuesta: denuncia, onClose: () => setDenuncia(null) },
    },
  };
}

function puedeVerFotos(estado: { tier?: string | null }): boolean {
  const vision = (estado as { vision?: unknown }).vision;
  if (typeof vision === 'boolean') return vision;
  return estado.tier === 'elite' || estado.tier === 'owner';
}

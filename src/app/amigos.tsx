import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  // Clipboard sigue en el núcleo de RN 0.81 (módulo nativo incluido). Está
  // marcado como obsoleto, pero la alternativa es una dependencia nueva y un
  // build nativo solo para copiar ocho letras. Si un día desaparece, `copiar`
  // cae al compartir del sistema, que también deja copiar.
  Clipboard,
  LayoutAnimation,
  Linking,
  Modal,
  ScrollView,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { EliteBadge } from '@/components/EliteBadge';
import { Aviso } from '@/components/amigos/Aviso';
import { Competicion, type Amigo } from '@/components/amigos/Competicion';
import { prepararDatosSemana, tarjetaDeSemana } from '@/components/ShareCardSemana';
import { SystemButton } from '@/components/SystemButton';
import {
  Avatar,
  Button,
  Card,
  Chip,
  ChipWrap,
  EmptyState,
  FadeIn,
  Row,
  RowValue,
  Screen,
  ScreenHeader,
  Section,
  Skeleton,
  SkeletonRows,
  Stagger,
  Stat,
  StatRow,
  Tag,
} from '@/components/ui';
import { useCelebracion } from '@/components/celebracion/contexto';
import { Interruptor } from '@/components/ui/Interruptor';
import { vibrar } from '@/design/haptics';
import { ink, type Rank } from '@/design/tokens';
import { fetchUnlocked, tituloVigente } from '@/lib/achievements';
import { fetchRangosAmigos } from '@/lib/amigosRango';
import { avisar, confirmar } from '@/components/ui/confirmar';
import { volver } from '@/components/ui/Screen';
import { useAuth } from '@/lib/auth';
import {
  conInsignias,
  estadoLudus,
  INSIGNIA_ELITE_LABEL,
  LUDUS_MAX,
  LUDUS_MIN,
  lineaLudus,
  NOTA_LUDUS_MAX,
  OBJETIVOS_LUDUS,
  SIN_LUDUS,
  type MiLudus,
} from '@/lib/elite';
import { levelFromXp } from '@/lib/game';
import { fetchMyInvites, UMBRALES_INVITACION, type MyInvites } from '@/lib/invites';
import { kindMeta, type ProfileKind } from '@/lib/kinds';
import { fetchAiStatus, type Tier } from '@/lib/pro';
import { celebracionInsignia, estadoDe, INSIGNIAS, nivelInsignia, type Celebracion } from '@/lib/progression';
import {
  blockSocialUser,
  fetchBlockedUsers,
  reportSocialUser,
  unblockSocialUser,
  type BlockedUser,
  fetchBoard,
  fetchEliteBadges,
  fetchGroupBoard,
  fetchMyEliteGroup,
  fetchRequests,
  fetchSocialSelf,
  removeFriend,
  requestEliteGroup,
  requestFriend,
  respondRequest,
  setSocialVisible,
  type BoardEntry,
  type FriendRequest,
  type SocialSelf,
} from '@/lib/social';
import {
  clasificar,
  type Clasificado,
  codigoLegible,
  DIAS_VENTANA,
  errorDeCodigo,
  etiquetaPosicion,
  formatoValor,
  LARGO_CODIGO,
  lineaRivalidad,
  mensajeInvitacion,
  METRICA_LABEL,
  normalizarCodigo,
  type Metrica,
  type Ventana,
} from '@/lib/socialmath';
import { colors, fonts } from '@/lib/theme';
import { REPORT_REASONS, SOCIAL_SUPPORT_URL, type ReportReason } from '@/lib/socialSafety';
import { useCountUp } from '@/lib/useCountUp';
import { mensajeSistema } from '@/lib/validation';

const VENTANAS: { key: Ventana; label: string }[] = [
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mes' },
];
const METRICAS: Metrica[] = ['xp', 'cumplimiento', 'racha'];


/** La cifra del ranking, que sube (o baja) hasta su valor al cambiar de métrica o de periodo. */
function ValorRanking({ valor, metrica, tone }: { valor: number | null; metrica: Metrica; tone: 'accent' | 'dim' }) {
  const mostrado = useCountUp(valor ?? 0, 600);
  return (
    <RowValue strong tone={tone}>
      {formatoValor(valor === null ? null : mostrado, metrica)}
    </RowValue>
  );
}

type Fila = Clasificado<BoardEntry> & { insignia: boolean };

/**
 * Las filas de un marcador (amigos o ludus). La insignia se pinta junto al
 * nombre y NO interviene en el orden: llega ya clasificado.
 */
function ListaRanking({
  filas,
  metrica,
  atenuado,
  onLongPress,
  onSafety,
  miRango,
  rangos,
}: {
  filas: readonly Fila[];
  metrica: Metrica;
  atenuado?: boolean;
  /** Rango propio: el mismo que enseña Perfil (estadoDe(...).rango). */
  miRango: Rank | null;
  /** Rango registrado de los amigos (0052). Sin entrada = marco liso. */
  rangos: ReadonlyMap<string, Rank>;
  /** Sin él (ludus) no se puede quitar a nadie desde aquí. */
  onLongPress?: (b: BoardEntry) => void;
  onSafety: (b: BoardEntry) => void;
}) {
  return (
    <Card padded={false} style={[styles.lista, atenuado && styles.atenuado]}>
      {filas.map((c, i) => {
        const b = c.competidor;
        const nivel = levelFromXp(b.xpTotal).level;
        const valor = formatoValor(c.valor, metrica);
        const quitar = !b.isMe && onLongPress ? () => onLongPress(b) : undefined;
        return (
          <Row
            key={b.userId}
            first={i === 0}
            style={b.isMe ? styles.miFila : undefined}
            leading={
              <View style={styles.puesto}>
                <Text style={[styles.puestoTexto, c.posicion === 1 && c.valor !== null && styles.oro]}>
                  {c.valor === null ? '—' : etiquetaPosicion(c.posicion)}
                </Text>
                <Avatar
                  size={40}
                  avatarPath={b.avatarPath}
                  name={b.name}
                  rank={b.isMe ? miRango : (rangos.get(b.userId) ?? null)}
                  titulo={tituloVigente(b.equippedTitle) ?? undefined}
                />
              </View>
            }
            title={b.isMe ? `${b.name} · tú` : b.name}
            titleAddon={c.insignia ? <EliteBadge size={14} /> : undefined}
            detail={
              <View style={styles.detalle}>
                <Text style={styles.detalleTexto} numberOfLines={1}>
                  Nivel {nivel}
                  {metrica !== 'racha' && b.streakDays > 0 ? ` · racha ${b.streakDays}` : ''}
                </Text>
                {tituloVigente(b.equippedTitle) ? <Tag tone="logro">{tituloVigente(b.equippedTitle)}</Tag> : null}
              </View>
            }
            trailing={
              <View style={styles.respuestas}>
                <ValorRanking
                  valor={c.valor}
                  metrica={metrica}
                  tone={b.isMe ? 'accent' : 'dim'}
                />
                {!b.isMe ? <SafetyButton name={b.name} onPress={() => onSafety(b)} /> : null}
              </View>
            }
            onPress={!b.isMe ? () => onSafety(b) : undefined}
            onLongPress={quitar}
            accessibilityLabel={`${c.valor === null ? 'Sin puesto' : `Puesto ${c.posicion}`}. ${b.isMe ? 'Tú' : b.name}${c.insignia ? `, ${INSIGNIA_ELITE_LABEL}` : ''}, nivel ${nivel}, ${valor}.${!b.isMe ? ' Toca para más opciones.' : ''}${quitar ? ' Mantén pulsado para quitar.' : ''}`}
          />
        );
      })}
    </Card>
  );
}

function SafetyButton({ name, onPress }: { name: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.safetyButton} accessibilityRole="button"
    accessibilityLabel={`Más opciones con ${name}`}>
    <Ionicons name="ellipsis-horizontal" size={20} color={colors.textDim} />
  </Pressable>;
}

export default function Amigos() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [safetyUser, setSafetyUser] = useState<{ userId: string; name: string } | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason | null>(null);
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [safetyMessage, setSafetyMessage] = useState<string | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  // An older in-flight response must not put a just-blocked user back on screen.
  const blockedLocally = useRef(new Set<string>());
  const [yo, setYo] = useState<SocialSelf | null>(null);
  const [board, setBoard] = useState<BoardEntry[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [ventana, setVentana] = useState<Ventana>('semana');
  const [metrica, setMetrica] = useState<Metrica>('xp');
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  // Entre que se toca Semana/Mes y llegan las cifras nuevas, el ranking viejo
  // se atenúa: sin esto el chip cambiaba y la lista no, y parecía roto.
  const [cambiando, setCambiando] = useState(false);

  const [codigo, setCodigo] = useState('');
  const [avisoCodigo, setAvisoCodigo] = useState<{ texto: string; error: boolean } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [ocupada, setOcupada] = useState<string | null>(null);

  // ── Élite: insignias y ludus (0026). Todo es adorno o va aparte: si falla,
  // la arena de amigos se pinta igual.
  const [insignias, setInsignias] = useState<ReadonlySet<string>>(() => new Set());
  const [tier, setTier] = useState<Tier>('free');
  const [miLudus, setMiLudus] = useState<MiLudus>(SIN_LUDUS);
  const [ludusBoard, setLudusBoard] = useState<BoardEntry[]>([]);
  const [ventanaLudus, setVentanaLudus] = useState<Ventana>('semana');
  const [metricaLudus, setMetricaLudus] = useState<Metrica>('xp');
  const [objetivo, setObjetivo] = useState<ProfileKind | null>(null);
  const [nota, setNota] = useState('');
  const [pidiendo, setPidiendo] = useState(false);
  const [avisoLudus, setAvisoLudus] = useState<{ texto: string; error: boolean } | null>(null);
  const [cambiarPeticion, setCambiarPeticion] = useState(false);
  const ventanaLudusViva = useRef<Ventana>('semana');

  // Rango propio e invitaciones: adorno, por su cuenta. Si fallan, no se pintan.
  // Mis logros: con ellos y mi fila del marcador sale el rango con la MISMA
  // función que Perfil (estadoDe), para que el marco no diga otra cosa aquí.
  const [logros, setLogros] = useState<ReadonlySet<string> | null>(null);
  const [rangos, setRangos] = useState<ReadonlyMap<string, Rank>>(() => new Map());
  const [invitaciones, setInvitaciones] = useState<MyInvites | null>(null);
  const { celebrar, compartir } = useCelebracion();

  // ── Competición (0048): duelos y ligas. Va por su cuenta en <Competicion>.
  const [competicion, setCompeticion] = useState(true);
  const [retarA, setRetarA] = useState<Amigo | null>(null);
  const [recarga, setRecarga] = useState(0);

  const [preparando, setPreparando] = useState(false);
  const lock = useRef(false);
  // La ventana pedida más reciente: si tocas Semana → Mes → Semana deprisa, la
  // respuesta lenta de "Mes" no debe pisar la de "Semana".
  const ventanaViva = useRef<Ventana>('semana');
  const hayRanking = useRef(false);

  const load = useCallback(
    async (v: Ventana) => {
      if (!userId) return;
      ventanaViva.current = v;
      try {
        const [self, filas, pendientes, bloqueados] = await Promise.all([
          fetchSocialSelf(userId),
          fetchBoard(DIAS_VENTANA[v]),
          fetchRequests(),
          fetchBlockedUsers(),
        ]);
        if (ventanaViva.current !== v) return;
        // Si el orden cambia con los datos nuevos, las filas se recolocan con
        // una transición. En la primera carga no hay nada que mover.
        if (hayRanking.current) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        hayRanking.current = true;
        setYo(self);
        setBoard(filas.filter((person) => !blockedLocally.current.has(person.userId)));
        setRequests(pendientes.filter((person) => !blockedLocally.current.has(person.userId)));
        setBlockedUsers(bloqueados);
        setFallo(null);
      } catch (e) {
        setFallo(mensajeSistema(e));
      } finally {
        setCargando(false);
        if (ventanaViva.current === v) setCambiando(false);
      }
    },
    [userId],
  );

  useFocusEffect(
    useCallback(() => {
      load(ventana);
    }, [load, ventana]),
  );

  // El ludus y las insignias van por su cuenta: con el servidor aún sin la
  // 0026, o sin red, la sección no aparece y el ranking sale sin laureles.
  const loadLudus = useCallback(async (v: Ventana) => {
    ventanaLudusViva.current = v;
    fetchEliteBadges()
      .then(setInsignias)
      .catch(() => {});
    fetchUnlocked()
      .then((l) => setLogros(new Set(l)))
      .catch(() => {});
    fetchRangosAmigos().then(setRangos);
    fetchMyInvites()
      .catch(() => null)
      .then(async (inv) => {
        setInvitaciones(inv);
        if (!inv || !userId) return;
        // Se celebra solo al SUBIR de nivel respecto al último celebrado, que
        // se guarda por usuario: con antes=0 cada visita volvía a celebrarlo.
        const clave = `nivl:insignia:reclutador:${userId}`;
        const nivel = nivelInsignia('reclutador', inv.activos);
        let celebrado = 0;
        try {
          celebrado = Math.max(0, Math.min(3, Number(await AsyncStorage.getItem(clave)) || 0));
        } catch {
          // Sin almacén no se celebra: mejor callar que repetir.
          return;
        }
        if (nivel <= celebrado) return;
        const umbrales = INSIGNIAS.reclutador.umbrales;
        const antes = celebrado > 0 ? umbrales[celebrado - 1] : 0;
        const extra = [celebracionInsignia('reclutador', antes, inv.activos)].filter(
          (c): c is Celebracion => c !== null,
        );
        AsyncStorage.setItem(clave, String(nivel)).catch(() => {});
        celebrar({ accion: 'insignias', extra, final: true });
      });
    try {
      const [ia, mio] = await Promise.all([fetchAiStatus(), fetchMyEliteGroup()]);
      if (ventanaLudusViva.current !== v) return;
      setTier(ia.tier);
      setMiLudus(mio);
      if (estadoLudus(ia.tier, mio) === 'miembro') {
        const filas = await fetchGroupBoard(DIAS_VENTANA[v]);
        if (ventanaLudusViva.current !== v) return;
        setLudusBoard(filas.filter((person) => !blockedLocally.current.has(person.userId)));
      } else {
        setLudusBoard([]);
      }
    } catch {
      /* sin ludus: la pantalla sigue */
    }
  }, [celebrar, userId]);

  useFocusEffect(
    useCallback(() => {
      loadLudus(ventanaLudus);
    }, [loadLudus, ventanaLudus]),
  );

  const refrescar = async () => {
    setRefrescando(true);
    setRecarga((n) => n + 1);
    await Promise.all([load(ventana), loadLudus(ventanaLudus)]);
    setRefrescando(false);
  };

  const abrirSeguridad = (person: { userId: string; name: string }) => {
    setSafetyUser(person); setReportReason(null); setSafetyMessage(null);
  };
  const denunciar = async () => {
    if (!safetyUser || !reportReason || lock.current) return;
    lock.current = true; setSafetyBusy(true); setSafetyMessage(null);
    try {
      await reportSocialUser(safetyUser.userId, reportReason);
      setSafetyMessage('Denuncia registrada para revisión. También puedes bloquear a esta persona.');
      setReportReason(null);
    } catch (e) { setSafetyMessage(mensajeSistema(e)); }
    finally { lock.current = false; setSafetyBusy(false); }
  };
  // Bloquear y desbloquear: la acción solo corre tras la confirmación
  // explícita (`confirmar` también pinta en la web, donde el Alert de botones
  // no aparece), y la pantalla solo cambia cuando el servidor lo ha hecho.
  const bloquear = async () => {
    if (!safetyUser || lock.current) return;
    const person = safetyUser;
    const ok = await confirmar({
      titulo: 'Bloquear usuario',
      mensaje: 'Dejaréis de veros en solicitudes y rankings, también en el ludus. La amistad se eliminará.',
      confirmar: 'Bloquear',
      destructivo: true,
    });
    if (!ok || lock.current) return;
    lock.current = true; setSafetyBusy(true);
    try {
      await blockSocialUser(person.userId);
    } catch (e) {
      setSafetyMessage(mensajeSistema(e));
      lock.current = false; setSafetyBusy(false);
      return;
    }
    // Hecho en el servidor: fuera de la pantalla al momento, aunque el
    // refresco de después no tenga red.
    blockedLocally.current.add(person.userId);
    setBoard((rows) => rows.filter((r) => r.userId !== person.userId));
    setLudusBoard((rows) => rows.filter((r) => r.userId !== person.userId));
    setRequests((rows) => rows.filter((r) => r.userId !== person.userId));
    setSafetyUser(null);
    try {
      await Promise.all([load(ventana), loadLudus(ventanaLudus)]);
    } catch {
      // El bloqueo ya está hecho; la lista se pondrá al día en el próximo foco.
    } finally {
      lock.current = false; setSafetyBusy(false);
    }
  };
  const desbloquear = async (person: BlockedUser) => {
    if (lock.current) return;
    const ok = await confirmar({
      titulo: 'Desbloquear usuario',
      mensaje: 'Podrá volver a solicitar amistad. La amistad anterior no se recupera. Si compartís ludus, volverá a aparecer.',
      confirmar: 'Desbloquear',
    });
    if (!ok || lock.current) return;
    lock.current = true; setSafetyBusy(true);
    try {
      await unblockSocialUser(person.userId);
    } catch (e) {
      // Sigue bloqueado y la lista lo sigue diciendo.
      avisar('Error del sistema', mensajeSistema(e));
      lock.current = false; setSafetyBusy(false);
      return;
    }
    blockedLocally.current.delete(person.userId);
    setBlockedUsers((rows) => rows.filter((r) => r.userId !== person.userId));
    try {
      await refrescar();
    } catch {
      // Desbloqueado en el servidor; el resto se pondrá al día en el próximo foco.
    } finally {
      lock.current = false; setSafetyBusy(false);
    }
  };
  const abrirSoporte = () => Linking.openURL(SOCIAL_SUPPORT_URL).catch(() =>
    avisar('No se ha abierto soporte', SOCIAL_SUPPORT_URL));

  const visibles = useMemo(() => board.filter((b) => b.visible), [board]);
  const ocultos = useMemo(() => board.filter((b) => !b.visible && !b.isMe), [board]);
  const ranking = useMemo(() => conInsignias(clasificar(visibles, metrica), insignias), [visibles, metrica, insignias]);
  const estado = estadoLudus(tier, miLudus);
  const ludusVisibles = useMemo(() => ludusBoard.filter((b) => b.visible), [ludusBoard]);
  const rankingLudus = useMemo(
    () => conInsignias(clasificar(ludusVisibles, metricaLudus), insignias),
    [ludusVisibles, metricaLudus, insignias],
  );
  const numAmigos = board.filter((b) => !b.isMe).length;
  const yoEnMarcador = board.find((b) => b.isMe);
  // estadoDe solo necesita mis cifras y mis logros; el rango sale de los logros.
  const miRango: Rank | null =
    logros && yoEnMarcador
      ? estadoDe({ xp_total: yoEnMarcador.xpTotal, streak_days: yoEnMarcador.streakDays, protection_stones: 0 }, logros)
          .rango
      : null;
  // A quién se puede retar o invitar a una liga: amigos aceptados.
  const amigos = useMemo<Amigo[]>(
    () => board.filter((b) => !b.isMe && b.friendshipId).map((b) => ({ userId: b.userId, name: b.name })),
    [board],
  );

  const elegirVentana = (v: Ventana) => {
    if (v === ventana) return;
    vibrar('seleccion');
    setCambiando(true);
    setVentana(v);
  };
  const elegirMetrica = (m: Metrica) => {
    if (m === metrica) return;
    vibrar('seleccion');
    // Otro criterio, otro orden: las filas se recolocan, no saltan.
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMetrica(m);
  };
  const entrantes = requests.filter((r) => r.direction === 'incoming');
  const salientes = requests.filter((r) => r.direction === 'outgoing');

  // ── Mi código ─────────────────────────────────────────────────────
  const invitar = async () => {
    if (!yo) return;
    try {
      await Share.share({ message: mensajeInvitacion(yo.friendCode) });
    } catch (e) {
      avisar('Error del sistema', mensajeSistema(e));
    }
  };

  const copiar = () => {
    if (!yo) return;
    try {
      Clipboard.setString(yo.friendCode);
      vibrar('seleccion');
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      invitar();
    }
  };

  // ── Añadir por código ─────────────────────────────────────────────
  const enviar = async () => {
    if (lock.current) return;
    // Se valida aquí antes de llamar: el servidor cuenta cada intento (30/hora)
    // y un dedo torpe no debería gastarlos.
    const problema = errorDeCodigo(codigo, yo?.friendCode);
    if (problema) {
      setAvisoCodigo({ texto: problema, error: true });
      return;
    }
    lock.current = true;
    setEnviando(true);
    setAvisoCodigo(null);
    try {
      const r = await requestFriend(normalizarCodigo(codigo));
      vibrar('mision');
      setCodigo('');
      setAvisoCodigo({
        texto:
          r.status === 'accepted'
            ? `${r.name} ya te había buscado. Ya sois rivales.`
            : `Solicitud enviada a ${r.name}. Falta su respuesta.`,
        error: false,
      });
      await load(ventana);
    } catch (e) {
      vibrar('penalizacion');
      // Los errores de negocio (código desconocido, ya sois amigos, tope) llegan
      // como ErrorVisible y pasan tal cual; lo demás, con la voz del sistema.
      setAvisoCodigo({ texto: mensajeSistema(e), error: true });
    } finally {
      lock.current = false;
      setEnviando(false);
    }
  };

  // ── Solicitudes ───────────────────────────────────────────────────
  const responder = async (r: FriendRequest, aceptar: boolean) => {
    if (lock.current) return;
    lock.current = true;
    setOcupada(r.friendshipId);
    try {
      await respondRequest(r.friendshipId, aceptar);
      if (aceptar) vibrar('mision');
      await load(ventana);
    } catch (e) {
      avisar('Error del sistema', mensajeSistema(e));
    } finally {
      lock.current = false;
      setOcupada(null);
    }
  };

  const quitar = async (friendshipId: string, titulo: string, cuerpo: string, accion: string) => {
    if (lock.current) return;
    if (!(await confirmar({ titulo, mensaje: cuerpo, confirmar: accion, destructivo: true }))) return;
    if (lock.current) return;
    lock.current = true;
    try {
      // Sin cambio optimista: la fila solo desaparece con la recarga que sigue
      // a un borrado hecho.
      await removeFriend(friendshipId);
    } catch (e) {
      avisar('Error del sistema', mensajeSistema(e));
      lock.current = false;
      return;
    }
    try {
      await load(ventana);
    } catch {
      // Quitado en el servidor; la lista se pondrá al día en el próximo foco.
    } finally {
      lock.current = false;
    }
  };

  const quitarAmigo = (b: BoardEntry) => {
    if (!b.friendshipId) return;
    quitar(
      b.friendshipId,
      'Quitar amigo',
      `${b.name} saldrá de tu ranking y tú del suyo. Para volver hará falta otra solicitud.`,
      'Quitar',
    );
  };

  // ── Ludus ─────────────────────────────────────────────────────────
  const elegirVentanaLudus = (v: Ventana) => {
    if (v === ventanaLudus) return;
    vibrar('seleccion');
    setVentanaLudus(v);
  };
  const elegirMetricaLudus = (m: Metrica) => {
    if (m === metricaLudus) return;
    vibrar('seleccion');
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMetricaLudus(m);
  };

  const pedirLudus = async () => {
    if (lock.current) return;
    if (!objetivo) {
      setAvisoLudus({ texto: 'Elige el objetivo de tu ludus.', error: true });
      return;
    }
    lock.current = true;
    setPidiendo(true);
    setAvisoLudus(null);
    try {
      await requestEliteGroup(objetivo, nota);
      vibrar('mision');
      setNota('');
      setCambiarPeticion(false);
      await loadLudus(ventanaLudus);
    } catch (e) {
      vibrar('penalizacion');
      setAvisoLudus({ texto: mensajeSistema(e), error: true });
    } finally {
      lock.current = false;
      setPidiendo(false);
    }
  };

  // ── Privacidad ────────────────────────────────────────────────────
  const cambiarVisible = async (visible: boolean) => {
    if (!userId || !yo) return;
    const antes = yo;
    setYo({ ...yo, socialVisible: visible });
    try {
      await setSocialVisible(userId, visible);
    } catch (e) {
      setYo(antes);
      avisar('Error del sistema', mensajeSistema(e));
    }
  };

  // ── Compartir la semana ───────────────────────────────────────────
  // La tarjeta es SIEMPRE de los últimos 7 días y por XP, mire lo que mire el
  // ranking: si está en "Mes" se pide la semana aparte en vez de rotular como
  // semanal una cifra de treinta días.
  const abrirTarjeta = async () => {
    if (!yo || !userId || preparando) return;
    setPreparando(true);
    try {
      const datos = await prepararDatosSemana(userId, {
        semana: ventana === 'semana' ? board : undefined,
        friendCode: yo.friendCode,
      });
      // La hoja va por la cola (capa raíz): pide el código de amigo, cierra
      // con atrás de Android y oculta lo de debajo al lector de pantalla. El
      // código solo sale si se enciende «Añadir mi enlace de invitación».
      compartir(tarjetaDeSemana(datos));
    } catch (e) {
      avisar('Error del sistema', mensajeSistema(e));
    } finally {
      setPreparando(false);
    }
  };

  // ── Invitar: insignias Reclutador (cosméticas) ───────────────────
  const reclutador = INSIGNIAS.reclutador;
  const umbralSiguiente = invitaciones?.siguienteUmbral ?? null;
  const nombreSiguiente =
    umbralSiguiente == null ? undefined : reclutador.nombres[reclutador.umbrales.indexOf(umbralSiguiente)];
  const siguienteInsignia =
    umbralSiguiente != null && nombreSiguiente ? { nombre: nombreSiguiente, umbral: umbralSiguiente } : null;
  const insigniasGanadas = (invitaciones?.insignias ?? [])
    .map((k) => reclutador.nombres[UMBRALES_INVITACION.findIndex((u) => u.kind === k)])
    .filter((n): n is string => !!n);

  const subtitulo =
    numAmigos === 0
      ? 'Nadie mejora igual cuando alguien le mira el marcador.'
      : `${numAmigos} ${numAmigos === 1 ? 'rival' : 'rivales'} en tu arena${entrantes.length > 0 ? ` · ${entrantes.length} por responder` : ''}.`;

  return (
    <Screen refreshing={refrescando} onRefresh={refrescar}>
      <Stagger>
        <FadeIn index={0}>
          <ScreenHeader
            onBack={() => volver(router)}
            eyebrow="Arena"
            title="Amigos"
            subtitle={subtitulo}
            action={yo ? { icon: 'share-social-outline', label: 'Compartir mi semana', onPress: abrirTarjeta } : undefined}
          />
        </FadeIn>

        {cargando ? (
          <View accessibilityLabel="Cargando la arena" accessibilityRole="progressbar">
            <Skeleton height={168} style={styles.huecoTarjeta} />
            <Skeleton height={11} width={150} style={styles.huecoRotulo} />
            <Skeleton height={50} style={styles.huecoTarjeta} />
            <Skeleton height={11} width={90} style={styles.huecoRotulo} />
            <SkeletonRows rows={4} />
          </View>
        ) : fallo && !yo ? (
          <Card variant="alerta">
            <EmptyState
              compact
              icon="cloud-offline-outline"
              title="La arena no responde"
              body={fallo}
              action={{ label: 'Reintentar', onPress: refrescar }}
            />
          </Card>
        ) : yo ? (
          <>
            {fallo ? (
              <Card variant="alerta">
                <Text style={styles.falloLinea} accessibilityRole="alert">
                  No se ha podido actualizar: {fallo}
                </Text>
              </Card>
            ) : null}

            <FadeIn index={1}>
              <Card>
                <Text style={styles.eyebrow}>Tu código</Text>
                <Text
                  style={styles.codigo}
                  selectable
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  accessibilityLabel={`Tu código de amigo: ${yo.friendCode.split('').join(' ')}`}
                >
                  {codigoLegible(yo.friendCode)}
                </Text>
                <Text style={styles.hint}>
                  Quien lo tenga puede pedirte amistad. Verá tu nivel, tu racha y tu cumplimiento; nunca tu salud, tu
                  dinero ni tu diario.
                </Text>
                <View style={styles.botones}>
                  <View style={styles.boton}>
                    <SystemButton
                      title={copiado ? 'Copiado' : 'Copiar'}
                      icon={copiado ? 'checkmark' : 'copy-outline'}
                      variant="outline"
                      onPress={copiar}
                    />
                  </View>
                  <View style={styles.boton}>
                    {/* Una sola inversión por pantalla: la de "Invitar al primero"
                        del ranking vacío. Este va siempre en contorno. */}
                    <SystemButton title="Invitar" icon="paper-plane-outline" variant="outline" onPress={invitar} />
                  </View>
                </View>
              </Card>
            </FadeIn>

            {invitaciones ? (
              <FadeIn index={2}>
                <Section title="Tus invitados">
                  <Card>
                    <StatRow>
                      <Stat value={invitaciones.activos} label="Invitados activos" style={styles.celda} />
                      <Stat value={invitaciones.pendientes} label="En prueba" style={styles.celda} />
                    </StatRow>
                    {siguienteInsignia ? (
                      <Text style={styles.siguienteInsignia}>
                        Siguiente insignia: {siguienteInsignia.nombre} con {siguienteInsignia.umbral} invitados activos
                      </Text>
                    ) : null}
                    {insigniasGanadas.length > 0 ? (
                      <View style={styles.insignias}>
                        {insigniasGanadas.map((nombre) => (
                          <Tag key={nombre} tone="logro">
                            {nombre}
                          </Tag>
                        ))}
                      </View>
                    ) : null}
                  </Card>
                  <Text style={styles.hint}>
                    Cuenta quien entra con tu código y está activo 3 días en sus primeras dos semanas. Es una insignia: no
                    da XP ni días de Pro.
                  </Text>
                </Section>
              </FadeIn>
            ) : null}

            <FadeIn index={2}>
              <Section title="Añadir por código">
                <View style={styles.anadirFila}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={codigo}
                    onChangeText={(v) => {
                      setCodigo(normalizarCodigo(v));
                      setAvisoCodigo(null);
                    }}
                    placeholder="ABCD2345"
                    placeholderTextColor={colors.textFaint}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={LARGO_CODIGO}
                    returnKeyType="send"
                    onSubmitEditing={enviar}
                    accessibilityLabel="Código de amigo, ocho caracteres"
                  />
                  <SystemButton
                    title="Enviar"
                    variant="outline"
                    onPress={enviar}
                    loading={enviando}
                    disabled={codigo.length === 0}
                  />
                </View>
                {avisoCodigo ? <Aviso texto={avisoCodigo.texto} error={avisoCodigo.error} /> : null}
              </Section>
            </FadeIn>

            {requests.length > 0 ? (
              <FadeIn index={3}>
                <Section title="Solicitudes" meta={entrantes.length > 0 ? `${entrantes.length}` : undefined}>
                  <Card padded={false} style={styles.lista}>
                    {entrantes.map((r, i) => (
                      <Row
                        key={r.friendshipId}
                        first={i === 0}
                        leading={<Ionicons name="person-add-outline" size={18} color={colors.accent} />}
                        title={r.name}
                        detail={`Nivel ${r.level} · quiere medirse contigo`}
                        // Aceptar a la derecha y rechazar como un aspa: dos chips
                        // con texto dejaban al nombre en dos letras a 375 px.
                        trailing={
                          ocupada === r.friendshipId ? (
                            <ActivityIndicator size="small" color={colors.accent} />
                          ) : (
                            <View style={styles.respuestas}>
                              <SafetyButton name={r.name} onPress={() => abrirSeguridad(r)} />
                              <Button title="Aceptar" size="sm" variant="secondary" onPress={() => responder(r, true)} />
                              <Pressable
                                onPress={() => responder(r, false)}
                                hitSlop={10}
                                style={({ pressed }) => [styles.rechazar, pressed && styles.pulsado]}
                                accessibilityRole="button"
                                accessibilityLabel={`Rechazar la solicitud de ${r.name}`}
                              >
                                <Ionicons name="close" size={18} color={colors.textDim} />
                              </Pressable>
                            </View>
                          )
                        }
                      />
                    ))}
                    {salientes.map((r, i) => (
                      <Row
                        key={r.friendshipId}
                        first={entrantes.length === 0 && i === 0}
                        leading={<Ionicons name="hourglass-outline" size={18} color={colors.textFaint} />}
                        title={r.name}
                        muted
                        detail={`Nivel ${r.level} · esperando su respuesta`}
                        trailing={
                          <View style={styles.respuestas}>
                          <SafetyButton name={r.name} onPress={() => abrirSeguridad(r)} />
                          <Chip
                            label="Retirar"
                            small
                            onPress={() =>
                              quitar(r.friendshipId, 'Retirar solicitud', `${r.name} dejará de verla.`, 'Retirar')
                            }
                            accessibilityLabel={`Retirar la solicitud enviada a ${r.name}`}
                          />
                          </View>
                        }
                      />
                    ))}
                  </Card>
                </Section>
              </FadeIn>
            ) : null}

            {estado !== 'fuera' ? (
              <FadeIn index={4}>
                <Section
                  title="Tu ludus"
                  tone="logro"
                  meta={miLudus.group ? `${miLudus.group.members}/${miLudus.group.capacity}` : undefined}
                >
                  {estado === 'miembro' && miLudus.group ? (
                    <>
                      <View style={styles.ludusCabecera}>
                        <Text style={styles.ludusNombre} numberOfLines={1}>
                          {miLudus.group.name}
                        </Text>
                        <Text style={styles.ludusLinea}>{lineaLudus(miLudus.group)}</Text>
                      </View>
                      <View style={styles.segmento} accessibilityRole="radiogroup" accessibilityLabel="Periodo del ludus">
                        {VENTANAS.map((v) => (
                          <Chip
                            key={v.key}
                            label={v.label}
                            selected={ventanaLudus === v.key}
                            onPress={() => elegirVentanaLudus(v.key)}
                            style={styles.segmentoChip}
                            accessibilityLabel={`Ludus de ${v.key === 'semana' ? 'los últimos 7 días' : 'los últimos 30 días'}`}
                          />
                        ))}
                      </View>
                      <ChipWrap style={styles.metricas}>
                        {METRICAS.map((m) => (
                          <Chip
                            key={m}
                            label={METRICA_LABEL[m]}
                            small
                            tone="accent"
                            selected={metricaLudus === m}
                            onPress={() => elegirMetricaLudus(m)}
                            accessibilityLabel={`Ordenar el ludus por ${METRICA_LABEL[m]}`}
                          />
                        ))}
                      </ChipWrap>
                      <Text style={styles.rivalidad} accessibilityLiveRegion="polite">
                        {ludusVisibles.length < 2
                          ? 'Tu ludus aún se está formando. El sistema suma gladiadores de tu mismo objetivo.'
                          : lineaRivalidad(rankingLudus, metricaLudus, ventanaLudus)}
                      </Text>
                      <ListaRanking
                        filas={rankingLudus}
                        metrica={metricaLudus}
                        onSafety={abrirSeguridad}
                        miRango={miRango}
                        rangos={rangos}
                      />
                      <Text style={styles.hint}>
                        Las mismas cifras que el ranking de amigos: las penalizaciones no cuentan y nadie compra
                        puestos. Sin chat: en el ludus se compite con hechos.
                      </Text>
                    </>
                  ) : estado === 'pedido' && !cambiarPeticion ? (
                    <Card variant="outline">
                      <EmptyState
                        compact
                        icon="hourglass-outline"
                        title="Petición registrada"
                        body={`Objetivo: ${kindMeta(miLudus.requestedGoal ?? 'general').label.toLowerCase()}. Cada ludus se forma a mano, con ${LUDUS_MIN} a ${LUDUS_MAX} gladiadores Élite del mismo objetivo. Aparecerá aquí.`}
                        action={{
                          label: 'Cambiar la petición',
                          onPress: () => {
                            setObjetivo(miLudus.requestedGoal);
                            setCambiarPeticion(true);
                          },
                        }}
                      />
                    </Card>
                  ) : (
                    <Card>
                      <Text style={styles.ludusIntro}>
                        Un ludus es tu escuela de gladiadores: de {LUDUS_MIN} a {LUDUS_MAX} Élite con el mismo
                        objetivo, midiéndose cada semana. Sin chat ni ruido, solo el marcador. Elige el tuyo y el
                        sistema te asigna plaza.
                      </Text>
                      <ChipWrap style={styles.metricas}>
                        {OBJETIVOS_LUDUS.map((k) => (
                          <Chip
                            key={k}
                            label={kindMeta(k).label}
                            small
                            selected={objetivo === k}
                            onPress={() => {
                              setObjetivo(k);
                              setAvisoLudus(null);
                            }}
                            accessibilityLabel={`Objetivo del ludus: ${kindMeta(k).label}`}
                          />
                        ))}
                      </ChipWrap>
                      <TextInput
                        style={styles.nota}
                        value={nota}
                        onChangeText={setNota}
                        placeholder="Qué persigues ahora mismo (opcional)"
                        placeholderTextColor={colors.textFaint}
                        multiline
                        maxLength={NOTA_LUDUS_MAX}
                        accessibilityLabel="Nota para tu ludus, opcional"
                      />
                      <Text style={styles.contador}>
                        {nota.length}/{NOTA_LUDUS_MAX}
                      </Text>
                      <SystemButton
                        title="Pedir plaza"
                        icon="shield-outline"
                        variant="outline"
                        onPress={pedirLudus}
                        loading={pidiendo}
                        style={{ marginTop: 12 }}
                      />
                      {avisoLudus ? <Aviso texto={avisoLudus.texto} error={avisoLudus.error} /> : null}
                    </Card>
                  )}
                </Section>
              </FadeIn>
            ) : null}

            <FadeIn index={5}>
              <Section title="Ranking" meta={numAmigos > 0 ? `${visibles.length}` : undefined}>
                {numAmigos === 0 ? (
                  <Card variant="outline">
                    <EmptyState
                      icon="people-outline"
                      title="Tu arena está vacía"
                      body="A solas se afloja. Con un rival mirando, el día que ibas a saltarte se cumple. Pásale tu código a quien te apriete de verdad: basta uno."
                      action={{ label: 'Invitar al primero', onPress: invitar, variant: 'solid' }}
                    />
                  </Card>
                ) : (
                  <>
                    <View style={styles.segmento} accessibilityRole="radiogroup" accessibilityLabel="Periodo del ranking">
                      {VENTANAS.map((v) => (
                        <Chip
                          key={v.key}
                          label={v.label}
                          selected={ventana === v.key}
                          onPress={() => elegirVentana(v.key)}
                          style={styles.segmentoChip}
                          accessibilityLabel={`Ranking de ${v.key === 'semana' ? 'los últimos 7 días' : 'los últimos 30 días'}`}
                        />
                      ))}
                    </View>
                    <ChipWrap style={styles.metricas}>
                      {METRICAS.map((m) => (
                        <Chip
                          key={m}
                          label={METRICA_LABEL[m]}
                          small
                          tone="accent"
                          selected={metrica === m}
                          onPress={() => elegirMetrica(m)}
                          accessibilityLabel={`Ordenar por ${METRICA_LABEL[m]}`}
                        />
                      ))}
                    </ChipWrap>

                    <Text style={styles.rivalidad} accessibilityLiveRegion="polite">
                      {lineaRivalidad(ranking, metrica, ventana)}
                    </Text>

                    <ListaRanking
                      filas={ranking}
                      metrica={metrica}
                      atenuado={cambiando}
                      onLongPress={quitarAmigo}
                      onSafety={abrirSeguridad}
                      miRango={miRango}
                      rangos={rangos}
                    />
                    <Text style={styles.hint}>
                      {metrica === 'xp'
                        ? 'XP ganado con misiones en el periodo. Las de penalización no cuentan: recuperar no es adelantar.'
                        : metrica === 'cumplimiento'
                          ? 'Misiones cumplidas sobre programadas. Lo de hoy solo suma cuando lo cumples.'
                          : 'Días seguidos cerrados. Es la única cifra que no depende del periodo.'}{' '}
                      Mantén pulsado a alguien para quitarle.
                    </Text>
                    <SystemButton
                      title="Compartir mi semana"
                      icon="share-social-outline"
                      variant="outline"
                      onPress={abrirTarjeta}
                      loading={preparando}
                      style={{ marginTop: 14 }}
                    />
                  </>
                )}
              </Section>
            </FadeIn>

            <FadeIn index={6}>
              <Competicion
                amigos={amigos}
                recarga={recarga}
                retarA={retarA}
                onRetarA={setRetarA}
                onDisponible={setCompeticion}
              />
            </FadeIn>

            {ocultos.length > 0 ? (
              <FadeIn index={6}>
                <Section title="Fuera del ranking" meta={`${ocultos.length}`}>
                  <Card padded={false} style={styles.lista}>
                    {ocultos.map((b, i) => (
                      <Row
                        key={b.userId}
                        first={i === 0}
                        leading={<Ionicons name="eye-off-outline" size={18} color={colors.textFaint} />}
                        title={b.name}
                        muted
                        detail="Ha ocultado su marcador. Sigue siendo tu amigo."
                        trailing={<SafetyButton name={b.name} onPress={() => abrirSeguridad(b)} />}
                        onPress={() => abrirSeguridad(b)}
                        onLongPress={() => quitarAmigo(b)}
                        accessibilityLabel={`${b.name}, fuera del ranking. Toca para denunciar o bloquear. Mantén pulsado para quitar.`}
                      />
                    ))}
                  </Card>
                </Section>
              </FadeIn>
            ) : null}

            <Section title="Convivencia y seguridad">
              <Text style={styles.safetyText}>No se permite acoso, amenazas, suplantación ni contenido ofensivo. Los nombres, títulos y fotos se revisan antes de mostrarse a otros: mientras tanto verán un alias y una imagen neutros. Tu perfil conserva tus datos.</Text>
              <SystemButton title="Contactar con soporte" icon="help-circle-outline" variant="outline" onPress={abrirSoporte} style={{ marginTop: 12 }} />
              {blockedUsers.length > 0 ? <Card padded={false} style={styles.lista}>
                {blockedUsers.map((person, i) => <Row key={person.userId} first={i === 0} title={person.name}
                  detail="Usuario bloqueado" trailing={<Chip label="Desbloquear" small disabled={safetyBusy} onPress={() => desbloquear(person)} />} />)}
              </Card> : null}
            </Section>

            <FadeIn index={7}>
              <Section title="Privacidad">
                <Card padded={false} style={styles.lista}>
                  <Row
                    first
                    leading={<Ionicons name={yo.socialVisible ? 'eye-outline' : 'eye-off-outline'} size={18} color={colors.textDim} />}
                    title="Aparecer en los rankings"
                    detail={
                      yo.socialVisible
                        ? 'Tus amigos ven tu nivel, tu racha, tu XP del periodo y tu cumplimiento. Nada más.'
                        : 'Estás fuera: tus amigos no ven tus cifras ni tu retrato. Tú sigues viendo las suyas.'
                    }
                    trailing={
                      <Interruptor
                        value={yo.socialVisible}
                        onValueChange={cambiarVisible}
                        accessibilityLabel="Aparecer en los rankings de tus amigos"
                      />
                    }
                  />
                </Card>
              </Section>
            </FadeIn>
          </>
        ) : null}
      </Stagger>

      <Modal visible={safetyUser !== null} transparent animationType="slide" onRequestClose={() => { if (!safetyBusy) setSafetyUser(null); }}>
        <View style={styles.safetyBackdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => { if (!safetyBusy) setSafetyUser(null); }} accessibilityLabel="Cerrar seguridad" accessibilityRole="button" />
          <ScrollView style={styles.safetySheet} contentContainerStyle={{ padding: 20, paddingBottom: 34 }} accessibilityViewIsModal>
            <Text style={styles.safetyTitle}>{safetyUser?.name}</Text>
            {competicion && safetyUser && amigos.some((a) => a.userId === safetyUser.userId) ? (
              <SystemButton
                title="Retar a un duelo"
                icon="flash-outline"
                variant="outline"
                disabled={safetyBusy}
                onPress={() => {
                  const rival = amigos.find((a) => a.userId === safetyUser.userId) ?? null;
                  setSafetyUser(null);
                  // La hoja del duelo es otro Modal: en iOS no se presenta
                  // mientras este aún se está cerrando.
                  setTimeout(() => setRetarA(rival), 350);
                }}
                style={{ marginTop: 14 }}
              />
            ) : null}
            <Text style={[styles.eyebrow, { marginTop: 22 }]}>Seguridad</Text>
            <Text style={styles.safetyText}>Elige qué quieres denunciar. El equipo revisará el perfil y podrá retirar contenido o suspender su acceso social.</Text>
            <ChipWrap style={{ marginTop: 16 }}>
              {REPORT_REASONS.map((reason) => <Chip key={reason.value} label={reason.label}
                selected={reportReason === reason.value} disabled={safetyBusy} onPress={() => setReportReason(reason.value)} />)}
            </ChipWrap>
            {safetyMessage ? <Text style={styles.safetyText} accessibilityRole="alert">{safetyMessage}</Text> : null}
            <SystemButton title="Enviar denuncia" icon="flag-outline" variant="outline" disabled={!reportReason || safetyBusy} loading={safetyBusy}
              onPress={denunciar} style={{ marginTop: 16 }} />
            <SystemButton title="Bloquear usuario" icon="ban-outline" variant="outline" disabled={safetyBusy} onPress={bloquear} style={{ marginTop: 10 }} />
            <SystemButton title="Contactar con soporte" variant="ghost" disabled={safetyBusy} onPress={abrirSoporte} />
            <SystemButton title="Cerrar" variant="ghost" disabled={safetyBusy} onPress={() => setSafetyUser(null)} />
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safetyButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  safetyBackdrop: { flex: 1, backgroundColor: colors.bg, justifyContent: 'flex-end' },
  safetySheet: { maxHeight: '85%', backgroundColor: colors.panel, borderTopWidth: 1, borderTopColor: colors.line },
  safetyTitle: { color: colors.text, fontFamily: fonts.heading, fontSize: 20 },
  safetyText: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginTop: 10 },
  lista: { paddingHorizontal: 16, paddingVertical: 2 },
  huecoTarjeta: { marginBottom: 26 },
  huecoRotulo: { marginBottom: 12 },
  atenuado: { opacity: 0.45 },
  rechazar: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  pulsado: { opacity: 0.6 },
  falloLinea: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: ink.ink9 },
  eyebrow: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  codigo: {
    fontFamily: fonts.brand,
    fontSize: 38,
    letterSpacing: 6,
    color: colors.accent,
    marginTop: 10,
  },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 10, lineHeight: 17 },
  botones: { flexDirection: 'row', gap: 8, marginTop: 16 },
  celda: { flex: 1 },
  siguienteInsignia: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: ink.ink8, marginTop: 14 },
  insignias: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  boton: { flex: 1 },
  anadirFila: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  input: {
    borderWidth: 1,
    borderColor: colors.accentDim,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.number,
    fontSize: 17,
    letterSpacing: 3,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  respuestas: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  segmento: { flexDirection: 'row', gap: 8 },
  segmentoChip: { flex: 1, justifyContent: 'center' },
  metricas: { marginTop: 10 },
  rivalidad: {
    fontFamily: fonts.semibold,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.text,
    marginTop: 16,
    marginBottom: 12,
  },
  // Mi fila: un fondo un punto más claro que sangra hasta los bordes de la
  // tarjeta (la lista lleva 16 de padding) y un filo blanco a la izquierda.
  miFila: {
    backgroundColor: colors.accentFaint,
    marginHorizontal: -16,
    paddingHorizontal: 14,
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
  },
  puesto: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  puestoTexto: { width: 30, fontFamily: fonts.number, fontSize: 13, color: colors.textDim },
  oro: { color: ink.ink10 },
  detalle: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  detalleTexto: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textFaint },
  ludusCabecera: { marginBottom: 14 },
  ludusNombre: { fontFamily: fonts.heading, fontSize: 20, color: colors.text },
  ludusLinea: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, marginTop: 2 },
  ludusIntro: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.textDim },
  nota: {
    borderWidth: 1,
    borderColor: colors.accentDim,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 84,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 14,
    textAlignVertical: 'top',
  },
  contador: { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint, marginTop: 6, textAlign: 'right' },
});

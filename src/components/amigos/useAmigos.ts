// NIVL · Amigos: los datos y los efectos (L-RADICAL §C, E4).
//
// Cortado y pegado tal cual de src/app/amigos.tsx: cargas por foco, cerrojos,
// bloqueo con confirmación, ludus, invitaciones y la tarjeta de la semana. La
// vista (AmigosVista) es pura y recibe `vista`; la ruta pinta además la hoja
// de seguridad con `hojas` y mete <Competicion> como slot con `competicion`.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  // Clipboard sigue en el núcleo de RN 0.81 (módulo nativo incluido). Está
  // marcado como obsoleto, pero la alternativa es una dependencia nueva y un
  // build nativo solo para copiar ocho letras. Si un día desaparece, `copiar`
  // cae al compartir del sistema, que también deja copiar.
  Clipboard,
  LayoutAnimation,
  Linking,
  Share,
} from 'react-native';
import { prepararDatosSemana, tarjetaDeSemana } from '@/components/ShareCardSemana';
import { useCelebracion } from '@/components/celebracion/contexto';
import { avisar, confirmar } from '@/components/ui/confirmar';
import { volver } from '@/components/ui/Screen';
import { vibrar } from '@/design/haptics';
import type { Rank } from '@/design/tokens';
import { fetchUnlocked, tituloVigente } from '@/lib/achievements';
import { fetchRangosAmigos } from '@/lib/amigosRango';
import { useAuth } from '@/lib/auth';
import { conInsignias, estadoLudus, SIN_LUDUS, type MiLudus } from '@/lib/elite';
import { fetchMyInvites, UMBRALES_INVITACION, type MyInvites } from '@/lib/invites';
import type { ProfileKind } from '@/lib/kinds';
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
  DIAS_VENTANA,
  errorDeCodigo,
  mensajeInvitacion,
  normalizarCodigo,
  type Metrica,
  type Ventana,
} from '@/lib/socialmath';
import { SOCIAL_SUPPORT_URL, type ReportReason } from '@/lib/socialSafety';
import { mensajeSistema } from '@/lib/validation';
import type { Amigo } from './Competicion';
import type { FilaRanking } from './ListaRanking';

function conTitulo(filas: readonly (Clasificado<BoardEntry> & { insignia: boolean })[]): FilaRanking[] {
  return filas.map((f) => ({ ...f, titulo: tituloVigente(f.competidor.equippedTitle) }));
}

export function useAmigos() {
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

  // El título equipado se resuelve aquí (achievements arrastra Supabase): la
  // vista y la lista lo reciben ya escrito.
  const rankingConTitulo = useMemo(() => conTitulo(ranking), [ranking]);
  const rankingLudusConTitulo = useMemo(() => conTitulo(rankingLudus), [rankingLudus]);

  return {
    vista: {
      refrescando,
      refrescar,
      onVolver: () => volver(router),
      abrirTarjeta,
      preparando,
      yo,
      subtitulo,
      cargando,
      fallo,
      copiado,
      copiar,
      invitar,
      invitaciones,
      siguienteInsignia,
      insigniasGanadas,
      codigo,
      setCodigo,
      setAvisoCodigo,
      enviar,
      enviando,
      avisoCodigo,
      requests,
      entrantes,
      salientes,
      ocupada,
      abrirSeguridad,
      responder,
      quitar,
      estado,
      miLudus,
      ventanaLudus,
      elegirVentanaLudus,
      metricaLudus,
      elegirMetricaLudus,
      ludusVisibles,
      rankingLudus: rankingLudusConTitulo,
      miRango,
      rangos,
      cambiarPeticion,
      setCambiarPeticion,
      objetivo,
      setObjetivo,
      setAvisoLudus,
      nota,
      setNota,
      pidiendo,
      pedirLudus,
      avisoLudus,
      numAmigos,
      visibles,
      ventana,
      elegirVentana,
      metrica,
      elegirMetrica,
      ranking: rankingConTitulo,
      cambiando,
      quitarAmigo,
      ocultos,
      abrirSoporte,
      blockedUsers,
      safetyBusy,
      desbloquear,
      cambiarVisible,
    },
    competicion: { amigos, recarga, retarA, onRetarA: setRetarA, onDisponible: setCompeticion },
    hojas: {
      safetyUser,
      setSafetyUser,
      safetyBusy,
      competicion,
      amigos,
      setRetarA,
      reportReason,
      setReportReason,
      safetyMessage,
      denunciar,
      bloquear,
      abrirSoporte,
    },
  };
}

export type DatosAmigos = ReturnType<typeof useAmigos>;

import { useHealthConsent } from '@/components/ConsentimientoSalud';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCelebracion } from '@/components/celebracion/contexto';
import { CompletarSheet, type ModoCompletar } from '@/components/CompletarSheet';
import { OrdenDelDia } from '@/components/OrdenDelDia';
import { lineaEnJuego } from '@/components/hoy/enJuego';
import { PanelHoy } from '@/components/hoy/PanelHoy';
import { TarjetaRango } from '@/components/hoy/TarjetaRango';
import { QuestItem } from '@/components/QuestItem';
import { prepararDatosSemana, ShareSemanaModal, type DatosSemana } from '@/components/ShareCardSemana';
import {
  Button,
  Card,
  EmptyState,
  FadeIn,
  ProgressRing,
  Row,
  Screen,
  ScreenHeader,
  Section,
  Skeleton,
  SkeletonRows,
  Stagger,
  useAlVolver,
} from '@/components/ui';
import { avisar, confirmar } from '@/components/ui/confirmar';
import { useMovimientoReducido } from '@/components/ui/motion';
import { vibrar } from '@/design/haptics';
import { cabeAside } from '@/design/responsive';
import { ink, type as tipo } from '@/design/tokens';
import { useAnchoUtil, useNavActual } from '@/design/useSizeClass';
import {
  ACHIEVEMENT_BY_CODE,
  evaluateAchievements,
  fetchUnlocked,
  sincronizarRangoDetalle,
  unlockAchievements,
  type AchievementDef,
} from '@/lib/achievements';
import { tocarApertura } from '@/lib/apertura';
import { useAuth } from '@/lib/auth';
import {
  completionStats,
  ensureProfile,
  fetchCompletionsForDate,
  fetchCompletionsSince,
  fetchQuests,
} from '@/lib/data';
import { fetchPlan, horaAMinutos, setBlockDone, type DayBlock, type PlanConBloques } from '@/lib/dayplan';
import { addDays, dateKey, formatLongDate, isValidKey, nombreDia } from '@/lib/dates';
import { completeQuest, processPendingDays, questsScheduledOn, type DayCloseResult } from '@/lib/engine';
import { enJuegoHoy, rachaVisible, recuperacionDesbloqueada, rotosSeguidosAntes } from '@/lib/closing';
import { levelFromXp } from '@/lib/game';
import { modulesFor } from '@/lib/kinds';
import { RUTA_DE_ACTO } from '@/lib/links';
import { compararRangos, estadoDe, type LogroInfo, type RangoId } from '@/lib/progression';
import {
  inicializarAvisos,
  programarDespertador,
  reconciliarAvisosDelDia,
} from '@/lib/notifications';
import { fetchAiStatus, isPro } from '@/lib/pro';
import { registrarDispositivo } from '@/lib/push';
import { fetchBoard, type BoardEntry } from '@/lib/social';
import { clasificar, DIAS_VENTANA, lineaRivalidad } from '@/lib/socialmath';
import { colors, fonts } from '@/lib/theme';
import { mensajeSistema } from '@/lib/validation';
import { voice } from '@/lib/voice';
import type { Completion, Profile, Quest } from '@/lib/types';

function saludo(nombre: string): string {
  const h = new Date().getHours();
  const franja = h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  return `${franja}, ${nombre}.`;
}

// Hueco de la rejilla de módulos y lado de referencia de un azulejo: cuatro
// por fila como poco, y más cuando la rejilla es ancha.
const HUECO_MODULOS = 8;
const LADO_MODULO = 112;

/** Un logro registrado, en la forma del contrato de celebraciones. */
const logroInfo = (a: AchievementDef): LogroInfo => ({ codigo: a.code, nombre: a.name, desc: a.desc, titulo: a.title });

/** Un código suelto (p. ej. `rango_C` de sync_rank) en la forma del contrato. */
const logroDeCodigo = (codigo: string): LogroInfo => {
  const def = ACHIEVEMENT_BY_CODE[codigo];
  return def ? logroInfo(def) : { codigo, nombre: codigo, desc: '' };
};

// Lo último que se supo de si la cuenta tiene coach. Vive fuera del componente
// para que volver a la pestaña no repinte Hoy "sin saberlo" medio segundo.
let ultimoPro: boolean | null = null;

/** Rango más alto de una lista de códigos `rango_X` (null si no hay ninguno). */
function rangoMasAlto(codigos: string[]): RangoId | null {
  let max: RangoId | null = null;
  for (const c of codigos) {
    const m = /^rango_([EDCBAS])$/.exec(c);
    if (!m) continue;
    const r = m[1] as RangoId;
    if (max === null || compararRangos(r, max) > 0) max = r;
  }
  return max;
}

/** Da tiempo a que la hoja (un Modal) termine de cerrarse antes de abrir la cámara: en iOS, presentar encima de un modal que se está yendo no abre nada. */
const esperarCierreDeHoja = () => new Promise<void>((ok) => setTimeout(ok, 420));

export default function Hoy() {
  const health = useHealthConsent();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [todayQuests, setTodayQuests] = useState<Quest[]>([]);
  const [completions, setCompletions] = useState<Record<string, Completion>>({});
  const [dayResult, setDayResult] = useState<DayCloseResult | null>(null);
  const [busyQuestId, setBusyQuestId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // XP, nivel, racha, logros y rango van por la cola global de celebraciones:
  // una principal y un resumen por acción, nunca dos avisos a la vez.
  const { celebrar } = useCelebracion();
  // Logros conocidos (de ellos sale el rango de «antes» de cada acción).
  const logrosRef = useRef<Set<string> | null>(null);
  const [plan, setPlan] = useState<PlanConBloques | null>(null);
  const [showMore, setShowMore] = useState(false);
  // Hasta la primera carga no se sabe si hay misiones o plan: se pintan huecos,
  // no un "Nada programado" que medio segundo después es mentira.
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [esPro, setEsPro] = useState<boolean | null>(ultimoPro);
  const [board, setBoard] = useState<BoardEntry[] | null>(null);
  const [sheetQuest, setSheetQuest] = useState<Quest | null>(null);
  const [diaPerfecto, setDiaPerfecto] = useState(false);
  // RET-03: la misión recién completada ha abierto la recuperación.
  const [avisoRecuperacion, setAvisoRecuperacion] = useState(false);
  const [tarjeta, setTarjeta] = useState<DatosSemana | null>(null);
  const [preparandoTarjeta, setPreparandoTarjeta] = useState(false);
  // Rango vigente (estadoDe con los logros). null = aún no se sabe: hueco.
  const [rango, setRango] = useState<RangoId | null>(null);
  // Días rotos seguidos antes de hoy (solo con la racha a cero, RET-02): con
  // ellos enJuegoHoy sabe si hoy ya no costaría XP.
  const [rotosPrevios, setRotosPrevios] = useState(0);
  // Ancho real de la rejilla de módulos (onLayout), no el de la ventana.
  const [anchoRejilla, setAnchoRejilla] = useState(0);
  const pulso = useRef(new Animated.Value(1)).current;
  const reducido = useMovimientoReducido();
  const ancho = useAnchoUtil();
  // La Agenda se ofrece desde aquí solo con la barra inferior de verdad en
  // pantalla (sale del ancho de la ventana, no del hueco tras el raíl).
  const navActual = useNavActual();
  // Con el panel lateral (expanded), rango y rivalidad van ahí y no se repiten.
  const conPanel = cabeAside(ancho);
  // El cierre que ya ha vibrado: processPendingDays puede devolver el mismo
  // resultado a dos cargas seguidas (cierre en vuelo compartido).
  const cierreVibrado = useRef<DayCloseResult | null>(null);
  // La misión de la hoja, también en ref: se vacía de forma SÍNCRONA al elegir
  // para que un doble toque en una opción no complete dos veces.
  const sheetRef = useRef<Quest | null>(null);

  // Espejo síncrono de `completions`: dos misiones completadas seguidas leían
  // el mismo estado viejo y ninguna veía que era la última (día perfecto) o
  // la que abría la recuperación.
  const completionsRef = useRef<Record<string, Completion>>({});

  const completing = useRef<Set<string>>(new Set());

  /**
   * Pide al servidor el rango merecido y cierra la ventana de la acción: el
   * rango nuevo llega a la cola como logro `rango_X` (la ceremonia la pinta el
   * proveedor). No bloquea nada ni lanza; si sube, recarga el rango que se enseña.
   */
  const sincronizar = useCallback((prof: Profile, accion: string) => {
    sincronizarRangoDetalle()
      .catch(() => ({ nuevos: [] as string[], diasActivos: null }))
      .then(({ nuevos }) => {
        celebrar({ accion, logrosNuevos: nuevos.map(logroDeCodigo), final: true });
        const letra = rangoMasAlto(nuevos);
        if (!letra) return;
        if (logrosRef.current) for (const c of nuevos) logrosRef.current.add(c);
        fetchUnlocked()
          .then((logros) => {
            logrosRef.current = logros;
            setRango(estadoDe(prof, logros).rango);
          })
          .catch(() => setRango((r) => (r && compararRangos(r, letra) > 0 ? r : letra)));
      })
      .catch(() => {});
  }, [celebrar]);

  const load = useCallback(async () => {
    if (!userId) return;
    // Última apertura del día (avisos del servidor). Accesorio: no se espera.
    tocarApertura().catch(() => {});
    // Lo accesorio va por su cuenta y nunca bloquea ni tumba Hoy: si la cuenta
    // tiene coach (decide qué se ofrece cuando no hay plan) y el marcador de
    // amigos (la línea de rivalidad).
    fetchAiStatus()
      .then((s) => {
        ultimoPro = isPro(s);
        setEsPro(ultimoPro);
      })
      .catch(() => {});
    fetchBoard(DIAS_VENTANA.semana)
      .then(setBoard)
      .catch(() => {});
    try {
      // Aquí NO se siembran misiones por defecto: quien eligió "Empezar sin
      // misiones" en el onboarding, o borró las suyas, ve el estado vacío.
      // Las misiones se leen por RLS y no dependen de que el perfil exista:
      // las dos lecturas van a la vez.
      // Los logros (de ellos sale el rango) van a la vez y no tumban Hoy.
      const [perfil, misiones, logros] = await Promise.all([
        ensureProfile(userId),
        fetchQuests(),
        fetchUnlocked().catch(() => null),
      ]);
      let quests = misiones;
      if (logros) logrosRef.current = new Set(logros);
      const { profile: prof, result } = await processPendingDays(perfil, quests);
      // El cierre ya está aplicado: perfil e informe se enseñan pase lo que
      // pase después. Antes un fallo en lo que sigue (los logros, las
      // completadas) acababa en loadError y el informe del cierre se perdía.
      setProfile(prof);
      // Siempre (incluido null): un null borra el aviso de cierre de ayer, que
      // antes se quedaba pegado indefinidamente al cambiar de pestaña.
      setDayResult(result);
      // Los logros también se ganan en el cierre: subir de nivel por una
      // penalización recuperada o cruzar un hito de racha cuenta igual que
      // completar una misión. Accesorio: no se espera ni puede tumbar Hoy.
      if (result) {
        // El cierre es una acción más de la cola: la racha hito, la piedra y
        // los logros del cierre los decide el contrato con los perfiles de
        // antes y después.
        const accion = `cierre:${Date.now()}`;
        celebrar({
          accion,
          perfilAntes: perfil,
          perfilDespues: prof,
          logrosAntes: logros ?? undefined,
          fecha: dateKey(),
        });
        completionStats()
          .then((stats) =>
            unlockAchievements(
              userId,
              evaluateAchievements({
                totalCompletions: stats.total,
                evidenceCount: stats.withEvidence,
                streak: prof.streak_days,
                level: levelFromXp(prof.xp_total).level,
                penaltyRedeemed: false,
              }),
            ),
          )
          .then((fresh) => {
            if (fresh.length === 0) return;
            if (logrosRef.current) for (const a of fresh) logrosRef.current.add(a.code);
            celebrar({ accion, logrosNuevos: fresh.map(logroInfo) });
          })
          .catch(() => {})
          .finally(() => sincronizar(prof, accion));
        if ((result.penaltyXp > 0 || result.streakLost) && cierreVibrado.current !== result) {
          cierreVibrado.current = result;
          vibrar('penalizacion');
        }
      }
      if (result && result.penaltyXp > 0) {
        quests = await fetchQuests();
      }
      const today = dateKey();
      const todasLasMisiones = quests;
      const [done, planDeHoy, rotos] = await Promise.all([
        fetchCompletionsForDate(today),
        fetchPlan(today).catch(() => null),
        // Solo hace falta con la racha a cero; si falla, 0 (lo prudente: la
        // línea dirá que cuesta XP).
        prof.streak_days === 0
          ? fetchCompletionsSince(addDays(today, -8))
              .then((cs) =>
                rotosSeguidosAntes({
                  fromDate: today,
                  quests: todasLasMisiones,
                  completedKeys: new Set(cs.map((c) => `${c.date}|${c.quest_id}`)),
                  freezeUntil: prof.freeze_until,
                }),
              )
              .catch(() => 0)
          : Promise.resolve(0),
      ]);
      const map: Record<string, Completion> = {};
      for (const c of done) map[c.quest_id] = c;

      setRotosPrevios(rotos);
      // Contrato del Chat 5: el rango sale de estadoDe aunque sin la 0051 sea E.
      if (logros) setRango(estadoDe(prof, logros).rango);
      else setRango((r) => r ?? 'E');
      setPlan(planDeHoy);
      setTodayQuests(questsScheduledOn(quests, today));
      completionsRef.current = map;
      setCompletions(map);
      setLoadError(null);
    } catch (e) {
      // En línea y con reintento, no en una alerta del sistema operativo: Hoy
      // se recarga en cada foco y sin red la alerta saltaba una y otra vez.
      setLoadError(mensajeSistema(e));
    } finally {
      setLoaded(true);
    }
  }, [userId, sincronizar, celebrar]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  // Volver a la app al día siguiente sin cambiar de pestaña: sin esto Hoy
  // enseñaba las misiones de ayer como hechas y no aplicaba el cierre.
  useAlVolver(load);

  // Los avisos se derivan del plan: se inicializan una vez y se reconcilian
  // cada vez que cambia el plan o los horarios. Ojo con lo que había antes
  // aquí: llamaba a cancelAllScheduledNotificationsAsync en cada montaje, así
  // que abrir esta pestaña borraba todo lo programado.
  // Con permiso, el dispositivo se registra para el push del coach (upsert
  // idempotente: repetirlo en cada montaje no duplica nada).
  useEffect(() => {
    inicializarAvisos()
      .then((ok) => (ok ? registrarDispositivo() : null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!profile) return;
    programarDespertador(horaAMinutos(profile.wake_time));
    if (plan) {
      const cierre = horaAMinutos(profile.sleep_time);
      reconciliarAvisosDelDia(
        plan.plan.date,
        plan.bloques,
        cierre === null ? null : Math.max(0, cierre - 20),
      );
    }
  }, [profile, plan]);

  const captureEvidence = async (): Promise<string | null> => {
    if (!health.accepted) { health.ask(); return null; }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      const mensaje = 'El sistema necesita la cámara para registrar evidencias.';
      if (Platform.OS === 'web') {
        avisar('Sin cámara', mensaje);
      } else if (await confirmar({ titulo: 'Sin cámara', mensaje, confirmar: 'Abrir ajustes' })) {
        Linking.openSettings().catch(() => {});
      }
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.4,
      base64: true,
    });
    if (result.canceled) return null;
    return result.assets[0]?.base64 ?? null;
  };

  const finishQuest = async (quest: Quest, evidence: string | null) => {
    if (!profile || !userId) return;
    const today = dateKey();
    try {
      const logrosAntes = logrosRef.current ? [...logrosRef.current] : undefined;
      const res = await completeQuest(profile, quest, evidence);
      vibrar(evidence !== null || res.bonusEarned > 0 || quest.is_bonus ? 'misionExtra' : 'mision');
      setProfile(res.profile);
      // Una acción en la cola: el XP va en el resumen; nivel, rango, racha y
      // logros los decide el contrato. La penalización cumplida se dice como
      // recuperación (sin repetir el XP en el resumen).
      const accion = `mision:${quest.id}:${Date.now()}`;
      celebrar({
        accion,
        perfilAntes: profile,
        perfilDespues: res.profile,
        logrosAntes,
        fecha: today,
        recuperadoXp: res.wasPenalty && res.xp > 0 ? res.xp : undefined,
        resumen: res.wasPenalty ? [] : [res.bonusEarned > 0 ? `+${res.bonusEarned} PB` : `+${res.xp} XP · ${quest.stat}`],
      });
      // Antes y después, leídos del espejo síncrono y no del estado del render.
      const antes = completionsRef.current;
      const despues: Record<string, Completion> = {
        ...antes,
        [quest.id]: {
          id: `local-${quest.id}`,
          user_id: profile.id,
          quest_id: quest.id,
          date: today,
          completed_at: new Date().toISOString(),
          xp_awarded: res.xp,
          evidence_url: evidence ? 'local' : null,
        },
      };
      completionsRef.current = despues;
      setCompletions(despues);

      // RET-03: esta misión abre la recuperación. Es el momento que motiva:
      // se dice en pantalla y al lector de pantalla.
      const abiertaAntes = recuperacionDesbloqueada(todayQuests, new Set(Object.keys(antes)), today);
      if (!quest.is_penalty && !abiertaAntes && todayQuests.some((q) => q.is_penalty && !despues[q.id])) {
        setAvisoRecuperacion(true);
        // Después del golpe de la misión: dos a la vez se funden en uno en iOS.
        setTimeout(() => vibrar('recuperacion'), 300);
        AccessibilityInfo.announceForAccessibility('La recuperación está abierta. Recupera lo perdido.');
      }

      // Día perfecto: era la última pendiente. Solo se celebra cuando pasa
      // delante del usuario, no al cargar un día que ya estaba cerrado.
      const quedan = todayQuests.filter((q) => !despues[q.id]).length;
      if (quedan === 0 && todayQuests.length > 0) {
        setDiaPerfecto(true);
        pulso.setValue(1);
        // Con «reducir movimiento» el anillo no late: el día perfecto se dice
        // con la tarjeta y la vibración.
        if (!reducido) {
          Animated.sequence([
            Animated.spring(pulso, { toValue: 1.18, useNativeDriver: true, speed: 30, bounciness: 12 }),
            Animated.spring(pulso, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 8 }),
          ]).start();
        }
        setTimeout(() => vibrar('diaPerfecto'), 260);
      }

      // La misión ya está pagada: un fallo al calcular logros no puede
      // enseñar "Error del sistema" sobre algo que sí ha salido bien.
      try {
        const stats = await completionStats();
        const fresh = await unlockAchievements(
          userId,
          evaluateAchievements({
            totalCompletions: stats.total,
            evidenceCount: stats.withEvidence,
            streak: res.profile.streak_days,
            level: levelFromXp(res.profile.xp_total).level,
            penaltyRedeemed: res.wasPenalty,
          }),
        );
        if (fresh.length > 0) {
          if (logrosRef.current) for (const a of fresh) logrosRef.current.add(a.code);
          celebrar({ accion, logrosNuevos: fresh.map(logroInfo) });
        }
      } catch {
        // Los logros se vuelven a evaluar en la siguiente misión o al cierre.
      }
      // El rango, al final: cierra la ventana de la acción.
      sincronizar(res.profile, accion);
    } catch (e) {
      vibrar('penalizacion');
      avisar('Error del sistema', mensajeSistema(e));
    }
  };

  const release = (questId: string) => {
    completing.current.delete(questId);
    setBusyQuestId((id) => (id === questId ? null : id));
  };

  const onComplete = (quest: Quest) => {
    // Cerrojo síncrono por misión: un doble toque mientras la cámara o la hoja
    // están abiertas ya no dispara dos completeQuest (evita XP duplicado). El
    // cerrojo se toma AQUÍ y lo suelta exactamente una de las salidas: el fin
    // del pago, la cámara cancelada, el cierre de la hoja o irse al módulo.
    // RET-03: con la recuperación cerrada no se toma el cerrojo ni se paga
    // (el motor también lo rechaza). La fila ya dice por qué.
    if (quest.is_penalty && !recuperacionAbierta) return;
    if (completing.current.has(quest.id)) return;
    completing.current.add(quest.id);
    setBusyQuestId(quest.id);

    if (quest.is_penalty) {
      finishQuest(quest, null).finally(() => release(quest.id));
      return;
    }
    const acto = quest.link && quest.link !== 'ninguno' ? quest.link : null;
    // Evidencia obligatoria y sin módulo donde registrarla: no hay nada que
    // elegir, directa a la cámara.
    if (quest.requires_evidence && !acto) {
      captureEvidence()
        .then((b64) => (b64 ? finishQuest(quest, b64) : undefined))
        .finally(() => release(quest.id));
      return;
    }
    // Todo lo demás, en UNA hoja: completar, con foto, o registrar el acto en
    // su módulo (que la marca sola, con la regla y el bloque del plan). Marcarla
    // a pelo sigue siendo posible: hay días en que se entrena sin apuntar series.
    sheetRef.current = quest;
    setSheetQuest(quest);
  };

  const cerrarHoja = () => {
    const quest = sheetRef.current;
    sheetRef.current = null;
    setSheetQuest(null);
    if (quest) release(quest.id);
  };

  const elegirEnHoja = (modo: ModoCompletar) => {
    const quest = sheetRef.current;
    if (!quest) return;
    sheetRef.current = null;
    setSheetQuest(null);
    const acto = quest.link && quest.link !== 'ninguno' ? quest.link : null;
    if (modo === 'registrar' && acto) {
      release(quest.id);
      router.push(RUTA_DE_ACTO[acto]);
      return;
    }
    if (modo === 'foto' || quest.requires_evidence) {
      esperarCierreDeHoja()
        .then(captureEvidence)
        .then((b64) => (b64 ? finishQuest(quest, b64) : undefined))
        .finally(() => release(quest.id));
      return;
    }
    finishQuest(quest, null).finally(() => release(quest.id));
  };

  const compartirDia = async () => {
    if (!userId || preparandoTarjeta) return;
    setPreparandoTarjeta(true);
    try {
      // El marcador se pide de nuevo: el que hay en memoria es de antes de
      // completar la última misión.
      setTarjeta(await prepararDatosSemana(userId));
    } catch (e) {
      avisar('Error del sistema', mensajeSistema(e));
    } finally {
      setPreparandoTarjeta(false);
    }
  };

  const alternarBloque = async (b: DayBlock) => {
    // Optimista: el plan es la pantalla principal y esperar a la red para
    // pintar un check la haría sentir lenta.
    setPlan((p) =>
      p ? { ...p, bloques: p.bloques.map((x) => (x.id === b.id ? { ...x, done: !b.done } : x)) } : p,
    );
    try {
      await setBlockDone(b.id, !b.done);
    } catch {
      setPlan((p) =>
        p ? { ...p, bloques: p.bloques.map((x) => (x.id === b.id ? { ...x, done: b.done } : x)) } : p,
      );
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const today = dateKey();
  const frozen = profile?.freeze_until != null && profile.freeze_until >= today;
  const sorted = [...todayQuests].sort((a, b) => Number(b.is_penalty) - Number(a.is_penalty));
  // RET-03 «Regreso a la arena»: la penalización de hoy se abre al completar
  // una misión normal de hoy (no vale una creada hoy). Se recalcula sola al
  // cambiar `completions`. Cero XP extra.
  const recuperacionAbierta = recuperacionDesbloqueada(todayQuests, new Set(Object.keys(completions)), dateKey());
  const completedCount = sorted.filter((q) => completions[q.id]).length;
  // La racha que se enseña cuenta el día de hoy en cuanto queda cerrado. El
  // multiplicador sigue saliendo de los días CERRADOS: si subiera a mitad del
  // día, completar las misiones en un orden u otro pagaría distinto.
  const racha = rachaVisible(
    profile?.streak_days ?? 0,
    sorted,
    new Set(Object.keys(completions)),
  );
  const pendingCount = sorted.length - completedCount;
  const modulos = modulesFor(profile?.profile_kind);
  // Cuatro por fila como poco (más si la rejilla es ancha), medido sobre el
  // ancho REAL de la rejilla (onLayout): con `width: '23.5%'` + gap 8 la cuarta
  // no cabía, y con el ancho de la ventana salía mal en tablet (márgenes de
  // 32/48, raíl, panel lateral).
  const columnas = Math.max(4, Math.floor(anchoRejilla / LADO_MODULO));
  const tile = anchoRejilla > 0 ? Math.floor((anchoRejilla - HUECO_MODULOS * (columnas - 1)) / columnas) : 0;
  // RET-05: lo que hay en juego hoy, con el criterio del cierre. Congelado no
  // se juzga, así que no se calcula.
  const enJuego =
    profile && !frozen
      ? lineaEnJuego(
          enJuegoHoy({
            questsHoy: todayQuests,
            completadasHoy: new Set(Object.keys(completions)),
            streak: profile.streak_days,
            stones: profile.protection_stones,
            rotosSeguidosPrevios: profile.streak_days === 0 ? rotosPrevios : 0,
          }),
          profile.streak_days,
        )
      : null;
  const cierreAlerta = !!dayResult && (dayResult.penaltyXp > 0 || dayResult.streakLost);
  // La tarjeta de alerta del cierre lleva la trama de la pantalla: la sección
  // de misiones no la repite (SISTEMA §0, sin acumular).
  const alertaCierreVisible = loaded && cierreAlerta;
  const penalizacionPendiente = todayQuests.some((q) => q.is_penalty && !completions[q.id]);
  // Quedan misiones normales (ni extra ni penalización) sin hacer: solo
  // entonces tiene sentido «A medianoche, lo pendiente se penaliza».
  const quedanNormales = sorted.some((q) => !q.is_penalty && !q.is_bonus && !completions[q.id]);
  const cierreSinNada =
    !!dayResult &&
    !cierreAlerta &&
    dayResult.stonesUsed === 0 &&
    dayResult.diasSinCobrar === 0 &&
    dayResult.stonesEarned === 0;
  const celebrando = diaPerfecto && pendingCount === 0 && sorted.length > 0;
  const hayPlan = !!plan && plan.bloques.length > 0;
  // La rivalidad solo existe con al menos un amigo visible en el marcador.
  const visibles = (board ?? []).filter((b) => b.visible);
  const rivalidad =
    visibles.some((b) => !b.isMe) && visibles.some((b) => b.isMe)
      ? lineaRivalidad(clasificar(visibles, 'xp'), 'xp', 'semana')
      : null;
  const hastaCuando =
    profile?.freeze_until && isValidKey(profile.freeze_until) ? nombreDia(profile.freeze_until).toLowerCase() : null;

  const subtitulo = !profile
    ? undefined
    : frozen
      ? 'Sistema en pausa. Hoy no se juzga.'
      : sorted.length === 0
        ? 'Sin misiones programadas para hoy.'
        : pendingCount === 0
          ? voice.allDone()
          : pendingCount === 1
            ? 'Una misión por delante. Cierra el día.'
            : `${pendingCount} misiones por delante.`;

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={onRefresh}
      aside={
        <PanelHoy
          loaded={loaded}
          profile={profile}
          rango={rango}
          // Con la línea RET-05 a la vista, la pista del panel tampoco se pinta
          // (faltan 0 = sin pista): darían dos números distintos.
          racha={enJuego ? { ...racha, faltan: 0 } : racha}
          rivalidad={rivalidad}
          esPro={esPro}
          diaPerfectoVisible={celebrando}
        />
      }
    >
      <Stagger>
        <FadeIn index={0}>
          <ScreenHeader
            eyebrow={formatLongDate()}
            title={profile ? saludo(profile.name) : 'Hoy'}
            subtitle={subtitulo}
            // En compact la Agenda no está en la barra inferior: se llega desde
            // aquí. En el raíl y la barra lateral es un destino propio.
            action={
              navActual === 'tabs'
                ? { icon: 'calendar-outline', label: 'Abrir la agenda', onPress: () => router.push('/(tabs)/agenda') }
                : undefined
            }
            right={
              sorted.length > 0 ? (
                <Animated.View style={{ transform: [{ scale: pulso }] }}>
                  <ProgressRing
                    ratio={completedCount / sorted.length}
                    size={66}
                    stroke={4}
                    color={ink.ink10}
                    label={`${completedCount}/${sorted.length}`}
                    sublabel="hoy"
                  />
                </Animated.View>
              ) : undefined
            }
          />
        </FadeIn>

        {loadError ? (
          <Card variant="outline">
            <EmptyState
              compact
              icon="cloud-offline-outline"
              title={profile ? 'No se ha podido actualizar' : 'El sistema no responde'}
              body={loadError}
              action={{ label: 'Reintentar', onPress: onRefresh }}
            />
          </Card>
        ) : null}

        {!loaded ? (
          <View accessibilityRole="progressbar" accessibilityLabel="Cargando tu día">
            {/* La tarjeta de rango va en el panel lateral cuando lo hay. */}
            {!conPanel ? <Skeleton height={132} style={styles.skCard} /> : null}
            <Skeleton height={11} width={120} style={styles.skEyebrow} />
            <Skeleton height={64} style={styles.skCard} />
            <Skeleton height={11} width={140} style={styles.skEyebrow} />
            <SkeletonRows rows={4} />
          </View>
        ) : null}

        {loaded && profile && !conPanel ? (
          <FadeIn index={1}>
            <TarjetaRango
              profile={profile}
              rango={rango}
              racha={racha}
              ocultarPista={!!enJuego}
              diaPerfectoVisible={celebrando}
            />
          </FadeIn>
        ) : null}

        {loaded && rivalidad && !conPanel ? (
          <FadeIn index={2}>
            <Card padded={false} style={styles.rivalCard}>
              <Row
                first
                chevron
                leading={<Ionicons name="people-outline" size={18} color={colors.textDim} />}
                title={rivalidad}
                onPress={() => router.push('/amigos')}
                accessibilityLabel={`${rivalidad} Abrir Amigos`}
              />
            </Card>
          </FadeIn>
        ) : null}

        {loaded && frozen && profile ? (
          <FadeIn index={2}>
            <Card variant="outline" accent={colors.accentDim}>
              <Text style={styles.alertTitle}>
                <Ionicons name="snow-outline" size={12} color={colors.accentText} /> SISTEMA EN PAUSA
              </Text>
              <Text style={styles.alertBody}>
                {voice.frozen(profile.freeze_reason ?? 'pausa')}
                {hastaCuando ? ` Hasta el ${hastaCuando}.` : ''}
              </Text>
            </Card>
          </FadeIn>
        ) : null}

        {loaded && dayResult ? (
          <FadeIn index={2}>
            {/* Grano solo para el día perfecto: el informe sin alerta va en contorno. */}
            <Card variant={cierreAlerta ? 'alerta' : 'outline'}>
              <Text style={styles.alertTitle}>{cierreAlerta ? 'ALERTA DEL SISTEMA' : 'INFORME DEL CIERRE'}</Text>
              {dayResult.stonesUsed > 0 ? <Text style={styles.alertBody}>{voice.stoneUsed()}</Text> : null}
              {dayResult.penaltyXp > 0 ? (
                <Text style={styles.alertBody}>
                  {/* Frase neutra: voice.penaltyApplied puede amenazar («será
                      permanente») y la salida ya se dice al final. */}
                  El sistema ha aplicado −{dayResult.penaltyXp} XP.
                  {dayResult.levelsLost > 0
                    ? ` Has perdido ${dayResult.levelsLost} ${dayResult.levelsLost === 1 ? 'nivel' : 'niveles'}.`
                    : ''}
                </Text>
              ) : dayResult.streakLost ? (
                <Text style={styles.alertBody}>Racha perdida. El contador vuelve a cero.</Text>
              ) : null}
              {dayResult.diasSinCobrar > 0 ? (
                <Text style={styles.alertBody}>
                  Solo se cobran los 3 primeros días: {dayResult.diasSinCobrar}{' '}
                  {dayResult.diasSinCobrar === 1 ? 'día no te cuesta' : 'días no te cuestan'} XP.
                </Text>
              ) : null}
              {dayResult.stonesEarned > 0 ? <Text style={styles.alertBody}>{voice.stoneEarned()}</Text> : null}
              {/* Un cierre limpio sin nada que contar no deja la tarjeta vacía. */}
              {cierreSinNada ? <Text style={styles.alertBody}>Día cerrado. Racha {profile?.streak_days ?? 0}.</Text> : null}
              {/* La tarjeta termina SIEMPRE con la salida si hay algo que recuperar. */}
              {penalizacionPendiente ? (
                <Text style={styles.alertBody}>
                  Hoy puedes recuperarlo: completa una de tus misiones y se abre la arena.
                </Text>
              ) : null}
            </Card>
          </FadeIn>
        ) : null}

        {/* Sin plan, el hueco de "Orden del día" solo se le enseña a quien tiene
            coach (puede pedirlo). A una cuenta gratuita le abría el día con un
            callejón: Pedir el plan → coach con candado → paywall. */}
        {loaded && (hayPlan || esPro === true) ? (
          <FadeIn index={3}>
            <OrdenDelDia
              plan={plan?.plan ?? null}
              bloques={plan?.bloques ?? []}
              onToggle={alternarBloque}
              pro={esPro === true}
            />
          </FadeIn>
        ) : null}

        {celebrando ? (
          <FadeIn>
            <Card variant="logro">
              <Text style={styles.alertTitle}>DÍA PERFECTO</Text>
              <Text style={styles.alertBody}>Día perfecto. Racha {racha.valor}.</Text>
              <Button
                title="Compartir"
                icon="share-social-outline"
                variant="secondary"
                size="sm"
                onPress={compartirDia}
                loading={preparandoTarjeta}
                style={styles.compartir}
              />
            </Card>
          </FadeIn>
        ) : null}

        {loaded ? (
        <FadeIn index={4}>
          <Section
            title="Misiones de hoy"
            meta={sorted.length > 0 ? `${completedCount}/${sorted.length}` : undefined}
            tone={enJuego?.alerta && !alertaCierreVisible ? 'alerta' : undefined}
          >
            {sorted.length === 0 ? (
              // Con la carga fallida no se sabe si hay misiones: el aviso de
              // arriba ya lo dice y aquí no se afirma "Nada programado".
              loadError ? null : (
              <Card variant="outline">
                <EmptyState
                  compact
                  icon="repeat-outline"
                  title="Nada programado para hoy"
                  body={esPro === true ? 'Crea tus misiones en Hábitos o pídeselas al coach.' : 'Crea tus misiones en Hábitos.'}
                  action={{ label: 'Ir a Hábitos', onPress: () => router.push('/(tabs)/habitos') }}
                />
              </Card>
              )
            ) : (
              <Card padded={false} style={styles.questCard}>
                {sorted.map((q, i) => (
                  <QuestItem
                    key={q.id}
                    first={i === 0}
                    quest={q}
                    completed={!!completions[q.id]}
                    xpAwarded={completions[q.id]?.xp_awarded}
                    busy={busyQuestId === q.id}
                    streakDays={racha.valor}
                    onComplete={onComplete}
                    bloqueada={q.is_penalty && !recuperacionAbierta}
                  />
                ))}
              </Card>
            )}
            {avisoRecuperacion && recuperacionAbierta && penalizacionPendiente ? (
              <Text style={styles.recuperacionAbierta} accessibilityRole="alert">
                La recuperación está abierta. Recupera lo perdido.
              </Text>
            ) : null}
            {sorted.length > 0 && pendingCount === 0 ? (
              <Text style={styles.allDone}>{voice.allDone()}</Text>
            ) : null}
            {/* Sin línea RET-05 y con solo extras o la penalización por hacer,
                «A medianoche…» no es verdad: no se pinta. */}
            {pendingCount > 0 && !frozen && (enJuego || quedanNormales) ? (
              <Text style={[styles.pendingNote, enJuego?.alerta && styles.pendingAlerta]}>
                {enJuego ? enJuego.texto : 'A medianoche, lo pendiente se penaliza.'}
              </Text>
            ) : null}
            {/* Una sola línea, callada y DEBAJO de las misiones: lo gratis va
                primero y el coach se ofrece sin cortar el paso. */}
            {esPro === false && !hayPlan ? (
              <Card padded={false} style={styles.proRow}>
                <Row
                  first
                  chevron
                  muted
                  leading={<Ionicons name="shield-half-outline" size={18} color={colors.textFaint} />}
                  title="El plan del día lo escribe el coach · NIVL Pro"
                  onPress={() => router.push('/pro')}
                  accessibilityLabel="El plan del día lo escribe el coach. Ver NIVL Pro"
                />
              </Card>
            ) : null}
          </Section>
        </FadeIn>
        ) : null}

        <FadeIn index={5}>
          <Section
            title="Módulos"
            action={
              modulos.secondary.length > 0
                ? {
                    label: showMore ? 'Menos' : `Más · ${modulos.secondary.length}`,
                    icon: showMore ? 'chevron-up' : 'chevron-down',
                    onPress: () => setShowMore((v) => !v),
                  }
                : undefined
            }
          >
            <View style={styles.moduleGrid} onLayout={(e) => setAnchoRejilla(e.nativeEvent.layout.width)}>
              {/* Hasta medir no se pintan: con un lado inventado saltaban. */}
              {tile > 0 &&
                [...modulos.primary, ...(showMore ? modulos.secondary : [])].map((m) => (
                  <Pressable
                    key={m.route}
                    onPress={() => router.push(m.route)}
                    style={({ pressed }) => [styles.module, { width: tile, height: tile }, pressed && styles.modulePressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`Abrir ${m.label}`}
                  >
                    <Ionicons name={m.icon as never} size={22} color={colors.text} />
                    <Text style={styles.moduleLabel} numberOfLines={1}>
                      {m.label}
                    </Text>
                  </Pressable>
                ))}
            </View>
          </Section>
        </FadeIn>

        <FadeIn index={6}>
          <Text style={styles.motto}>UN 1 % MEJOR CADA DÍA</Text>
        </FadeIn>
      </Stagger>

      <CompletarSheet quest={sheetQuest} onElegir={elegirEnHoja} onClose={cerrarHoja} />
      <ShareSemanaModal visible={tarjeta !== null} datos={tarjeta} onClose={() => setTarjeta(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  alertTitle: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2.5,
    color: ink.ink9,
    marginBottom: 6,
  },
  alertBody: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: colors.text,
    marginBottom: 4,
  },
  questCard: { paddingHorizontal: 16, paddingVertical: 4 },
  allDone: {
    fontFamily: fonts.semibold,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
    marginTop: 4,
  },
  recuperacionAbierta: {
    fontFamily: fonts.semibold,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: colors.text,
    marginTop: 10,
  },
  // RET-05: bodySm (14/20) en ink8.
  pendingNote: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    marginTop: 4,
  },
  pendingAlerta: { fontFamily: fonts.semibold, color: ink.ink9 },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: HUECO_MODULOS },
  // El lado del azulejo se calcula con el ancho medido de la rejilla (ver `tile`).
  module: {
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  modulePressed: { backgroundColor: colors.accentFaint },
  moduleLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textDim, paddingHorizontal: 4 },
  skCard: { marginBottom: 26 },
  skEyebrow: { marginBottom: 12 },
  rivalCard: { paddingHorizontal: 16, paddingVertical: 2 },
  proRow: { paddingHorizontal: 16, paddingVertical: 2, marginTop: 12, marginBottom: 0 },
  compartir: { alignSelf: 'flex-start', marginTop: 8 },
  motto: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2.7,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 8,
  },
});

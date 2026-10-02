// NIVL · Hoy: los datos y los efectos (L-RADICAL §C).
//
// Todo lo que antes vivía en la pantalla, cortado y pegado sin reescribir: la
// carga con el cierre del día, la cola de celebraciones, los cerrojos
// síncronos al completar (`completing`, `sheetRef`, `completionsRef`), la
// cámara, el plan optimista y los avisos. Devuelve `vista` (las props de
// HoyVista, ya derivadas con derivarHoy) y `hojas` (la hoja de completar).

import { useHealthConsent } from '@/components/ConsentimientoSalud';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Linking, Platform } from 'react-native';
import { useCelebracion } from '@/components/celebracion/contexto';
import type { ModoCompletar } from '@/components/CompletarSheet';
import { prepararDatosSemana, tarjetaDeSemana } from '@/components/ShareCardSemana';
import { useAlVolver } from '@/components/ui';
import { avisar, confirmar } from '@/components/ui/confirmar';
import { vibrar } from '@/design/haptics';
import {
  ACHIEVEMENT_BY_CODE,
  evaluateAchievements,
  fetchUnlocked,
  sincronizarRangoDetalle,
  unlockAchievements,
  tituloVigente,
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
import { celebracionesDeRacha } from '@/lib/celebracionCola';
import { addDays, dateKey } from '@/lib/dates';
import { completeQuest, processPendingDays, questsScheduledOn, type DayCloseResult } from '@/lib/engine';
import { rachaVisible, recuperacionDesbloqueada, rotosSeguidosAntes } from '@/lib/closing';
import { levelFromXp } from '@/lib/game';
import { RUTA_DE_ACTO } from '@/lib/links';
import { compararRangos, estadoDe, type LogroInfo, type RangoId } from '@/lib/progression';
import {
  inicializarAvisos,
  leerClavesCelebradas,
  leerDuelosVistos,
  programarDespertador,
  reconciliarAvisosDelDia,
  registrarFuenteAvisos,
  reprogramarAvisosDelPlan,
} from '@/lib/notifications';
import { listarFotos } from '@/components/fotos/datos';
import { fetchMayorDeEdadConfirmada } from '@/lib/age';
import { armarEstadoPlanAvisos } from '@/lib/avisosPlan';
import { misDuelos } from '@/lib/competicionData';
import { fetchHealthConsent } from '@/lib/health';
import { fetchAiStatus, isPro } from '@/lib/pro';
import { registrarDispositivo } from '@/lib/push';
import { fetchBoard, type BoardEntry } from '@/lib/social';
import { DIAS_VENTANA } from '@/lib/socialmath';
import { mensajeSistema } from '@/lib/validation';
import type { Completion, Profile, Quest } from '@/lib/types';
import { derivarHoy } from './derivarHoy';
import type { DesdeHero, HoyVistaProps } from './HoyVista';

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

// Lo último que enseñó el Hero (nivel, barra y racha). Vive fuera del
// componente: al volver a Hoy los números suben desde ahí y no desde cero; la
// primera carga de la sesión sí sube desde cero.
let ultimoHero: DesdeHero | null = null;
const DESDE_CERO: DesdeHero = { nivel: 0, xpRatio: 0, racha: 0 };

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

export function useHoy() {
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
  // `avisarEnCola`: el aviso del sistema que no bloquea (a diferencia del
  // Alert de confirmar, que en iOS se queda encima de una ceremonia).
  const { celebrar, compartir, avisar: avisarEnCola } = useCelebracion();
  // Logros conocidos (de ellos sale el rango de «antes» de cada acción).
  const logrosRef = useRef<Set<string> | null>(null);
  const [plan, setPlan] = useState<PlanConBloques | null>(null);
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
  const [preparandoTarjeta, setPreparandoTarjeta] = useState(false);
  // Rango vigente (estadoDe con los logros). null = aún no se sabe: hueco.
  const [rango, setRango] = useState<RangoId | null>(null);
  // Días rotos seguidos antes de hoy (solo con la racha a cero, RET-02): con
  // ellos enJuegoHoy sabe si hoy ya no costaría XP.
  const [rotosPrevios, setRotosPrevios] = useState(0);
  // De dónde suben el nivel, la barra y la racha del Hero al montarse.
  const [desdeHero] = useState<DesdeHero>(() => ultimoHero ?? DESDE_CERO);
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

  // L6-0: lo que lee la fuente del plan de avisos cuando dispara (2 s después
  // de la última petición). Espejo de lo pintado y el día al que pertenece.
  const diaCargado = useRef<string | null>(null);
  const avisosRef = useRef({ profile, todayQuests, rotosPrevios });

  /**
   * Pide al servidor el rango merecido y cierra la ventana de la acción: el
   * rango nuevo llega a la cola como logro `rango_X` (la ceremonia la pinta el
   * proveedor). No bloquea nada ni lanza; si sube, recarga el rango que se enseña.
   */
  const sincronizar = useCallback((prof: Profile, accion: string) => {
    sincronizarRangoDetalle()
      .catch(() => ({ nuevos: [] as string[], diasActivos: null }))
      .then(({ nuevos, diasActivos }) => {
        celebrar({ accion, logrosNuevos: nuevos.map(logroDeCodigo), diasActivos, final: true });
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
          // El día CERRADO (el primero del tramo), no hoy: la racha hito ya se
          // celebró al completar la misión de ese día con su fecha, y así la
          // clave coincide y la cola no la repite.
          fecha: perfil.last_day_processed ? addDays(perfil.last_day_processed, 1) : dateKey(),
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
      diaCargado.current = today;
      // Al cargar y al volver a primer plano (useAlVolver llama a load).
      reprogramarAvisosDelPlan();
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

  avisosRef.current = { profile, todayQuests, rotosPrevios };

  // L6-0: Hoy es quien sabe armar el estado del plan de avisos. Lo de fuera
  // (duelos, fotos, edad, salud) se pide en paralelo y en blando: lo que
  // falle va neutro y el resto sigue.
  useEffect(() => {
    if (!userId) return;
    return registrarFuenteAvisos(async () => {
      const hoy = dateKey();
      const { profile: p, todayQuests: quests, rotosPrevios: rotos } = avisosRef.current;
      if (!p || diaCargado.current !== hoy) return null;
      const salud = fetchHealthConsent().then((c) => c.accepted, () => null);
      const [consentimientoSalud, fotos, mayor18, duelos, duelosVistos, celebradas] = await Promise.all([
        salud,
        // Dato de salud: solo con el permiso.
        salud.then((ok) => (ok ? listarFotos() : null)).catch(() => null),
        fetchMayorDeEdadConfirmada().catch(() => null),
        misDuelos().catch(() => null),
        leerDuelosVistos(),
        leerClavesCelebradas(userId),
      ]);
      return armarEstadoPlanAvisos({
        hoy,
        perfil: p,
        questsHoy: quests,
        completadasHoy: new Set(Object.keys(completionsRef.current)),
        rotosPrevios: rotos,
        fotos,
        mayor18,
        consentimientoSalud,
        duelos,
        duelosVistos,
        logros: logrosRef.current,
        celebradas,
      });
    });
  }, [userId]);

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
      // La racha o la recuperación pueden haber dejado de estar en juego.
      reprogramarAvisosDelPlan();

      // Día perfecto: era la última pendiente. Solo se celebra cuando pasa
      // delante del usuario, no al cargar un día que ya estaba cerrado.
      const quedan = todayQuests.filter((q) => !despues[q.id]).length;
      const esDiaPerfecto = quedan === 0 && todayQuests.length > 0;

      // La racha hito (7, 30, 100…) se celebra cuando la racha A LA VISTA la
      // cruza, no al cierre de mañana: completeQuest no toca streak_days. La
      // clave es la misma que dará el cierre de este día (fecha = hoy), así
      // que la cola no la repite mañana.
      const rachaAntes = rachaVisible(profile.streak_days, todayQuests, new Set(Object.keys(antes))).valor;
      const rachaDespues = rachaVisible(profile.streak_days, todayQuests, new Set(Object.keys(despues))).valor;
      const hitosRacha = celebracionesDeRacha(rachaAntes, rachaDespues, today);

      // Lo PAGADO, no lo calculado: con el tope diario no se anuncia «+0 XP».
      const pagado = Math.min(res.xp, Math.max(0, res.profile.xp_total - profile.xp_total));
      const lineaXp =
        res.bonusEarned > 0
          ? `+${res.bonusEarned} PB`
          : pagado > 0
            ? `+${pagado} XP · ${quest.stat}`
            : res.awarded && !quest.is_bonus
              ? 'Tope diario de XP alcanzado'
              : null;

      // Una acción en la cola: el XP y el día perfecto van en el resumen;
      // nivel, rango, racha y logros los decide el contrato. La penalización
      // cumplida se dice como recuperación (sin repetir el XP en el resumen).
      const accion = `mision:${quest.id}:${Date.now()}`;
      celebrar({
        accion,
        perfilAntes: profile,
        perfilDespues: res.profile,
        logrosAntes,
        fecha: today,
        recuperadoXp: res.wasPenalty && res.xp > 0 ? res.xp : undefined,
        extra: hitosRacha,
        resumen: [
          ...(!res.wasPenalty && lineaXp ? [lineaXp] : []),
          ...(esDiaPerfecto ? ['Día perfecto'] : []),
        ],
      });

      // RET-03: esta misión abre la recuperación. Es el momento que motiva:
      // se dice en pantalla y al lector de pantalla.
      const abiertaAntes = recuperacionDesbloqueada(todayQuests, new Set(Object.keys(antes)), today);
      if (!quest.is_penalty && !abiertaAntes && todayQuests.some((q) => q.is_penalty && !despues[q.id])) {
        setAvisoRecuperacion(true);
        // Después del golpe de la misión: dos a la vez se funden en uno en iOS.
        setTimeout(() => vibrar('recuperacion'), 300);
        AccessibilityInfo.announceForAccessibility('La recuperación está abierta. Recupera lo perdido.');
      }

      if (esDiaPerfecto) {
        // El día perfecto se dice con su tarjeta (y el botón de compartir),
        // el resumen de la cola y la vibración.
        setDiaPerfecto(true);
        // Si sube de nivel, vibra su ceremonia: dos golpes seguidos se pisan.
        const subeNivel = levelFromXp(res.profile.xp_total).level > levelFromXp(profile.xp_total).level;
        if (!subeNivel) setTimeout(() => vibrar('diaPerfecto'), 260);
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
      compartir(tarjetaDeSemana(await prepararDatosSemana(userId)));
    } catch (e) {
      avisarEnCola(mensajeSistema(e));
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

  // RET-03 «Regreso a la arena»: la penalización de hoy se abre al completar
  // una misión normal de hoy (no vale una creada hoy). Se recalcula sola al
  // cambiar `completions`. Cero XP extra.
  const recuperacionAbierta = recuperacionDesbloqueada(todayQuests, new Set(Object.keys(completions)), dateKey());

  const hoy = dateKey();
  const hora = new Date().getHours();
  const tituloEquipado = tituloVigente(profile?.equipped_title);
  // Memoizado: derivarHoy elige frases de `voice` al azar y no deben cambiar
  // en cada render.
  const datos = useMemo(
    () =>
      derivarHoy({
        hoy,
        hora,
        profile,
        rango,
        tituloEquipado,
        quests: todayQuests,
        completions,
        dayResult,
        plan,
        esPro,
        board,
        rotosPrevios,
        diaPerfecto,
        avisoRecuperacion,
      }),
    [hoy, hora, profile, rango, tituloEquipado, todayQuests, completions, dayResult, plan, esPro, board, rotosPrevios, diaPerfecto, avisoRecuperacion],
  );

  const heroVisto = datos.hero;
  useEffect(() => {
    if (!heroVisto) return;
    ultimoHero = {
      nivel: heroVisto.nivel,
      xpRatio: heroVisto.xpSiguiente > 0 ? heroVisto.xpEnNivel / heroVisto.xpSiguiente : 1,
      racha: heroVisto.racha,
    };
  }, [heroVisto]);

  const vista: HoyVistaProps = {
    estado: loaded ? 'listo' : 'cargando',
    error: loadError,
    datos,
    ocupada: busyQuestId,
    preparandoTarjeta,
    refrescando: refreshing,
    desde: desdeHero,
    acciones: {
      onCompletar: onComplete,
      onAlternarBloque: alternarBloque,
      onCompartirDia: compartirDia,
      onRefrescar: onRefresh,
      onReintentar: onRefresh,
    },
  };

  return {
    vista,
    hojas: { quest: sheetQuest, onElegir: elegirEnHoja, onClose: cerrarHoja },
  };
}

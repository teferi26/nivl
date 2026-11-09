import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Campo, Entrada, TarjetaArena } from '@/components/arena';
import { DescargoSalud } from '@/components/DescargoSalud';
import { useHealthConsent } from '@/components/ConsentimientoSalud';
import {
  conTiempoLimite,
  DECISION_SALTAR,
  LECTURA_MAX_MS,
  pasoOferta,
  SALIDA_ESPERA_MS,
} from '@/components/onboarding/pasoOferta';
import { useCelebracion } from '@/components/celebracion/contexto';
import { Cuestionario } from '@/components/embudo/Cuestionario';
import { CargaPlan, PlanNoventa } from '@/components/embudo/PlanNoventa';
import { pasoAnterior, PASO_CUESTIONARIO, PASO_IDIOMA, PASO_MODOS, PASO_SALUD, posicionPaso, secuenciaPasos, siguientePaso } from '@/components/onboarding/pasos';
import { SelectorIdioma } from '@/components/idioma/SelectorIdioma';
import { EleccionModos } from '@/components/modos/EleccionModos';
import { AccionesConsentimiento, CuerpoConsentimiento } from '@/components/consentimiento/ConsentimientoAnalitica';
import { useConsentimientoAnalitica } from '@/components/consentimiento/useConsentimientoAnalitica';
import { ProgresoPasos } from '@/components/onboarding/ProgresoPasos';
import { TituloPaso } from '@/components/onboarding/TituloPaso';
import { OfertaModosAcciones, OfertaModosCuerpo, OfertaModosLegal } from '@/components/modos/pago/OfertaModosVista';
import { useOfertaModos } from '@/components/modos/pago/useOfertaModos';
import { ProUpsellLine } from '@/components/ProOffer';
import { Button, FondoOnix, Skeleton } from '@/components/ui';
import { ariaWeb } from '@/components/ui/ariaWeb';
import { avisar } from '@/components/ui/confirmar';
import { GutterContext } from '@/components/ui/Screen';
import { useAuth } from '@/lib/auth';
import { CODIGO_MAX_LENGTH, motivoReferral, normalizarCodigo } from '@/lib/creatormath';
import {
  claimReferral,
  guardarCodigoPendiente,
  leerCodigoPendiente,
  olvidarCodigoPendiente,
  type ReferralSource,
} from '@/lib/creators';
import { registrar, type SalidaOnboarding } from '@/lib/analitica';
import { pasarFiltroPerfil } from '@/lib/filtroPerfil';
import { createStarterQuests, deleteQuest, ensureProfile, fetchQuests, insertEvent, updateProfile } from '@/lib/data';
import { completas, necesitaPermisoSalud, payloadObjetivo, type Respuestas } from '@/lib/embudo';
import { guardarRespuestas, leerRespuestas, olvidarRespuestas } from '@/lib/embudoGuardado';
import { KINDS, type ProfileKind } from '@/lib/kinds';
import { anotarOferta, fetchAiStatus, isPro, ofrecerSi, type AiStatus, type DecisionOferta, type RespuestaOferta } from '@/lib/pro';
import { colors, fonts } from '@/lib/theme';
import { ink, space, type as tipo, vidrio } from '@/design/tokens';
import { TopeAncho } from '@/design/useSizeClass';
import { esIdioma, fijarPreferencia, idiomaDispositivo, preferenciaIdioma, resolverIdiomaCoach, t, useIdioma } from '@/i18n';
import { asegurarIdiomaPerfil } from '@/i18n/sincronizar';
import { flagsActuales, useFlags } from '@/lib/flags';
import { eleccionValida, modosSugeridos, useModo, type ModoEtiqueta } from '@/modos';
import { marcarNovedadVista } from '@/modos/datos';
import { mensajeSistema, NAME_MAX_LENGTH } from '@/lib/validation';

// El onboarding de Ónix, ya con cuenta. El cuestionario (quién eres, qué
// quieres, cómo te hablo) se contesta antes de registrarse (/empezar) y aquí se
// recoge; solo se pregunta aquí si este teléfono no lo tiene.
//
// Bienvenida y aviso de salud · (cuestionario) · Nombre · (modos) · (permiso de
// salud) · Primeras misiones · Plan de 90 días · NIVL Pro.
//
// La firma ya no está aquí: se hace después (`/firma`), con la app ya usada. Sus
// datos son los mismos: `sealLetter` y el evento `commitment_signed`.
/**
 * Integración F1: el paso del idioma ya se contestó en esta sesión de app. Va
 * fuera del componente a propósito: elegir otro idioma cambia la interfaz y la
 * raíz remonta el árbol entero (`key={interfaz}` en _layout.tsx), así que un
 * useRef se perdería y el onboarding volvería a empezar por el idioma.
 */
let idiomaOnboardingContestado = false;

/**
 * QA F1 (menor 4): ¿ya se eligió idioma? En esta sesión de app, o antes de
 * que la app se recargara o muriera: la preferencia guardada en el teléfono es
 * un idioma concreto. Una cuenta nueva arranca en `auto` (decidirPreferenciaInicial)
 * y solo elegirlo (aquí o en Ajustes) la deja en un idioma.
 */
function idiomaYaElegido(preferencia: string | null): boolean {
  return idiomaOnboardingContestado || esIdioma(preferencia);
}

/** Pasos de los que se puede volver: del nombre a las misiones. */
const PRIMER_PASO_CON_VUELTA = 1;
const ULTIMO_PASO_CON_VUELTA = 4;
/** Margen lateral del onboarding; lo publica GutterContext para lo que va a sangre. */
const GUTTER = 24;
/** Ancho útil de la columna del onboarding (sin el canal). */
const ANCHO_COLUMNA = 560;

// Nombres por defecto de la fila de perfil: si es uno de estos, no se
// prerrellena (que escriba el suyo).
const DEFAULT_NAMES = new Set(['Gladiador', 'Cazador']); // i18n-ok: valores por defecto de la base de datos, no se pintan

export default function Onboarding() {
  const health = useHealthConsent();
  const { session } = useAuth();
  const userId = session?.user.id;
  // Con el idioma encendido ya al montar (caché de interruptores), se empieza
  // por él sin pasar un instante por la portada.
  const [step, setStep] = useState(() =>
    flagsActuales().idiomas_activos && !idiomaYaElegido(preferenciaIdioma()) ? PASO_IDIOMA : 0,
  );
  const { preferencia } = useIdioma();
  // Modos F1: los pasos nuevos solo con su interruptor (pasos.ts).
  const flags = useFlags();
  const modosCtx = useModo();
  const [respuestas, setRespuestas] = useState<Respuestas | null>(null);
  const [respuestasLeidas, setRespuestasLeidas] = useState(false);
  const [saludOmitida, setSaludOmitida] = useState(false);
  const [planListo, setPlanListo] = useState(false);
  const faltaCuestionario = respuestasLeidas && !(respuestas && completas(respuestas));
  const faltaSalud = !!respuestas && necesitaPermisoSalud(respuestas) && !health.accepted && !saludOmitida;
  const secuencia = useMemo(
    () => secuenciaPasos({ idioma: flags.idiomas_activos, modos: modosCtx.activo, cuestionario: faltaCuestionario, salud: faltaSalud }),
    [flags.idiomas_activos, modosCtx.activo, faltaCuestionario, faltaSalud],
  );
  const tras = (paso: number) => siguientePaso(secuencia, paso);
  // Propuesto: lo ya elegido o, si no, el del teléfono (si NIVL lo habla).
  const [idiomaElegido, setIdiomaElegido] = useState<string>(() =>
    resolverIdiomaCoach(preferenciaIdioma() ?? 'auto', idiomaDispositivo()),
  );
  const [modosElegidos, setModosElegidos] = useState<ModoEtiqueta[]>([]);
  // Medición de uso (dictamen LSSI 3.1): con el flag encendido y sin decisión,
  // tras la portada y antes de cualquier otro paso, una pantalla propia con
  // «Rechazar» y «Aceptar» del mismo peso. Cualquiera de las dos sigue igual.
  const medicion = useConsentimientoAnalitica();
  const [preguntandoMedicion, setPreguntandoMedicion] = useState(false);
  const decidirMedicion = (acepta: boolean) => {
    if (!acepta) {
      medicion.rechazar();
      setPreguntandoMedicion(false);
      setStep(tras(0));
      return;
    }
    // QA F1 (menor 2): la portada (paso 0) se vio antes de poder medirla.
    // Al aceptar se apunta, y en orden: primero el consentimiento, luego el
    // paso 0 y después el 1 (el efecto de `step`).
    medicion.aceptar(() => {
      registrar('onboarding_paso', { paso: 0 });
      setPreguntandoMedicion(false);
      setStep(tras(0));
    });
  };
  const [name, setName] = useState('');
  // "¿Quién te trajo?": opcional, precargado si se entró por nivl://c/CODIGO.
  const [codigo, setCodigo] = useState('');
  const [avisoCodigo, setAvisoCodigo] = useState<string | null>(null);
  const codigoDelEnlace = useRef<string | null>(null);
  // El último código que el servidor ya contestó (aceptado o rechazado): con
  // el mismo código, Continuar ya no pregunta otra vez y deja seguir.
  const codigoResuelto = useRef<string | null>(null);
  const [kind, setKind] = useState<ProfileKind | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  // Quien ya tiene coach (una cuenta de cortesía que rehace el onboarding) no
  // ve la oferta: tras el plan, entra.
  const yaEsPro = useRef(false);
  // La cuenta nunca tuvo coach: el paso 6 ofrece la prueba de 7 días.
  // El estado entero de la IA: el paso 6 lo necesita para decidir la oferta
  // (`ofrecerSi`). null = aún no leído o sin red.
  const estadoIA = useRef<AiStatus | null>(null);
  // Qué decidió `ofrecerSi('firma', …)` para el paso 6. null = aún no.
  const [decisionOferta, setDecisionOferta] = useState<DecisionOferta | null>(null);
  // Una sola petición aunque StrictMode monte el efecto dos veces.
  const pidiendoOferta = useRef(false);
  const { celebrando } = useCelebracion();
  // Volver atrás no puede duplicar nada. Las misiones creadas se recuerdan
  // (título → id) para reconciliar si se cambia la selección al volver a
  // pasar; el objetivo solo se reescribe en la crónica si ha cambiado; y el
  // perfil solo repone la selección por defecto si es OTRO perfil.
  const creadas = useRef<Map<string, string>>(new Map());
  const objetivoGuardado = useRef<string | null>(null);
  const preparadoCon = useRef<string | null>(null);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    leerRespuestas()
      .then((r) => {
        setRespuestas(r);
        if (r?.kind) setKind(r.kind);
      })
      .finally(() => setRespuestasLeidas(true));
  }, []);

  // El nombre puede venir ya de Franky (trigger de alta, migración 0018).
  useEffect(() => {
    if (!userId) return;
    ensureProfile(userId)
      .then((p) => {
        if (p.name && !DEFAULT_NAMES.has(p.name)) setName((n) => n || p.name);
      })
      .catch(() => {});
    leerCodigoPendiente()
      .then((p) => {
        if (!p) return;
        if (p.source === 'enlace') codigoDelEnlace.current = p.code;
        setCodigo((c) => c || p.code);
      })
      .catch(() => {});
    fetchAiStatus()
      .then((s) => {
        estadoIA.current = s;
        yaEsPro.current = isPro(s);
      })
      .catch(() => {});
  }, [userId]);

  const withLock = async (fn: () => Promise<void>) => {
    if (!userId || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      avisar(t('comun:sistemaNoResponde'), mensajeSistema(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  /**
   * Manda el código de creador, si hay. Nunca bloquea el onboarding: un
   * rechazo se dice en una línea bajo el campo (y con el mismo código, el
   * siguiente Continuar ya pasa); sin red, queda pendiente y `index.tsx` lo
   * reintenta al entrar. Devuelve si se puede avanzar ya.
   */
  const reclamarCodigo = async (): Promise<boolean> => {
    const c = normalizarCodigo(codigo);
    if (!c || codigoResuelto.current === c) return true;
    const fuente: ReferralSource = codigoDelEnlace.current === c ? 'enlace' : 'onboarding';
    try {
      const r = await claimReferral(c, fuente);
      codigoResuelto.current = c;
      await olvidarCodigoPendiente();
      if (r.ok) {
        setAvisoCodigo(null);
        return true;
      }
      setAvisoCodigo(t('onboarding:nombre.codigoRechazado', { motivo: motivoReferral(r.reason) }));
      return false;
    } catch {
      await guardarCodigoPendiente(c, fuente);
      return true;
    }
  };

  /** El objetivo (solo con permiso si es de salud) y las misiones por defecto. */
  const prepararMisiones = async () => {
    if (respuestas) {
      const payload = payloadObjetivo(respuestas, health.accepted);
      const huella = JSON.stringify(payload);
      if (objetivoGuardado.current !== huella) {
        await insertEvent(userId!, 'onboarding_goal', { ...payload });
        objetivoGuardado.current = huella;
      }
    }
    const k = respuestas?.kind ?? kind;
    const clave = `${k}:${health.accepted}`;
    if (k && preparadoCon.current !== clave) {
      setChosen(new Set(KINDS[k].starterQuests.flatMap((q, i) => (health.accepted || !q.health_data ? [i] : []))));
      preparadoCon.current = clave;
    }
  };

  const avanzarDesde = async (paso: number) => {
    const sig = tras(paso);
    if (sig === 4) await prepararMisiones();
    setStep(sig);
  };

  const saveName = () =>
    withLock(async () => {
      if (!name.trim()) return;
      await updateProfile(userId!, { name: name.trim() });
      void pasarFiltroPerfil();
      if (kind) {
        await updateProfile(userId!, { profile_kind: kind });
        setModosElegidos(modosSugeridos(kind));
      }
      if (await reclamarCodigo()) await avanzarDesde(1);
    });

  const terminarCuestionario = (r: Respuestas) => {
    setRespuestas(r);
    setKind(r.kind);
    void guardarRespuestas(r);
    setStep(tras(PASO_CUESTIONARIO));
  };

  const seguirSinSalud = () => {
    setSaludOmitida(true);
    void withLock(async () => {
      await avanzarDesde(PASO_SALUD);
    });
  };

  // Modos F1: el idioma (primer paso, con `idiomas_activos`). Se guarda en el
  // teléfono y en `profiles.locale`, como la hoja de Perfil.
  const saveIdioma = () =>
    withLock(async () => {
      // Antes de fijar la preferencia: si cambia el idioma, el árbol se
      // remonta y el onboarding nuevo tiene que empezar por la portada.
      idiomaOnboardingContestado = true;
      if (esIdioma(idiomaElegido)) {
        await fijarPreferencia(idiomaElegido);
        await asegurarIdiomaPerfil(userId!);
      }
      setStep(tras(PASO_IDIOMA));
    });

  // Modos F1: «Elige tus modos» (con `modos_activos`): al menos uno además de
  // General, que siempre está. Se guarda en `user_modes`.
  const saveModos = () =>
    withLock(async () => {
      if (!eleccionValida(modosElegidos)) return;
      await modosCtx.guardarActivados(modosElegidos);
      await avanzarDesde(PASO_MODOS);
    });

  const saveStarters = () =>
    withLock(async () => {
      if (!kind) return;
      const elegidas = KINDS[kind].starterQuests.filter((_, i) => chosen.has(i));
      if (!health.accepted && elegidas.some(q => q.health_data)) { health.ask(); return; }
      const titulos = new Set(elegidas.map((q) => q.title));
      // Sin memoria de esta sesión (la app se cerró a mitad de onboarding, o
      // la primera pasada falló tras insertar): se mira lo que ya hay en la
      // cuenta y no se vuelve a crear una misión elegida que ya existe.
      if (creadas.current.size === 0 && titulos.size > 0) {
        const existentes = await fetchQuests();
        for (const q of existentes) {
          if (titulos.has(q.title) && !creadas.current.has(q.title)) creadas.current.set(q.title, q.id);
        }
      }
      // Reconciliar en vez de insertar a ciegas: al volver a pasar por aquí se
      // crea solo lo nuevo y se retira lo que ya no está elegido (también las
      // de otro perfil, si se cambió). Primera pasada: todo es nuevo.
      for (const [titulo, id] of [...creadas.current]) {
        if (titulos.has(titulo)) continue;
        await deleteQuest(id);
        creadas.current.delete(titulo);
      }
      const nuevas = await createStarterQuests(
        userId!,
        elegidas.filter((q) => !creadas.current.has(q.title)),
      );
      for (const q of nuevas) creadas.current.set(q.title, q.id);
      setPlanListo(false);
      setStep(tras(4));
    });

  const finish = (salida: SalidaOnboarding = 'sin_oferta') =>
    withLock(async () => {
      await updateProfile(userId!, { onboarding_done: true });
      // Quien acaba de elegir no necesita la «Novedad» de los modos (N2).
      await marcarNovedadVista(userId!);
      await olvidarRespuestas();
      registrar('onboarding_fin', { salida });
      router.replace('/(tabs)');
    });

  // Modos F1: con `idiomas_activos`, el idioma es el primer paso. Los
  // interruptores pueden llegar después de montar (caché o red): si aún no se
  // ha pasado de la portada, se empieza por el idioma.
  // La preferencia guardada puede llegar después de montar (se lee del
  // teléfono): si ya era un idioma, el paso del idioma no se repite.
  useEffect(() => {
    if (!flags.idiomas_activos) return;
    if (!idiomaYaElegido(preferencia)) setStep((s) => (s === 0 ? PASO_IDIOMA : s));
    else setStep((s) => (s === PASO_IDIOMA ? 0 : s));
  }, [flags.idiomas_activos, preferencia]);

  const puedeVolver = step >= PRIMER_PASO_CON_VUELTA && step <= ULTIMO_PASO_CON_VUELTA && !busy;
  const volver = useCallback(() => setStep((s) => pasoAnterior(secuencia, s)), [secuencia]);

  // Con el permiso de salud concedido en su paso, se sigue solo.
  useEffect(() => {
    if (step === PASO_SALUD && health.accepted) {
      void withLock(async () => {
        await avanzarDesde(PASO_SALUD);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al conceder el permiso
  }, [step, health.accepted]);

  // Aceptar el permiso desde las misiones: se vuelve a preparar la selección y el objetivo.
  useEffect(() => {
    if (step === 4 && health.accepted) {
      void withLock(async () => {
        await prepararMisiones();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al conceder el permiso
  }, [step, health.accepted]);

  // El botón físico sigue el mismo recorrido que la flecha.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (busy || lock.current) return true;
      if (!puedeVolver) return false;
      volver();
      return true;
    });
    return () => sub.remove();
  }, [puedeVolver, busy, volver]);

  const toggleStarter = (i: number) => {
    if (kind && KINDS[kind].starterQuests[i]?.health_data && !health.accepted && !chosen.has(i)) { health.ask(); return; }
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const meta = kind ? KINDS[kind] : null;
  const terminarCarga = useCallback(() => setPlanListo(true), []);
  const trasPlan = () => (yaEsPro.current ? void finish('ya_pro') : setStep(tras(5)));
  // Salir del paso 6. La respuesta solo se apunta si se enseñó la hoja: la
  // línea no cuenta contra los topes y no hay nada que cerrar.
  const salir = async (respuesta: RespuestaOferta) => {
    if (decisionOferta?.forma === 'hoja') await anotarOferta('firma', respuesta, 'hoja');
    await finish(respuesta === 'vista' ? 'cerrada' : respuesta);
  };

  // La oferta por modos, con el modo de su perfil primero. Comprar cierra el onboarding.
  const oferta = useOfertaModos({ kind, onComprado: () => void salir('compra') });
  const forma = pasoOferta(decisionOferta, celebrando);
  // Si la espera se alarga (red lenta, una celebración que no se cierra), el
  // pie enseña una salida discreta: el paso nunca se queda sin puerta.
  const [salidaEspera, setSalidaEspera] = useState(false);
  useEffect(() => {
    if (step !== 6 || forma !== 'esperar') {
      setSalidaEspera(false);
      return;
    }
    const espera = setTimeout(() => setSalidaEspera(true), SALIDA_ESPERA_MS);
    return () => clearTimeout(espera);
  }, [step, forma]);

  // Paso 6: se decide la oferta UNA vez, nunca con una celebración en
  // pantalla. Sin estado de la IA (sin red) no se ofrece a ciegas: se entra.
  useEffect(() => {
    if (step !== 6 || decisionOferta || celebrando || pidiendoOferta.current) return;
    pidiendoOferta.current = true;
    (async () => {
      // La lectura tiene tiempo límite: si vence, se entra sin oferta.
      const s = estadoIA.current ?? (await conTiempoLimite(fetchAiStatus(), LECTURA_MAX_MS, 'vencida' as const));
      if (s === 'vencida') {
        setDecisionOferta(DECISION_SALTAR);
        await finish();
        return;
      }
      if (s) estadoIA.current = s;
      const sugerida = await ofrecerSi('firma', s, { celebrando: false });
      // Tras el plan de 90 días siempre va la oferta entera, nunca la línea discreta.
      const d = sugerida.mostrar ? { ...sugerida, forma: 'hoja' as const } : sugerida;
      // Se guarda también el «no»: si entrar falla, el pie da el botón para reintentarlo.
      setDecisionOferta(d);
      if (!d.mostrar) await finish();
    })().catch(() => {
      // ofrecerSi no lanza; si algo falla igual, se entra sin oferta.
      setDecisionOferta({ ...DECISION_SALTAR, razon: 'error' });
      void finish();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `finish` y el nivel se leen al decidir, una sola vez
  }, [step, decisionOferta, celebrando]);

  // Embudo anónimo: qué paso se ve (volver atrás lo repite; el panel cuenta
  // instalaciones distintas por paso).
  useEffect(() => {
    // Integración F1: solo los siete pasos de siempre (0 a 6, los del panel).
    // El idioma (-1) y los modos (2,5) no son enteros del embudo y no se miden.
    if (Number.isInteger(step) && step >= 0) registrar('onboarding_paso', { paso: step });
  }, [step]);

  // Cada paso empieza arriba: el ScrollView es el mismo para todos y, si no,
  // la oferta de Pro heredaba el scroll del final de la firma.
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  return (
    <SafeAreaView style={styles.screen}>
      <FondoOnix />
      {step === PASO_CUESTIONARIO ? (
        <Cuestionario inicial={respuestas} onTerminar={terminarCuestionario} />
      ) : (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Columna centrada: en iPad y en la web, cabecera, contenido y pie comparten el tope. */}
        <TopeAncho.Provider value={ANCHO_COLUMNA}>
        <View style={styles.columna}>
        {/* El plan y la oferta no llevan la barra: el perfil ya está completo. */}
        {step > 0 && step < 5 ? (
        <View style={styles.top}>
          <View style={styles.backRow}>
            {puedeVolver ? (
              <Pressable
                onPress={volver}
                hitSlop={12}
                style={styles.back}
                accessibilityRole="button"
                accessibilityLabel={t('onboarding:volverA11y')}
              >
                <Ionicons name="arrow-back" size={20} color={colors.text} />
              </Pressable>
            ) : null}
          </View>
          <ProgresoPasos {...posicionPaso(secuencia, step)} />
        </View>
        ) : null}

        {/* Solo el KeyboardAvoidingView empuja: junto a
            automaticallyAdjustKeyboardInsets, iOS sumaba el teclado dos veces. */}
        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <GutterContext.Provider value={GUTTER}>

          {step === PASO_IDIOMA ? (
            <Entrada key="paso-idioma" indice={0}>
              <TituloPaso
                inscripcion={t('onboarding:idioma.inscripcion')}
                titulo={t('onboarding:idioma.titulo')}
                pista={t('onboarding:idioma.pista')}
              />
              <SelectorIdioma valor={idiomaElegido} alCambiar={setIdiomaElegido} ocupado={busy} />
            </Entrada>
          ) : null}

          {step === 0 && !preguntandoMedicion ? (
            <Entrada key="paso-0" indice={0}>
              <TituloPaso
                inscripcion={t('onboarding:embudo.bienvenida.rotulo')}
                titulo={t('onboarding:embudo.bienvenida.titulo')}
                pista={t('onboarding:embudo.bienvenida.texto')}
              />
              <TarjetaArena variante="contorno">
                <DescargoSalud />
              </TarjetaArena>
            </Entrada>
          ) : null}

          {step === 0 && preguntandoMedicion ? (
            <Entrada key="paso-medicion" indice={0}>
              <TituloPaso inscripcion={t('perfil:medicion.eyebrow')} titulo={t('perfil:medicion.titulo')} />
              <CuerpoConsentimiento />
            </Entrada>
          ) : null}

          {step === 1 ? (
            <Entrada key="paso-1" indice={0}>
              <TituloPaso inscripcion={t('onboarding:nombre.inscripcion')} titulo={t('onboarding:nombre.titulo')} />
              <TarjetaArena variante="contorno">
                <Campo
                  etiqueta={t('onboarding:nombre.etiqueta')}
                  value={name}
                  onChangeText={setName}
                  placeholder={t('onboarding:nombre.placeholder')}
                  maxLength={NAME_MAX_LENGTH}
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={saveName}
                  accessibilityLabel={t('onboarding:nombre.a11y')}
                />
              </TarjetaArena>
              <TarjetaArena variante="contorno" style={styles.segundaTarjeta}>
                <Campo
                  etiqueta={t('onboarding:nombre.codigoEtiqueta')}
                  error={avisoCodigo ?? undefined}
                  ayuda={t('onboarding:nombre.codigoAyuda')}
                  value={codigo}
                  onChangeText={(texto) => {
                    setCodigo(texto);
                    setAvisoCodigo(null);
                  }}
                  placeholder={t('onboarding:nombre.codigoPlaceholder')}
                  maxLength={CODIGO_MAX_LENGTH + 4}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={saveName}
                  accessibilityLabel={t('onboarding:nombre.codigoA11y')}
                />
              </TarjetaArena>
            </Entrada>
          ) : null}

          {step === PASO_MODOS ? (
            <Entrada key="paso-modos" indice={0}>
              <TituloPaso
                inscripcion={t('modos:onboarding.inscripcion')}
                titulo={t('modos:onboarding.titulo')}
                pista={t('modos:onboarding.pista')}
              />
              <EleccionModos valor={modosElegidos} alCambiar={setModosElegidos} ocupada={busy} />
            </Entrada>
          ) : null}

          {step === PASO_SALUD ? (
            <Entrada key="paso-salud" indice={0}>
              <TituloPaso
                inscripcion={t('onboarding:embudo.salud.rotulo')}
                titulo={t('onboarding:embudo.salud.titulo')}
                pista={t('onboarding:embudo.salud.texto')}
              />
              <TarjetaArena variante="contorno">
                <DescargoSalud />
                <Text style={styles.notaSalud}>{t('onboarding:embudo.salud.sinPermiso')}</Text>
              </TarjetaArena>
            </Entrada>
          ) : null}

          {step === 4 && meta ? (
            <Entrada key="paso-4" indice={0}>
              <TituloPaso
                inscripcion={t('onboarding:misiones.inscripcion')}
                titulo={t('onboarding:misiones.titulo')}
                pista={t('onboarding:misiones.pista', {
                  para: kind === 'general' ? t('onboarding:misiones.gladiador') : meta.enFrase,
                })}
              />
              <TarjetaArena variante="contorno">
                {meta.starterQuests.map((q, i) => {
                  const on = chosen.has(i);
                  return (
                    <Pressable
                      key={q.title}
                      onPress={() => toggleStarter(i)}
                      style={[styles.starterRow, i > 0 && styles.starterRowSep]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      {...ariaWeb({ checked: on })}
                      accessibilityLabel={q.title}
                    >
                      <View style={[styles.checkbox, on && styles.checkboxOn]}>
                        {on ? <Ionicons name="checkmark" size={14} color={colors.bg} /> : null}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.starterTitle, !on && styles.starterOff]}>{q.title}</Text>
                        <Text style={styles.starterMeta}>
                          {q.days_of_week.length === 7
                            ? t('onboarding:misiones.cadaDia')
                            : t('onboarding:misiones.diasSemana', { n: q.days_of_week.length })}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </TarjetaArena>
            </Entrada>
          ) : null}

          {step === 5 ? (
            planListo && respuestas ? (
              <Entrada key="paso-plan" indice={0}>
                <PlanNoventa respuestas={respuestas} conSalud={health.accepted} />
              </Entrada>
            ) : (
              <CargaPlan key="paso-carga" onFin={terminarCarga} />
            )
          ) : null}

          {step === 6 ? (
            <Entrada key="paso-6" indice={0}>
              <TituloPaso
                inscripcion={t('onboarding:coach.inscripcion')}
                titulo={t('onboarding:coach.titulo')}
                pista={forma === 'hoja' ? t('onboarding:coach.pistaHoja') : t('onboarding:coach.pista')}
              />
              {forma === 'esperar' ? (
                <View style={styles.ofertaEspera} accessibilityRole="progressbar" accessibilityLabel={t('onboarding:coach.preparandoA11y')}>
                  <Skeleton height={86} />
                  <Skeleton height={70} />
                  <Skeleton height={70} />
                </View>
              ) : null}
              {forma === 'hoja' ? (
                <>
                  <OfertaModosCuerpo oferta={oferta} />
                  <OfertaModosLegal oferta={oferta} />
                </>
              ) : null}
              {forma === 'linea' && decisionOferta ? <ProUpsellLine momento="firma" tier={decisionOferta.tier} /> : null}
            </Entrada>
          ) : null}
          </GutterContext.Provider>
        </ScrollView>

        {/* Pie fijo: la acción del paso siempre a la vista, también con el teclado abierto. */}
        {!(step === 5 && !planListo) ? (
          <View style={styles.footer}>
            {step === PASO_IDIOMA ? (
              <Button title={t('onboarding:continuar')} size="lg" onPress={saveIdioma} loading={busy} />
            ) : null}
            {step === 0 && !preguntandoMedicion ? (
              <Button
                title={t('onboarding:continuar')}
                size="lg"
                onPress={() => (medicion.preguntar ? setPreguntandoMedicion(true) : setStep(tras(0)))}
              />
            ) : null}
            {step === 0 && preguntandoMedicion ? (
              <AccionesConsentimiento
                onRechazar={() => decidirMedicion(false)}
                onAceptar={() => decidirMedicion(true)}
                ocupado={medicion.ocupado}
              />
            ) : null}
            {step === 1 ? (
              <Button title={t('onboarding:continuar')} size="lg" onPress={saveName} loading={busy} disabled={!name.trim()} />
            ) : null}
            {step === PASO_MODOS ? (
              <Button
                title={t('onboarding:continuar')}
                size="lg"
                onPress={saveModos}
                loading={busy}
                disabled={!eleccionValida(modosElegidos)}
              />
            ) : null}
            {step === PASO_SALUD ? (
              <View style={styles.dosBotones}>
                <Button title={t('onboarding:embudo.salud.revisar')} size="lg" onPress={health.ask} loading={busy} />
                <Button title={t('onboarding:embudo.salud.seguir')} variant="secondary" size="lg" onPress={seguirSinSalud} disabled={busy} />
              </View>
            ) : null}
            {step === 4 ? (
              <View style={styles.dosBotones}>
                {/* Sin ninguna posible (todas piden salud): lo primero es poder elegir, no empezar vacío. */}
                {chosen.size === 0 && !health.accepted && meta?.starterQuests.every((q) => q.health_data) ? (
                  <Button title={t('onboarding:embudo.salud.revisar')} size="lg" onPress={health.ask} disabled={busy} />
                ) : null}
                <Button
                  title={chosen.size > 0 ? t('onboarding:misiones.crear', { count: chosen.size }) : t('onboarding:misiones.sinMisiones')}
                  size="lg"
                  variant={chosen.size > 0 ? 'primary' : 'secondary'}
                  onPress={saveStarters}
                  loading={busy}
                />
              </View>
            ) : null}
            {step === 5 && planListo ? (
              <Button title={t('onboarding:embudo.plan.empezar')} size="lg" onPress={trasPlan} loading={busy} />
            ) : null}
            {/* Mientras se decide, el pie queda vacío: ningún botón que cambie de
                sitio bajo el dedo. Si la espera se alarga, aparece una salida. */}
            {step === 6 && forma === 'esperar' && salidaEspera ? (
              <Button title={t('onboarding:entrar')} variant="ghost" size="lg" onPress={() => void finish()} loading={busy} />
            ) : null}
            {step === 6 && forma === 'hoja' ? (
              <OfertaModosAcciones
                oferta={oferta}
                etiquetaSalida={t('onboarding:coach.seguirGratis')}
                onSalir={() => void salir('cerrada')}
                saliendo={busy}
              />
            ) : null}
            {step === 6 && (forma === 'linea' || forma === 'saltar') ? (
              <Button title={t('onboarding:entrar')} size="lg" onPress={() => void finish()} loading={busy} />
            ) : null}
          </View>
        ) : null}
        </View>
        </TopeAncho.Provider>
      </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  columna: { flex: 1, width: '100%', maxWidth: ANCHO_COLUMNA + 2 * GUTTER, alignSelf: 'center' },
  top: { paddingHorizontal: GUTTER, paddingTop: 8 },
  backRow: { height: 44, justifyContent: 'center' },
  // Zona táctil de 44 × 44; el margen negativo deja la flecha alineada al canal.
  back: { alignSelf: 'flex-start', width: 44, height: 44, marginLeft: -12, alignItems: 'center', justifyContent: 'center' },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: GUTTER, paddingTop: 20, paddingBottom: 24 },
  ofertaEspera: { gap: 10, marginTop: 8 },
  segundaTarjeta: { marginTop: space.s3 },
  footer: {
    paddingHorizontal: GUTTER,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: vidrio.linea,
  },
  dosBotones: { gap: space.s3 },
  notaSalud: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink8, marginTop: space.s3 },
  starterRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: 44 },
  starterRowSep: { borderTopWidth: 1, borderTopColor: vidrio.linea },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: ink.ink6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: ink.ink10, borderColor: ink.ink10 },
  starterTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  starterOff: { color: ink.ink8 },
  starterMeta: { fontFamily: fonts.body, fontSize: 12, color: ink.ink8, marginTop: 2 },
});

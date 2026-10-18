import Ionicons from '@expo/vector-icons/Ionicons';
import { vibrar } from '@/design/haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Keyboard,
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
import { Campo, Entrada, TarjetaArena } from '@/components/arena';
import { HoldToSign } from '@/components/HoldToSign';
import { useHealthConsent } from '@/components/ConsentimientoSalud';
import {
  conTiempoLimite,
  DECISION_SALTAR,
  LECTURA_MAX_MS,
  pasoOferta,
  SALIDA_ESPERA_MS,
} from '@/components/onboarding/pasoOferta';
import { useCelebracion } from '@/components/celebracion/contexto';
import { PortadaArena } from '@/components/onboarding/PortadaArena';
import { AccionesConsentimiento, CuerpoConsentimiento } from '@/components/consentimiento/ConsentimientoAnalitica';
import { useConsentimientoAnalitica } from '@/components/consentimiento/useConsentimientoAnalitica';
import { ProgresoPasos } from '@/components/onboarding/ProgresoPasos';
import { TablillaContrato } from '@/components/onboarding/TablillaContrato';
import { TituloPaso } from '@/components/onboarding/TituloPaso';
import { ProOfferActions, ProOfferBody, ProOfferLegal, ProUpsellLine, useProOffer } from '@/components/ProOffer';
import { Button, Chip, Skeleton } from '@/components/ui';
import { avisar } from '@/components/ui/confirmar';
import { GutterContext } from '@/components/ui/Screen';
import { useAuth } from '@/lib/auth';
import {
  GOAL_DETAIL_MAX_LENGTH,
  GOAL_MAX_LENGTH,
  HORIZONTES,
  HORIZONTE_POR_DEFECTO,
  firmaValida,
  limpiarFrase,
  textoCompromiso,
  type Horizonte,
} from '@/lib/compromiso';
import { fetchLetter, sealLetter } from '@/lib/contract';
import { CODIGO_MAX_LENGTH, motivoReferral, normalizarCodigo } from '@/lib/creatormath';
import {
  claimReferral,
  guardarCodigoPendiente,
  leerCodigoPendiente,
  olvidarCodigoPendiente,
  type ReferralSource,
} from '@/lib/creators';
import { registrar, type SalidaOnboarding } from '@/lib/analitica';
import { createStarterQuests, deleteQuest, ensureProfile, fetchQuests, insertEvent, updateProfile } from '@/lib/data';
import { addDays, dateKey, fechaConAnio } from '@/lib/dates';
import { KINDS, PROFILE_KINDS, type ProfileKind } from '@/lib/kinds';
import { DIFFICULTY_LABEL, STAT_LABEL } from '@/lib/game';
import { anotarOferta, fetchAiStatus, isPro, ofrecerSi, type AiStatus, type DecisionOferta, type RespuestaOferta } from '@/lib/pro';
import { colors, fonts } from '@/lib/theme';
import { ink, type as tipo } from '@/design/tokens';
import { TopeAncho } from '@/design/useSizeClass';
import { t } from '@/i18n';
import { mayus } from '@/i18n/formato';
import { mensajeSistema, NAME_MAX_LENGTH } from '@/lib/validation';

// Bienvenida · Nombre · Para qué · El objetivo · Primeros hábitos · La firma · NIVL Pro
//
// El orden no es casual. Primero se dice para qué se está aquí, luego se
// eligen los hábitos que llevan hasta ahí, y solo entonces se firma: el
// compromiso ya tiene contenido. Pro va DESPUÉS de la firma, en el momento de
// más convicción, y con la salida gratuita a la misma altura que la compra.
const STEPS = 7;
/** Pasos de los que se puede volver: del nombre a la firma. Tras firmar, no. */
const PRIMER_PASO_CON_VUELTA = 1;
const ULTIMO_PASO_CON_VUELTA = 5;
/** Lo que dura el sello en pantalla si no se toca. */
const MS_SELLO = 1400;
/** Margen lateral del onboarding; lo publica GutterContext para lo que va a sangre. */
const GUTTER = 24;
/** Ancho útil de la columna del onboarding (sin el canal). */
const ANCHO_COLUMNA = 560;

// Nombres por defecto de la fila de perfil: si es uno de estos, no se
// prerrellena (que escriba el suyo).
const DEFAULT_NAMES = new Set(['Gladiador', 'Cazador']); // i18n-ok: valores por defecto de la base de datos, no se pintan

export default function Onboarding() {
  const health = useHealthConsent();
  const [healthGoal, setHealthGoal] = useState(false);
  const { session } = useAuth();
  const userId = session?.user.id;
  const [step, setStep] = useState(0);
  // Medición de uso (dictamen LSSI 3.1): con el flag encendido y sin decisión,
  // tras la portada y antes de cualquier otro paso, una pantalla propia con
  // «Rechazar» y «Aceptar» del mismo peso. Cualquiera de las dos sigue igual.
  const medicion = useConsentimientoAnalitica();
  const [preguntandoMedicion, setPreguntandoMedicion] = useState(false);
  const decidirMedicion = (acepta: boolean) => {
    if (acepta) medicion.aceptar();
    else medicion.rechazar();
    setPreguntandoMedicion(false);
    setStep(1);
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
  const [goal, setGoal] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [horizonte, setHorizonte] = useState<Horizonte>(HORIZONTE_POR_DEFECTO);
  const [firma, setFirma] = useState('');
  const campoFirma = useRef<TextInput>(null);
  const firmaPorResolver = useRef<{ body: string; openAt: string; years: Horizonte['years']; healthData: boolean } | null>(null);
  const [firmaPendiente, setFirmaPendiente] = useState(false);
  const [firmaSellada, setFirmaSellada] = useState<{ body: string; openAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  // Quien ya tiene coach (una cuenta de cortesía que rehace el onboarding) no
  // ve la oferta: tras firmar, entra.
  const yaEsPro = useRef(false);
  // La cuenta nunca tuvo coach: el paso 6 ofrece la prueba de 7 días.
  const [pruebaDisponible, setPruebaDisponible] = useState(false);
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
  const kindGuardado = useRef<ProfileKind | null>(null);
  // Mientras el dedo firma, el scroll se apaga: un milímetro de deriva le daba
  // el gesto al ScrollView y el anillo volvía a cero.
  const [holding, setHolding] = useState(false);
  const holdingRef = useRef(false);
  const [sello, setSello] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const selloEscala = useRef(new Animated.Value(1.5)).current;
  const selloOpacidad = useRef(new Animated.Value(0)).current;
  const selloTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        setPruebaDisponible(s.trialAvailable);
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

  const saveName = () =>
    withLock(async () => {
      if (!name.trim()) return;
      await updateProfile(userId!, { name: name.trim() });
      if (await reclamarCodigo()) setStep(2);
    });

  const saveKind = () =>
    withLock(async () => {
      if (!kind) return;
      await updateProfile(userId!, { profile_kind: kind });
      // Por defecto todos los hábitos propuestos marcados: quitar es un toque.
      // Solo al cambiar de perfil: volver atrás y seguir con el mismo no debe
      // deshacer lo que ya se había desmarcado.
      if (kindGuardado.current !== kind) {
        setChosen(new Set(KINDS[kind].starterQuests.flatMap((q, i) => health.accepted || !q.health_data ? [i] : [])));
        kindGuardado.current = kind;
      }
      setStep(3);
    });

  // El objetivo es una frase libre, no una meta medible: no cabe en `goals`
  // (que exige valor inicial y valor objetivo numéricos y paga XP al
  // cumplirse). Va a la crónica de eventos, donde el coach puede leerlo.
  const saveGoal = () =>
    withLock(async () => {
      if (!limpiarFrase(goal)) return;
      if (healthGoal && !health.accepted) { health.ask(); return; }
      const payload = {
        health_data: healthGoal,
        goal: limpiarFrase(goal),
        target: limpiarFrase(target) || null,
        deadline: limpiarFrase(deadline) || null,
        kind,
      };
      const huella = JSON.stringify(payload);
      if (objetivoGuardado.current !== huella) {
        await insertEvent(userId!, 'onboarding_goal', payload);
        objetivoGuardado.current = huella;
      }
      setStep(4);
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
      setFirma('');
      setStep(5);
    });

  const hoy = dateKey();
  const abreEl = addDays(hoy, horizonte.days);
  const contrato = textoCompromiso({
    name,
    goal,
    target,
    deadline,
    horizonte,
    firmadoEl: fechaConAnio(hoy),
    seAbreEl: fechaConAnio(abreEl),
  });

  const finish = (salida: SalidaOnboarding = 'sin_oferta') =>
    withLock(async () => {
      await updateProfile(userId!, { onboarding_done: true });
      registrar('onboarding_fin', { salida });
      router.replace('/(tabs)');
    });

  // La firma se sella como una carta al yo del futuro: aparece en Contrato y
  // se abre el día que vence el horizonte. El evento deja constancia en la
  // crónica sin revelar el texto.
  const sign = () =>
    withLock(async () => {
      if (sello || step !== 5) return;
      if (!firmaValida(firma, name)) { campoFirma.current?.focus(); return; }
      if (healthGoal && !health.accepted) { health.ask(); return; }
      // Un reintento (falló lo de después, o la app se cerró en el sello) no
      // sella otra carta igual ni repite el evento: si la última carta es
      // esta misma firma, se da por sellada.
      const intentoFirma = firmaPorResolver.current ?? {
        body: contrato, openAt: abreEl, years: horizonte.years, healthData: healthGoal,
      };
      const previa = await fetchLetter();
      const yaSellada = !!previa && previa.body === intentoFirma.body && previa.open_at === intentoFirma.openAt;
      if (!yaSellada) {
        // Preserve the same attempt if an INSERT response is lost. Do not let
        // a changed horizon silently replace an uncertain persisted letter.
        firmaPorResolver.current = intentoFirma;
        setFirmaPendiente(true);
        await sealLetter(userId!, intentoFirma.body, intentoFirma.openAt, intentoFirma.healthData);
        await insertEvent(userId!, 'commitment_signed', { years: intentoFirma.years, open_at: intentoFirma.openAt }).catch(() => {});
      }
      if (yaEsPro.current) await updateProfile(userId!, { onboarding_done: true });
      setFirmaSellada(intentoFirma);
      firmaPorResolver.current = null;
      setFirmaPendiente(false);
      setSello(true);
    });

  // El sello: un segundo y medio para que firmar pese. Se salta con un toque.
  const trasElSello = useCallback(() => {
    if (selloTimer.current) clearTimeout(selloTimer.current);
    selloTimer.current = null;
    setSello(false);
    if (yaEsPro.current) {
      registrar('onboarding_fin', { salida: 'ya_pro' });
      router.replace('/(tabs)');
    }
    else setStep(6);
  }, []);

  useEffect(() => {
    if (!sello) return;
    selloEscala.setValue(1.5);
    selloOpacidad.setValue(0);
    vibrar('nivel');
    Animated.parallel([
      Animated.spring(selloEscala, { toValue: 1, useNativeDriver: true, friction: 6, tension: 80 }),
      Animated.timing(selloOpacidad, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
    selloTimer.current = setTimeout(trasElSello, MS_SELLO);
    return () => {
      if (selloTimer.current) clearTimeout(selloTimer.current);
    };
  }, [sello, selloEscala, selloOpacidad, trasElSello]);

  const puedeVolver = step >= PRIMER_PASO_CON_VUELTA && step <= ULTIMO_PASO_CON_VUELTA && !busy && !sello && !firmaPendiente;
  const volver = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  // El botón físico respeta el bloqueo de la firma, incluso durante un reintento.
  // Fuera de ese bloqueo sigue el mismo recorrido que la flecha.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sello || busy || firmaPendiente || lock.current || holdingRef.current || firmaPorResolver.current) return true;
      if (!puedeVolver) return false;
      volver();
      return true;
    });
    return () => sub.remove();
  }, [puedeVolver, sello, busy, firmaPendiente, holding, volver]);

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
  const firmaOk = firmaValida(firma, name);
  // Salir del paso 6. La respuesta solo se apunta si se enseñó la hoja: la
  // línea no cuenta contra los topes y no hay nada que cerrar.
  const salir = async (respuesta: RespuestaOferta) => {
    if (decisionOferta?.forma === 'hoja') await anotarOferta('firma', respuesta, 'hoja');
    await finish(respuesta === 'vista' ? 'cerrada' : respuesta);
  };

  // La prueba de 7 días solo si la cuenta nunca tuvo coach Y la decisión la
  // incluye. Empezarla o comprar cierra el onboarding.
  const oferta = useProOffer({
    userId,
    onPurchased: () => void salir('compra'),
    trialAvailable: pruebaDisponible && (decisionOferta?.prueba ?? false),
    onTrialStarted: () => void salir('prueba'),
  });
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
  // Si la decisión pide otro nivel (Élite), se ajusta el que enseña la hoja.
  const { elegirNivel, tier: tierOferta } = oferta;
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
      const d = await ofrecerSi('firma', s, { celebrando: false });
      // Se guarda también el «no»: si entrar falla, el pie da el botón para reintentarlo.
      if (d.mostrar && d.tier !== tierOferta) elegirNivel(d.tier);
      setDecisionOferta(d);
      if (!d.mostrar) await finish();
    })().catch(() => {
      // ofrecerSi no lanza; si algo falla igual, se entra sin oferta.
      setDecisionOferta({ ...DECISION_SALTAR, razon: 'error' });
      void finish();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `finish` y el nivel se leen al decidir, una sola vez
  }, [step, decisionOferta, celebrando]);

  // Con una firma válida se baja hasta la acción. El teclado solo se cierra
  // con Hecho para permitir corregir o pegar el nombre sin perder el foco.
  useEffect(() => {
    if (step !== 5 || !firmaOk) return;
    const bajar = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 280);
    return () => clearTimeout(bajar);
  }, [firmaOk, step]);

  // Embudo anónimo: qué paso se ve (volver atrás lo repite; el panel cuenta
  // instalaciones distintas por paso).
  useEffect(() => {
    registrar('onboarding_paso', { paso: step });
  }, [step]);

  // Cada paso empieza arriba: el ScrollView es el mismo para todos y, si no,
  // la oferta de Pro heredaba el scroll del final de la firma.
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  const elegirKind = (k: ProfileKind) => {
    vibrar('seleccion');
    setKind(k);
  };
  const elegirHorizonte = (h: Horizonte) => {
    if (lock.current || holdingRef.current || firmaPorResolver.current || sello) return;
    vibrar('seleccion');
    setHorizonte(h);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Columna centrada: en iPad (1024-1366 pt) las tarjetas y los botones
            ocupaban todo el ancho. Cabecera, contenido y pie comparten el tope,
            y TopeAncho hace que la portada y las tarjetas midan contra él. */}
        <TopeAncho.Provider value={ANCHO_COLUMNA}>
        <View style={styles.columna}>
        {/* Cabecera fija: la vuelta atrás y el progreso. La fila de la flecha
            ocupa siempre su alto para que el progreso no salte entre pasos. La
            portada no la lleva: es la fachada entera. */}
        {step > 0 ? (
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
          <ProgresoPasos paso={step + 1} total={STEPS} />
        </View>
        ) : null}

        {/* Solo el KeyboardAvoidingView empuja: junto a
            automaticallyAdjustKeyboardInsets, iOS sumaba el teclado dos veces. */}
        <ScrollView
          ref={scroll}
          scrollEnabled={!holding}
          // La firma es un documento: se lee desde arriba. Centrada, en
          // pantallas altas dejaba un hueco negro sobre el título.
          contentContainerStyle={[styles.content, step === 5 && styles.contentArriba]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <GutterContext.Provider value={GUTTER}>

          {step === 0 && !preguntandoMedicion ? <PortadaArena key="paso-0" /> : null}

          {step === 0 && preguntandoMedicion ? (
            <Entrada key="paso-medicion" indice={0}>
              <TituloPaso inscripcion={t('perfil:medicion.eyebrow')} titulo={t('perfil:medicion.titulo')} />
              <CuerpoConsentimiento />
            </Entrada>
          ) : null}

          {step === 1 ? (
            <Entrada key="paso-1" indice={0}>
              <TituloPaso inscripcion={t('onboarding:nombre.inscripcion')} titulo={t('onboarding:nombre.titulo')} />
              <TarjetaArena variante="contorno" remaches>
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
              <TarjetaArena variante="contorno" remaches>
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

          {step === 2 ? (
            <Entrada key="paso-2" indice={0}>
              <TituloPaso
                inscripcion={t('onboarding:camino.inscripcion')}
                titulo={t('onboarding:camino.titulo')}
                pista={t('onboarding:camino.pista')}
              />
              {PROFILE_KINDS.map((k) => {
                const m = KINDS[k];
                const on = kind === k;
                return (
                  <Pressable
                    key={k}
                    onPress={() => elegirKind(k)}
                    style={[styles.kindCard, on && styles.kindCardOn]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={m.label}
                  >
                    <Ionicons name={m.icon as never} size={22} color={colors.accent} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.kindLabel, on && styles.kindLabelOn]}>{m.label.toUpperCase()}</Text>
                      <Text style={[styles.kindTagline, on && styles.kindTaglineOn]}>{m.tagline}</Text>
                    </View>
                  </Pressable>
                );
              })}
              {meta ? (
                <TarjetaArena variante="contorno" remaches style={{ marginTop: 6 }}>
                  <Text style={styles.detailTitle}>{mayus(t('onboarding:camino.queSeActiva'))}</Text>
                  <Text style={styles.detail}>{meta.description}</Text>
                </TarjetaArena>
              ) : null}
            </Entrada>
          ) : null}

          {step === 3 && meta ? (
            <Entrada key="paso-3" indice={0}>
              <TituloPaso
                inscripcion={t('onboarding:objetivo.inscripcion')}
                titulo={t('onboarding:objetivo.titulo')}
                pista={t('onboarding:objetivo.pista')}
              />
              <TarjetaArena variante="contorno" remaches>
                <Text style={styles.label}>{t('onboarding:objetivo.etiqueta')}</Text>
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: healthGoal }}
                  accessibilityLabel={t('onboarding:objetivo.salud')}
                  onPress={() => { if (!health.accepted && !healthGoal) { health.ask(); return; } setHealthGoal(v => !v); }}
                  style={styles.starterRow}>
                  <View style={[styles.checkbox, healthGoal && styles.checkboxOn]}>{healthGoal ? <Ionicons name="checkmark" size={14} color={colors.bg} /> : null}</View>
                  <Text style={[styles.detail, { flex: 1 }]}>{t('onboarding:objetivo.salud')}</Text>
                </Pressable>
                {!healthGoal ? <Text style={styles.stepHint}>{t('onboarding:objetivo.sinSalud')}</Text> : null}
                <TextInput
                  style={[styles.input, styles.inputMulti]}
                  value={goal}
                  onChangeText={setGoal}
                  placeholder={healthGoal ? meta.goalExample : t('onboarding:objetivo.ejemplo')}
                  placeholderTextColor={ink.ink6}
                  maxLength={GOAL_MAX_LENGTH}
                  multiline
                  accessibilityLabel={t('onboarding:objetivo.a11y')}
                />
                <View style={styles.pair}>
                  <View style={styles.pairItem}>
                    <Campo
                      etiqueta={t('onboarding:objetivo.cifra')}
                      estiloBloque={styles.labelGap}
                      value={target}
                      onChangeText={setTarget}
                      placeholder={healthGoal ? t('onboarding:objetivo.cifraEjemploSalud') : t('onboarding:objetivo.cifraEjemplo')}
                      maxLength={GOAL_DETAIL_MAX_LENGTH}
                      accessibilityLabel={t('onboarding:objetivo.cifraA11y')}
                    />
                  </View>
                  <View style={styles.pairItem}>
                    <Campo
                      etiqueta={t('onboarding:objetivo.fecha')}
                      estiloBloque={styles.labelGap}
                      value={deadline}
                      onChangeText={setDeadline}
                      placeholder={t('onboarding:objetivo.fechaEjemplo')}
                      maxLength={GOAL_DETAIL_MAX_LENGTH}
                      accessibilityLabel={t('onboarding:objetivo.fechaA11y')}
                    />
                  </View>
                </View>
              </TarjetaArena>
            </Entrada>
          ) : null}

          {step === 4 && meta ? (
            <Entrada key="paso-4" indice={0}>
              <TituloPaso
                inscripcion={t('onboarding:misiones.inscripcion')}
                titulo={t('onboarding:misiones.titulo')}
                pista={t('onboarding:misiones.pista', {
                  para: kind === 'general' ? t('onboarding:misiones.gladiador') : meta.label.toLowerCase(),
                })}
              />
              <TarjetaArena variante="contorno" remaches>
                {meta.starterQuests.map((q, i) => {
                  const on = chosen.has(i);
                  return (
                    <Pressable
                      key={q.title}
                      onPress={() => toggleStarter(i)}
                      style={[styles.starterRow, i > 0 && styles.starterRowSep]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={q.title}
                    >
                      <View style={[styles.checkbox, on && styles.checkboxOn]}>
                        {on ? <Ionicons name="checkmark" size={14} color={colors.bg} /> : null}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.starterTitle, !on && styles.starterOff]}>{q.title}</Text>
                        <Text style={styles.starterMeta}>
                          {t(q.health_data ? 'onboarding:misiones.metaSalud' : 'onboarding:misiones.meta', {
                            stat: STAT_LABEL[q.stat],
                            dificultad: DIFFICULTY_LABEL[q.difficulty],
                            frecuencia:
                              q.days_of_week.length === 7
                                ? t('onboarding:misiones.cadaDia')
                                : t('onboarding:misiones.diasSemana', { n: q.days_of_week.length }),
                          })}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </TarjetaArena>
            </Entrada>
          ) : null}

          {step === 5 ? (
            <Entrada key="paso-5" indice={0}>
              <TituloPaso
                inscripcion={t('onboarding:firma.inscripcion')}
                titulo={t('onboarding:firma.titulo')}
                pista={t('onboarding:firma.pista')}
              />
              <View style={styles.horizontes} accessibilityRole="radiogroup">
                {HORIZONTES.map((h) => (
                  <View key={h.years} style={styles.horizonte}>
                    <Chip
                      label={h.label}
                      selected={horizonte.years === h.years}
                      onPress={() => elegirHorizonte(h)}
                      disabled={busy || holding || firmaPendiente || sello}
                      accessibilityLabel={t(h.recomendado ? 'onboarding:firma.horizonteRecomendadoA11y' : 'onboarding:firma.horizonteA11y', { plazo: h.label })}
                      style={styles.horizonteChip}
                    />
                    <Text style={styles.recomendado}>{h.recomendado ? t('onboarding:firma.recomendado') : ' '}</Text>
                  </View>
                ))}
              </View>
              {/* El texto se revela párrafo a párrafo: se lee, no se acepta. */}
              <TablillaContrato parrafos={(firmaPorResolver.current?.body ?? firmaSellada?.body ?? contrato).split(/\n\s*\n/)} abreEl={fechaConAnio(firmaPorResolver.current?.openAt ?? firmaSellada?.openAt ?? abreEl)} rellenar={false} />
              <Text style={styles.smallPrint}>{t('onboarding:firma.letraPequena')}</Text>
              <TarjetaArena variante="contorno" style={styles.firmaCard}>
                <Campo
                  ref={campoFirma}
                  editable={!busy && !holding && !firmaPendiente && !sello}
                  etiqueta={t('onboarding:firma.campo')}
                  value={firma}
                  onChangeText={(value) => {
                    if (!lock.current && !holdingRef.current && !firmaPorResolver.current && !sello) setFirma(value);
                  }}
                  placeholder={name.trim()}
                  maxLength={NAME_MAX_LENGTH}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  accessibilityLabel={t('onboarding:firma.campo')}
                />
              </TarjetaArena>
              <HoldToSign
                label={firmaOk ? t('onboarding:firma.mantenPulsado') : t('onboarding:firma.escribeNombre')}
                onComplete={sign}
                onRequestInput={() => campoFirma.current?.focus()}
                onHoldChange={(value) => { holdingRef.current = value; setHolding(value); }}
                disabled={!firmaOk}
                loading={busy}
              />
            </Entrada>
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
                  <ProOfferBody oferta={oferta} kind={kind} compact motivo="firma" />
                  <ProOfferLegal oferta={oferta} />
                </>
              ) : null}
              {forma === 'linea' && decisionOferta ? <ProUpsellLine momento="firma" tier={decisionOferta.tier} /> : null}
            </Entrada>
          ) : null}
          </GutterContext.Provider>
        </ScrollView>

        {/* Pie fijo: la acción del paso siempre a la vista, también en 667 pt y
            con el teclado abierto. La firma no tiene pie: su botón es el anillo. */}
        {step !== 5 ? (
          <View style={styles.footer}>
            {step === 0 && !preguntandoMedicion ? (
              <Button
                title={t('onboarding:entrar')}
                size="lg"
                onPress={() => (medicion.preguntar ? setPreguntandoMedicion(true) : setStep(1))}
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
            {step === 2 ? (
              <Button title={t('onboarding:continuar')} size="lg" onPress={saveKind} loading={busy} disabled={!kind} />
            ) : null}
            {step === 3 ? (
              <Button title={t('onboarding:continuar')} size="lg" onPress={saveGoal} loading={busy} disabled={!limpiarFrase(goal)} />
            ) : null}
            {step === 4 ? (
              <Button
                title={chosen.size > 0 ? t('onboarding:misiones.crear', { count: chosen.size }) : t('onboarding:misiones.sinMisiones')}
                size="lg"
                onPress={saveStarters}
                loading={busy}
              />
            ) : null}
            {/* Mientras se decide, el pie queda vacío: ningún botón que cambie de
                sitio bajo el dedo. Si la espera se alarga, aparece una salida. */}
            {step === 6 && forma === 'esperar' && salidaEspera ? (
              <Button title={t('onboarding:entrar')} variant="ghost" size="lg" onPress={() => void finish()} loading={busy} />
            ) : null}
            {step === 6 && forma === 'hoja' ? (
              <ProOfferActions
                oferta={oferta}
                exitLabel={t('onboarding:coach.seguirGratis')}
                onExit={() => void salir('cerrada')}
                exitLoading={busy}
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

      {sello ? (
        <Pressable
          style={styles.sello}
          onPress={trasElSello}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding:sello.a11y', { fecha: fechaConAnio(firmaSellada?.openAt ?? abreEl) })}
        >
          <Animated.View style={{ alignItems: 'center', opacity: selloOpacidad, transform: [{ scale: selloEscala }] }}>
            <View style={styles.selloMarco}>
              <Text style={styles.selloTexto}>{mayus(t('onboarding:sello.titulo'))}</Text>
            </View>
          </Animated.View>
          <Animated.Text style={[styles.selloFecha, { opacity: selloOpacidad }]}>
            {t('onboarding:sello.vence', { fecha: fechaConAnio(firmaSellada?.openAt ?? abreEl) })}
          </Animated.Text>
        </Pressable>
      ) : null}
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
  contentArriba: { justifyContent: 'flex-start' },
  ofertaEspera: { gap: 10, marginTop: 8 },
  footer: {
    paddingHorizontal: GUTTER,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
  stepHint: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    color: ink.ink8,
    textAlign: 'center',
    lineHeight: tipo.bodySm.lineHeight,
    marginBottom: 16,
  },
  label: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    color: ink.ink6,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  labelGap: { marginTop: 14 },
  // Solo el objetivo (multilínea, con la casilla de salud entre el rótulo y
  // la caja); el resto de campos son Campo. Misma caja que Campo.
  input: {
    borderWidth: 1,
    borderColor: ink.ink4,
    backgroundColor: ink.ink2,
    color: ink.ink9,
    fontFamily: tipo.body.family,
    fontSize: tipo.body.size,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputMulti: { minHeight: 76, textAlignVertical: 'top', lineHeight: 22 },
  pair: { flexDirection: 'row', gap: 10 },
  pairItem: { flex: 1, minWidth: 0 },
  kindCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: colors.accentDim,
    backgroundColor: colors.panel,
    padding: 14,
    marginBottom: 10,
  },
  // Elegido = marco de 3 en blanco, no invertido: la inversión del paso es «Continuar».
  // El padding baja lo que sube el borde para que la tarjeta no crezca al elegirla.
  kindCardOn: { borderWidth: 3, borderColor: colors.accent, padding: 12 },
  kindLabel: { fontFamily: fonts.heading, fontSize: 14, letterSpacing: 2, color: colors.text },
  kindLabelOn: { color: colors.accent },
  kindTagline: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, color: ink.ink8, marginTop: 3, lineHeight: tipo.bodySm.lineHeight },
  kindTaglineOn: { color: colors.text },
  detailTitle: { fontFamily: tipo.label.family, fontSize: tipo.label.size, lineHeight: tipo.label.lineHeight, letterSpacing: tipo.label.tracking, color: ink.ink6, marginBottom: 6 },
  detail: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, color: ink.ink9, lineHeight: tipo.bodySm.lineHeight },
  starterRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: 44 },
  starterRowSep: { borderTopWidth: 1, borderTopColor: colors.line },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  starterTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  starterOff: { color: colors.textFaint },
  starterMeta: { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint, marginTop: 2, letterSpacing: 0.5 },
  horizontes: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  horizonte: { flex: 1, alignItems: 'stretch' },
  horizonteChip: { justifyContent: 'center' },
  recomendado: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.accentText,
    textAlign: 'center',
    marginTop: 6,
  },
  sello: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  selloMarco: { borderWidth: 1.5, borderColor: colors.accent, paddingHorizontal: 26, paddingVertical: 14 },
  selloTexto: { fontFamily: fonts.heading, fontSize: 34, letterSpacing: 10, color: colors.accent, marginRight: -10 },
  selloFecha: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: colors.textDim,
    marginTop: 22,
    textAlign: 'center',
  },
  firmaCard: { marginTop: 14 },
  smallPrint: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    color: ink.ink6,
    textAlign: 'center',
    lineHeight: tipo.bodySm.lineHeight,
    marginTop: 4,
  },
});

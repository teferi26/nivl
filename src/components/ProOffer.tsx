// NIVL · La oferta de NIVL Pro y Élite: qué hace el coach en cada nivel, sus
// planes, la acción y la letra pequeña. La comparten la pantalla `/pro` y el último paso del
// onboarding (`compact`), para que el precio y las condiciones no puedan
// decir una cosa en un sitio y otra en otro.
//
// Reglas de esta pieza, que no son de estilo: nada de urgencia falsa, ni
// cuentas atrás, ni testimonios; la salida gratuita pesa lo mismo que la
// compra; y mientras la tienda no esté conectada (`purchasesAvailable()`), el
// botón apunta el interés y lo dice, en vez de fingir un cobro: sin selector
// de plan, sin "restaurar compras" y sin letra de renovación automática.
//
// Con la tienda abierta (binario 1.0.7 con clave de RevenueCat): selector con
// los precios QUE DA LA TIENDA (son los que se cobran), "Restaurar compras",
// letra de renovación y enlaces legales. El Élite fundador solo sale mientras
// `founder_seats_left()` > 0. Apple 2.1/3.1.2: los CINCO productos se ven a la
// vez en el selector (Pro y Élite, sin pasos ocultos), cada uno con su título
// de App Store Connect ("NIVL Élite fundador"), su duración y su `priceString`;
// Términos y Privacidad (y en iOS el EULA estándar de Apple) a la vista.
//
// El nivel elegido (Pro / Élite) vive en `useProOffer`, no en el cuerpo: así el
// pie fijo del onboarding y el cuerpo del scroll hablan del mismo nivel. Si la
// cuenta nunca tuvo coach, la acción principal es la prueba de 7 días.
//
// Fase 2 (D1): con `motivo` (el momento que trajo aquí, `paywallmoment.ts`) la
// oferta abre con una línea de contexto y pone primero el beneficio que casa;
// no quita ni añade ninguno. El importe que se cobra (el `priceString` de la
// tienda) es SIEMPRE la cifra más destacada de cada plan: ningún equivalente
// mensual de un anual compite con él. `ProUpsellLine` es la versión no modal
// (fila con icono, una línea y chevron) que lleva a `/pro?motivo=…&tier=…`.

import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useConsentimientoIA } from '@/components/ConsentimientoIA';
import { SystemButton } from '@/components/SystemButton';
import { Card, Chip, Skeleton, Tag } from '@/components/ui';
import { insertEvent } from '@/lib/data';
import {
  COACH_USAGE_NOTICE,
  DEFAULT_TIER,
  ELITE_BENEFITS,
  ELITE_USAGE_NOTICE,
  LEGAL_URLS,
  PRO_BENEFITS,
  StorePriceChangedError,
  TIERS,
  beneficiosPorMotivo,
  copyUpsell,
  duracionPlan,
  fetchFounderSeatsLeft,
  introsDeTienda,
  legalText,
  pitchVisible,
  planPorDefecto,
  planesALaVenta,
  planesDeTienda,
  precioVisible,
  preciosDeTienda,
  proEmphasis,
  proPlan,
  purchase,
  purchasesAvailable,
  restorePurchases,
  rutaOferta,
  seleccionDeTienda,
  startTrial,
  tierOffer,
  tituloPlan,
  type Momento,
  type OfferTier,
  type PreciosTienda,
  type ProPlanId,
} from '@/lib/pro';
import { colors, fonts } from '@/lib/theme';
import { mensajeSistema } from '@/lib/validation';

/** La tienda cobró pero el servidor aún no refleja la suscripción. Con salida: Restaurar. */
const AVISO_PENDIENTE =
  'Compra confirmada por la tienda. El coach se activa en unos segundos; si no aparece, pulsa Restaurar compras.';
/** Cambio de plan que la tienda aplica en la próxima renovación (Élite → Pro, anual ↔ mensual). */
const AVISO_PROGRAMADA =
  'Cambio confirmado por la tienda. Se aplica en tu próxima renovación; hasta entonces sigues con tu plan actual.';

interface OfferOptions {
  userId?: string;
  /** Tras una compra o una restauración confirmadas por la tienda. */
  onPurchased?: () => void;
  /** La cuenta nunca tuvo coach: puede probarlo 7 días (`ai_status.trial_available`). */
  trialAvailable?: boolean;
  /** Tras empezar la prueba: releer el estado o seguir adelante. */
  onTrialStarted?: () => void;
  /** El nivel que se enseña primero (un Pro que mira el Élite). */
  initialTier?: OfferTier;
  /** El producto que la cuenta YA paga en la tienda (lo dice el servidor): se marca y no se vende otra vez. */
  planActual?: ProPlanId | null;
}

/**
 * El estado de la oferta, separado de su pintura. Existe para que el
 * onboarding pueda poner el cuerpo dentro de su scroll y los dos botones en un
 * pie fijo (en un móvil de 667 pt, si no, no se veía ningún botón sin bajar) y
 * que aun así compartan plan elegido, cerrojo y avisos.
 */
export function useProOffer({ userId, onPurchased, trialAvailable, onTrialStarted, initialTier, planActual }: OfferOptions) {
  const [tier, setTier] = useState<OfferTier>(initialTier ?? DEFAULT_TIER);
  const [elegido, setPlanId] = useState<ProPlanId>(tierOffer(initialTier ?? DEFAULT_TIER).defaultPlan);
  const [busy, setBusy] = useState<'compra' | 'restaurar' | 'prueba' | null>(null);
  const [anotado, setAnotado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // El servidor dijo "ya_usada": la prueba desaparece aunque el estado leído
  // al abrir dijera lo contrario.
  const [pruebaUsada, setPruebaUsada] = useState(false);
  // Con la tienda abierta: plazas de fundador (null = no se sabe, se enseña)
  // y los precios de la tienda, que son los que se cobran.
  const [plazas, setPlazas] = useState<number | null>(null);
  const [precios, setPrecios] = useState<PreciosTienda>({});
  // Oferta introductoria que la tienda declare (hoy ninguna): se dice, nunca se calla.
  const [intros, setIntros] = useState<Partial<Record<ProPlanId, string>>>({});
  const [catalogo, setCatalogo] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [intento, setIntento] = useState(0);
  const lock = useRef(false);
  // Antes de la prueba o de la compra, el consentimiento para la IA (0028):
  // pagar o probar un coach al que no se le pueden enviar datos no tiene sentido.
  const consentimiento = useConsentimientoIA();

  const disponible = purchasesAvailable();

  useEffect(() => {
    if (!disponible) return;
    let vivo = true;
    // Sin saber si la tienda aplica una oferta introductoria no se vende: si
    // falla, el catálogo entero cuenta como error (Reintentar precios).
    Promise.all([preciosDeTienda(), introsDeTienda(), fetchFounderSeatsLeft().catch(() => null)])
      .then(([p, i, n]) => {
        if (!vivo) return;
        setPrecios(p);
        setIntros(i ?? {});
        setPlazas(n);
        setCatalogo('listo');
      })
      .catch(() => {
        if (!vivo) return;
        setPrecios({});
        setCatalogo('error');
      });
    return () => {
      vivo = false;
    };
  }, [disponible, intento]);

  const nivel = tierOffer(tier);
  // Con tienda: TODOS los productos que la tienda da, de los dos niveles, en
  // una sola lista (Apple pide ver cada suscripción sin pasos ocultos). El que
  // ya se paga no cuenta como elegible. Sin tienda: la lista del nivel.
  const planesTienda = disponible
    ? TIERS.flatMap((t) => planesDeTienda(t.id, plazas, precios))
    : planesALaVenta(tier, plazas);
  const planes = planesTienda;
  const comprables = disponible ? planes.filter((p) => p.id !== planActual) : planes;
  const seleccionado =
    comprables.find((p) => p.id === elegido) ??
    seleccionDeTienda(comprables.filter((p) => p.tier === tier), elegido) ??
    seleccionDeTienda(comprables, elegido);
  const plan = seleccionado ?? proPlan(elegido);
  const planId = plan.id;
  const precioDe = (id: ProPlanId) => precioVisible(precios[id]);
  const puedeComprar = disponible && catalogo === 'listo' && seleccionado !== null;
  /** Productos que la tienda no ha devuelto (sin contar el fundador agotado). */
  const faltan = disponible && catalogo === 'listo' ? TIERS.flatMap((t) => planesALaVenta(t.id, plazas)).length - planes.length : 0;
  const prueba = !!trialAvailable && !pruebaUsada;

  const reintentarPrecios = () => {
    if (lock.current) return;
    setPrecios({});
    setCatalogo('cargando');
    setIntento((n) => n + 1);
  };

  const conCerrojo = async (que: 'compra' | 'restaurar' | 'prueba', fn: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(que);
    setAviso(null);
    try {
      await fn();
    } catch (e) {
      setAviso(mensajeSistema(e));
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };

  const onPrincipal = async () => {
    if (lock.current) return;
    const precio = precioDe(planId);
    if (disponible && (!puedeComprar || !precio)) return;
    if (disponible && !(await consentimiento.asegurar())) return;
    return conCerrojo('compra', async () => {
      if (disponible) {
        const r = await purchase(planId, precio!).catch((e: unknown) => {
          if (e instanceof StorePriceChangedError) {
            setPrecios({});
            setCatalogo('cargando');
            setIntento((n) => n + 1);
          }
          throw e;
        });
        // Cerrar la hoja de pago no es un error: aquí no ha pasado nada.
        if (r === 'cancelada') return;
        if (r === 'pendiente') setAviso(AVISO_PENDIENTE);
        if (r === 'programada') setAviso(AVISO_PROGRAMADA);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        onPurchased?.();
        return;
      }
      // Sin tienda todavía: se apunta el interés en los eventos de la cuenta.
      // No hay tabla nueva ni cobro, y tampoco plan: sin tienda no se elige.
      // Best-effort: apuntar el interés es informativo. Si falla (sin red, o el
      // trigger de consentimiento de salud de la 0030), no hay error que enseñar.
      if (userId) {
        try {
          await insertEvent(userId, 'pro_interest', { plan: null, tier });
        } catch {
          /* informativo */
        }
      }
      setAnotado(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    });
  };

  const onPrueba = async () => {
    if (lock.current) return;
    if (!(await consentimiento.asegurar())) return;
    return conCerrojo('prueba', async () => {
      const r = await startTrial();
      if (!r.ok) {
        setPruebaUsada(true);
        setAviso('La prueba ya se usó en esta cuenta.');
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onTrialStarted?.();
    });
  };

  const onRestaurar = () =>
    conCerrojo('restaurar', async () => {
      const r = await restorePurchases();
      if (r === 'nada') {
        setAviso('Esta cuenta de la tienda no tiene ninguna suscripción de NIVL activa.');
        return;
      }
      if (r === 'pendiente') setAviso(AVISO_PENDIENTE);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onPurchased?.();
    });

  const elegir = (id: ProPlanId) => {
    if (lock.current || (disponible && !comprables.some((p) => p.id === id))) return;
    Haptics.selectionAsync().catch(() => {});
    setPlanId(id);
    // Elegir un plan del otro nivel cambia también lo que se enseña de él.
    setTier(proPlan(id).tier);
  };

  const elegirNivel = (t: OfferTier) => {
    if (lock.current || t === tier) return;
    Haptics.selectionAsync().catch(() => {});
    setTier(t);
    setPlanId(planPorDefecto(t, plazas));
  };

  // Aviso propio, pintado junto a los enlaces: el de la compra sale encima de
  // los botones, demasiado lejos de donde se ha tocado.
  const [avisoEnlace, setAvisoEnlace] = useState(false);
  const abrir = (url: string) => {
    setAvisoEnlace(false);
    Linking.openURL(url).catch(() => setAvisoEnlace(true));
  };

  return {
    tier,
    nivel,
    planes,
    planId,
    plan,
    precios,
    intros,
    precioDe,
    catalogo,
    faltan,
    planActual: planActual ?? null,
    puedeComprar,
    reintentarPrecios,
    busy,
    anotado,
    aviso,
    avisoEnlace,
    disponible,
    prueba,
    elegir,
    elegirNivel,
    onPrincipal,
    onPrueba,
    onRestaurar,
    abrir,
    hojaConsentimiento: consentimiento.hoja,
  };
}

export type ProOfferState = ReturnType<typeof useProOffer>;

interface BodyProps {
  oferta: ProOfferState;
  /** `profile.profile_kind`: decide la línea de énfasis. */
  kind: unknown;
  /** Versión condensada para el onboarding: beneficios a dos columnas, sin énfasis. */
  compact?: boolean;
  /** El momento que trajo a la oferta: línea de contexto y su beneficio primero. */
  motivo?: Momento | null;
}

/** Qué hace el coach y cuánto cuesta. Sin botones. */
export function ProOfferBody({ oferta, kind, compact, motivo }: BodyProps) {
  const { tier, nivel, planes, planId, precioDe, catalogo, faltan, planActual, busy, reintentarPrecios, disponible, elegir, elegirNivel, prueba } = oferta;
  const sinNivel = disponible && catalogo === 'listo' && planes.length > 0 && !planes.some((p) => p.tier === tier);
  const beneficios = beneficiosPorMotivo(tier === 'elite' ? [...ELITE_BENEFITS, ...PRO_BENEFITS] : PRO_BENEFITS, motivo, tier);
  const contexto = motivo ? copyUpsell(motivo, tier).contexto : null;
  // Con la tienda abierta en /pro, los planes (título, duración y precio) van
  // antes que los beneficios: es lo que Apple pide ver sin buscarlo (2.1).
  const planesArriba = disponible && !compact;
  const catalogoVista = (disponible && catalogo === 'cargando' ? (
        <View style={styles.plans} accessibilityRole="progressbar" accessibilityLabel="Cargando precios de la tienda">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={70} />
          ))}
        </View>
      ) : disponible && (catalogo === 'error' || planes.length === 0) ? (
        <Card variant="outline">
          <Text style={[styles.notice, styles.noticeAbove]} accessibilityRole="alert">
            {catalogo === 'error'
              ? 'No se han podido cargar los precios de la tienda. Puedes reintentarlo o seguir gratis.'
              : `La tienda no tiene planes de ${nivel.name} disponibles ahora. Puedes reintentarlo o seguir gratis.`}
          </Text>
          <SystemButton title="Reintentar precios" variant="outline" size="sm" onPress={reintentarPrecios} disabled={busy !== null} />
        </Card>
      ) : disponible ? (
        <View accessibilityRole="radiogroup" accessibilityLabel="Suscripciones" style={styles.plans}>
          {sinNivel ? (
            <Text style={[styles.notice, styles.noticeLeft]} accessibilityRole="alert">
              {`La tienda no tiene planes de ${nivel.name} disponibles ahora.`}
            </Text>
          ) : null}
          {sinNivel ? (
            <SystemButton title="Reintentar precios" variant="outline" size="sm" onPress={reintentarPrecios} disabled={busy !== null} />
          ) : null}
          {planes.map((p) => {
            const actual = p.id === planActual;
            const on = p.id === planId && !actual;
            const precio = precioDe(p.id);
            const titulo = tituloPlan(p.id);
            const duracion = duracionPlan(p.id);
            const pitch = pitchVisible(p);
            return (
              <Pressable
                key={p.id}
                onPress={() => elegir(p.id)}
                disabled={actual}
                style={({ pressed }) => [styles.plan, on && styles.planOn, pressed && !actual && styles.pressed]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on, disabled: actual }}
                accessibilityLabel={`${titulo}. Suscripción ${p.period === 'mes' ? 'mensual' : 'anual'} de renovación automática, ${precio} al ${p.period}. ${actual ? 'Tu plan actual' : pitch}`}
              >
                {actual ? null : (
                  <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
                )}
                <View style={styles.planBody}>
                  {actual ? (
                    <View style={styles.planHead}>
                      <Tag>Tu plan actual</Tag>
                    </View>
                  ) : null}
                  <Text style={styles.planTitle} numberOfLines={2}>
                    {titulo}
                  </Text>
                  <Text style={styles.planDuration} numberOfLines={2}>
                    {`${duracion} · renovación automática · ${pitch}`}
                  </Text>
                </View>
                <View style={styles.planPrice}>
                  <Text style={styles.price} numberOfLines={1}>
                    {precio}
                  </Text>
                  <Text style={styles.period}>al {p.period}</Text>
                </View>
              </Pressable>
            );
          })}
          {faltan > 0 ? (
            <Text style={[styles.notice, styles.noticeLeft]}>
              Algún plan no está disponible ahora mismo en la tienda. Solo se muestran los que la tienda confirma.
            </Text>
          ) : null}
        </View>
      ) : (
        // Sin tienda no hay nada que elegir: los precios se enseñan, no se
        // seleccionan. Un selector que no selecciona nada era media mentira.
        <View style={styles.priceList}>
          <Text style={styles.priceListTitle}>PRECIOS DE REFERENCIA · {nivel.name.toUpperCase()}</Text>
          {planes.map((p, i) => (
            <View
              key={p.id}
              style={[styles.priceRow, i > 0 && styles.sep]}
              accessible
              accessibilityLabel={`${nivel.name} ${p.label.toLowerCase()}: ${p.price} al ${p.period}. ${p.pitch}`}
            >
              <View style={styles.planBody}>
                <View style={styles.planHead}>
                  <Text style={styles.planLabel}>{p.label.toUpperCase()}</Text>
                  {p.savings ? <Tag>{p.savings}</Tag> : null}
                </View>
                <Text style={styles.planPitch}>{p.pitch}</Text>
              </View>
              <View style={styles.planPrice}>
                <Text style={styles.price}>{p.price}</Text>
                <Text style={styles.period}>al {p.period}</Text>
              </View>
            </View>
          ))}
          <Text style={[styles.notice, styles.noticeLeft]}>
            Precios de referencia en euros. La tienda confirma el importe y la moneda al abrir las suscripciones.
            Las compras no están disponibles en esta versión. Hoy no se cobra nada.
          </Text>
        </View>
      )
  );
  return (
    <View>
      {contexto ? <Text style={[styles.emphasis, styles.contexto]}>{contexto}</Text> : null}
      {compact ? null : (
        <Card variant="outline" accent={colors.accentDim}>
          <Text style={styles.emphasis}>{proEmphasis(kind)}</Text>
        </Card>
      )}

      <View style={styles.niveles} accessibilityRole="radiogroup" accessibilityLabel="Nivel">
        {TIERS.map((t) => (
          <Chip
            key={t.id}
            label={t.label}
            selected={t.id === tier}
            onPress={() => elegirNivel(t.id)}
            accessibilityLabel={`${t.name}. ${t.power}`}
          />
        ))}
      </View>
      <Text style={styles.potencia}>{nivel.power}</Text>
      {planesArriba ? catalogoVista : null}

      {compact ? (
        <View style={styles.benefitGrid}>
          {beneficios.map((b) => (
            <View key={b.title} style={styles.benefitCell}>
              <Ionicons name={b.icon as never} size={15} color={colors.accentText} style={styles.benefitIcon} />
              <Text style={styles.benefitCellTitle} numberOfLines={2}>
                {b.title}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.benefits}>
          {beneficios.map((b, i) => (
            <View key={b.title} style={[styles.benefit, i > 0 && styles.sep]}>
              <Ionicons name={b.icon as never} size={18} color={colors.accentText} style={styles.benefitIcon} />
              <View style={styles.benefitBody}>
                <Text style={styles.benefitTitle}>{b.title}</Text>
                <Text style={styles.benefitDetail}>{b.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.usageNotice}>{COACH_USAGE_NOTICE}</Text>
      {tier === 'elite' ? <Text style={styles.usageNotice}>{ELITE_USAGE_NOTICE}</Text> : null}

      {planesArriba ? null : catalogoVista}
      {disponible && prueba ? (
        <Text style={[styles.notice, styles.noticeLeft, styles.noticeBelow]}>
          Siete días con el coach, sin tarjeta y sin cobro. Al acabar, tus hábitos y tu progreso siguen disponibles gratis.
        </Text>
      ) : null}
    </View>
  );
}

interface ActionsProps {
  oferta: ProOfferState;
  /** La salida gratuita: "Seguir gratis". Siempre visible, nunca escondida. */
  exitLabel: string;
  onExit: () => void;
  exitLoading?: boolean;
}

/** Los dos botones, del mismo tamaño, y lo que el sistema responde al pulsarlos. */
export function ProOfferActions({ oferta, exitLabel, onExit, exitLoading }: ActionsProps) {
  const { plan, precioDe, catalogo, puedeComprar, busy, anotado, aviso, disponible, prueba, onPrincipal, onPrueba, hojaConsentimiento } = oferta;
  const activar = puedeComprar
    ? `Activar ${tituloPlan(plan.id)} · ${precioDe(plan.id)}/${plan.period}`
    : catalogo === 'cargando' ? 'Cargando precios de la tienda' : 'Compra no disponible';
  return (
    <View>
      {anotado ? (
        <Text style={[styles.notice, styles.noticeAbove]} accessibilityLiveRegion="polite">
          Anotado. El sistema te avisará cuando abran las suscripciones. Hoy no se cobra nada.
        </Text>
      ) : null}
      {aviso ? (
        <Text style={[styles.notice, styles.noticeAbove, styles.noticeWarn]} accessibilityRole="alert">
          {aviso}
        </Text>
      ) : null}
      {prueba ? (
        <>
          <SystemButton
            title="Probar el coach 7 días"
            size="lg"
            icon="hourglass-outline"
            onPress={onPrueba}
            loading={busy === 'prueba'}
            disabled={busy !== null && busy !== 'prueba'}
          />
          {/* Con la tienda abierta, quien ya lo tiene claro no pasa por la
              prueba: el plan elegido en el selector, en un botón discreto. */}
          {disponible ? (
            <SystemButton
              title={activar}
              variant="ghost"
              size="sm"
              onPress={onPrincipal}
              loading={busy === 'compra'}
              disabled={!puedeComprar || (busy !== null && busy !== 'compra')}
              style={styles.directo}
            />
          ) : null}
        </>
      ) : (
        <SystemButton
          title={disponible ? activar : anotado ? 'Anotado' : 'Avísame cuando abra'}
          size="lg"
          icon={disponible ? undefined : anotado ? 'checkmark' : 'notifications-outline'}
          onPress={onPrincipal}
          loading={busy === 'compra'}
          disabled={anotado || (disponible && !puedeComprar) || (busy !== null && busy !== 'compra')}
        />
      )}
      <SystemButton
        title={exitLabel}
        variant="outline"
        size="lg"
        onPress={onExit}
        loading={exitLoading}
        disabled={busy !== null}
        style={styles.exit}
      />
      {hojaConsentimiento}
    </View>
  );
}

/**
 * Lo que exigen las tiendas para una suscripción autorrenovable: restaurar, la
 * letra pequeña y los enlaces legales. SOLO cuando se puede comprar: con la
 * tienda cerrada, hablar de renovación automática y ofrecer "restaurar" una
 * compra que no puede existir contradecía el "hoy no se cobra nada".
 */
export function ProOfferLegal({ oferta }: { oferta: ProOfferState }) {
  const { planId, precios, intros, puedeComprar, busy, disponible, avisoEnlace, onRestaurar, abrir } = oferta;
  if (!disponible) return null;
  return (
    <View>
      <SystemButton
        title="Restaurar compras"
        variant="ghost"
        size="sm"
        onPress={onRestaurar}
        loading={busy === 'restaurar'}
        disabled={busy !== null && busy !== 'restaurar'}
        style={styles.restore}
      />
      {puedeComprar ? <Text style={styles.legal}>{legalText(planId, precios[planId], intros[planId], Platform.OS)}</Text> : null}
      <View style={styles.links}>
        <Pressable
          onPress={() => abrir(LEGAL_URLS.terminos)}
          hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
          accessibilityRole="link"
          accessibilityLabel="Términos de uso"
        >
          <Text style={styles.link}>Términos de uso</Text>
        </Pressable>
        <Text style={styles.linkSep}>·</Text>
        <Pressable
          onPress={() => abrir(LEGAL_URLS.privacidad)}
          hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
          accessibilityRole="link"
          accessibilityLabel="Política de privacidad"
        >
          <Text style={styles.link}>Política de privacidad</Text>
        </Pressable>
        {/* Sin EULA propio en App Store Connect: aplica el estándar de Apple. */}
        {Platform.OS === 'ios' ? (
          <>
            <Text style={styles.linkSep}>·</Text>
            <Pressable
              onPress={() => abrir(LEGAL_URLS.eulaApple)}
              hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
              accessibilityRole="link"
              accessibilityLabel="Contrato de licencia de usuario final de Apple (EULA)"
            >
              <Text style={styles.link}>EULA de Apple</Text>
            </Pressable>
          </>
        ) : null}
      </View>
      {avisoEnlace ? (
        <Text style={[styles.notice, styles.noticeWarn]} accessibilityRole="alert">
          No se ha podido abrir el enlace.
        </Text>
      ) : null}
    </View>
  );
}

interface Props extends OfferOptions, Omit<ActionsProps, 'oferta'> {
  kind: unknown;
  compact?: boolean;
  /** El momento que trajo a la oferta (`/pro?motivo=…`). */
  motivo?: Momento | null;
}

/** La oferta entera, en columna: la pantalla `/pro`. */
export function ProOffer({
  userId,
  kind,
  compact,
  exitLabel,
  onExit,
  exitLoading,
  onPurchased,
  trialAvailable,
  onTrialStarted,
  initialTier,
  planActual,
  motivo,
}: Props) {
  const oferta = useProOffer({ userId, onPurchased, trialAvailable, onTrialStarted, initialTier, planActual });
  return (
    <View>
      <ProOfferBody oferta={oferta} kind={kind} compact={compact} motivo={motivo} />
      <ProOfferActions oferta={oferta} exitLabel={exitLabel} onExit={onExit} exitLoading={exitLoading} />
      <ProOfferLegal oferta={oferta} />
    </View>
  );
}

interface UpsellLineProps {
  momento: Momento;
  /** El nivel que se ofrece (`decidirOferta(...).tier`). */
  tier: OfferTier;
  /** Por defecto abre `/pro?motivo=…&tier=…`. */
  onPress?: () => void;
}

/**
 * La oferta NO modal: una fila con icono, una línea y chevron, para ponerla
 * junto a la función (modo profundo, fotos, energía). No tapa nada ni se abre
 * sola: la oferta completa solo aparece si el usuario la toca.
 */
export function ProUpsellLine({ momento, tier, onPress }: UpsellLineProps) {
  const copy = copyUpsell(momento, tier);
  const abrir = onPress ?? (() => router.push(rutaOferta(momento, tier) as never));
  return (
    <Pressable
      onPress={abrir}
      style={({ pressed }) => [styles.upsell, pressed && styles.pressed]}
      accessibilityRole="link"
      accessibilityLabel={`${copy.linea} ${copy.enlace}`}
      accessibilityHint="Abre los planes. No se cobra nada sin confirmarlo en la tienda."
    >
      <Ionicons name={(tier === 'elite' ? 'flash-outline' : 'sparkles-outline') as never} size={16} color={colors.accentText} />
      <View style={styles.planBody}>
        <Text style={styles.benefitDetail} numberOfLines={2}>
          {copy.linea}
        </Text>
        <Text style={styles.link}>{copy.enlace}</Text>
      </View>
      <Ionicons name={'chevron-forward' as never} size={16} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  emphasis: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 21, color: colors.text },
  contexto: { marginBottom: 12 },
  upsell: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 11 },
  niveles: { flexDirection: 'row', gap: 8, marginTop: 4 },
  potencia: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textDim, marginTop: 8, marginBottom: 6 },
  benefits: { marginTop: 6, marginBottom: 18 },
  benefit: { flexDirection: 'row', gap: 12, paddingVertical: 11 },
  sep: { borderTopWidth: 1, borderTopColor: colors.line },
  benefitIcon: { marginTop: 1 },
  benefitBody: { flex: 1, minWidth: 0 },
  benefitTitle: { fontFamily: fonts.semibold, fontSize: 14.5, lineHeight: 20, color: colors.text },
  benefitDetail: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textDim, marginTop: 2 },
  benefitGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  benefitCell: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 6,
    paddingRight: 10,
  },
  benefitCellTitle: { flex: 1, minWidth: 0, fontFamily: fonts.semibold, fontSize: 13, lineHeight: 17, color: colors.text },
  plans: { gap: 10, marginBottom: 16 },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  planOn: { borderColor: colors.accent, borderWidth: 1.5, backgroundColor: colors.accentFaint },
  pressed: { opacity: 0.7 },
  priceList: {
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  priceListTitle: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 2.2, color: colors.textFaint, marginBottom: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  planBody: { flex: 1, minWidth: 0 },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planLabel: { fontFamily: fonts.heading, fontSize: 13, letterSpacing: 2, color: colors.text },
  planTitle: { fontFamily: fonts.semibold, fontSize: 14.5, lineHeight: 19, color: colors.text },
  planDuration: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.accentText, marginTop: 2 },
  planPitch: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: colors.textDim, marginTop: 3 },
  planPrice: { alignItems: 'flex-end' },
  price: { fontFamily: fonts.number, fontSize: 17, color: colors.text },
  period: { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint, marginTop: 1 },
  exit: { marginTop: 10 },
  directo: { marginTop: 6, alignSelf: 'center' },
  notice: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.accentText,
    textAlign: 'center',
    marginTop: 12,
  },
  noticeLeft: { textAlign: 'left', marginTop: 8 },
  noticeAbove: { marginTop: 0, marginBottom: 10 },
  noticeBelow: { marginTop: 0, marginBottom: 16 },
  noticeWarn: { color: colors.textDim },
  usageNotice: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textDim, marginBottom: 14 },
  restore: { marginTop: 6, alignSelf: 'center' },
  legal: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textFaint, marginTop: 8 },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 10 },
  link: { fontFamily: fonts.semibold, fontSize: 12, color: colors.accentText, textDecorationLine: 'underline' },
  linkSep: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
});

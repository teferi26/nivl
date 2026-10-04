// NIVL · NIVL Pro: el estado de la IA de la cuenta y la capa de compra.
//
// El candado vive en el servidor (migración 0020): aquí solo se PREGUNTA. Que
// el cliente crea que alguien es Pro no le da IA a nadie; `ai_begin_turn` lo
// vuelve a comprobar en cada turno.
//
// La compra va por RevenueCat (`react-native-purchases`, desde el binario
// 1.0.7): en iOS y Android una suscripción digital tiene que ser compra
// integrada (Guideline 3.1.1 de Apple, política de pagos de Google Play). La
// tienda solo cobra; el DERECHO a IA lo escribe el webhook de RevenueCat en
// `subscriptions` (supabase/functions/revenuecat-webhook → apply_store_event,
// 0027), así que tras comprar se vuelve a preguntar al servidor.
//
// `purchasesAvailable()` es false (y la oferta se pinta de solo lectura) si
// falta la clave pública de la plataforma (EXPO_PUBLIC_RC_IOS_KEY /
// EXPO_PUBLIC_RC_ANDROID_KEY, variables de EAS) o el módulo nativo (Expo Go,
// web). `subscription.ts` (Stripe, EXPO_PUBLIC_PAYWALL) se queda como está
// para el Oráculo y para la web.

import type AsyncStorageTipo from '@react-native-async-storage/async-storage';
import { Linking, NativeModules, Platform } from 'react-native';
// `./tienda` es RevenueCat en iOS/Android (tienda.native.ts) y un stub en web
// (tienda.ts): el SDK no entra en el bundle web.
import {
  PURCHASES_ERROR_CODE,
  Purchases,
  type CustomerInfo,
  type PurchasesError,
  type PurchasesPackage,
  type StoreProductChangeInfo,
} from './tienda';
import {
  compraReflejada,
  esProductoNivl,
  puedeMejorarEnTienda,
  modoReemplazoGoogle,
  planExacto,
  precioVisible,
  productoBase,
  proPlan,
  textoIntro,
  tipoCambio,
  type AiStatus,
  type PlanKey,
  type PreciosTienda,
  type ProPlanId,
  type Tier,
} from './proplans';
import {
  anotarEn,
  decidirOferta,
  parsearHistorial,
  type DecisionOferta,
  type EntradaOferta,
  type FormaOferta,
  type Momento,
  type RespuestaOferta,
} from './paywallmoment';
import { supabase } from './supabase';
import { ErrorVisible } from './validation';

export * from './proplans';
export * from './paywallmoment';

const TIERS_CONOCIDOS: readonly Tier[] = ['free', 'pro', 'elite', 'owner'];

/**
 * Estado de la IA de la cuenta con sesión iniciada. Cada campo nuevo (0024)
 * lleva su valor por defecto: con el servidor aún en la 0020 la pantalla se
 * pinta igual, sin modo profundo ni prueba.
 */
export async function fetchAiStatus(): Promise<AiStatus> {
  const { data, error } = await supabase.rpc('ai_status');
  if (error) throw error;
  const s = (data ?? {}) as Record<string, unknown>;
  const entitled = !!s.entitled;
  const tier = TIERS_CONOCIDOS.find((t) => t === s.tier) ?? (entitled ? 'pro' : 'free');
  return {
    entitled,
    plan: typeof s.plan === 'string' ? (s.plan as PlanKey) : null,
    tier,
    budget: Number(s.budget ?? 0),
    spent: Number(s.spent ?? 0),
    remaining: Number(s.remaining ?? 0),
    renews: typeof s.renews === 'string' ? s.renews : undefined,
    trial: s.trial === true,
    deepAllowed: s.deep_allowed === true,
    deepRemaining: Number(s.deep_remaining ?? 0),
    deepTurns: Number(s.deep_turns ?? 0),
    trialAvailable: s.trial_available === true,
    vision: typeof s.vision === 'boolean' ? s.vision : null,
  };
}

/**
 * Empieza la prueba de 7 días del coach (RPC `start_trial`, 0024). Una por
 * cuenta: si ya la tuvo, o tuvo cualquier suscripción, `ya_usada`. Después
 * hay que volver a leer `fetchAiStatus()`.
 */
export async function startTrial(): Promise<{ ok: boolean; reason?: 'ya_usada'; ends?: string }> {
  const { data, error } = await supabase.rpc('start_trial');
  if (error) throw error;
  const r = (data ?? {}) as { ok?: boolean; reason?: string; ends?: string };
  if (r.ok) return { ok: true, ends: r.ends };
  // Solo "ya_usada" es "ya usada". Otro motivo (p. ej. el trigger de
  // consentimiento de salud de la 0030) sale como fallo genérico, no como
  // una prueba gastada que el usuario nunca tuvo.
  if (!r.reason || r.reason === 'ya_usada') return { ok: false, reason: 'ya_usada' };
  throw new Error(`start_trial: ${r.reason}`);
}

/** Se lanza al intentar comprar o restaurar cuando esta build no tiene tienda. */
export class PurchasesUnavailableError extends ErrorVisible {
  constructor() {
    super('Las suscripciones no están disponibles en esta versión de la app.');
    this.name = 'PurchasesUnavailableError';
  }
}

// ── La tienda ──────────────────────────────────────────────────────

/**
 * La clave pública de RevenueCat de esta plataforma. Se lee con
 * `process.env.EXPO_PUBLIC_…` literal: Expo solo sustituye ese acceso exacto
 * al empaquetar. No es secreta, pero vive en EAS para rotarla sin commit.
 */
function claveTienda(): string | null {
  const k =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_RC_IOS_KEY
      : Platform.OS === 'android'
        ? process.env.EXPO_PUBLIC_RC_ANDROID_KEY
        : undefined;
  return k?.trim() || null;
}

/**
 * ¿Se puede comprar desde esta build? Hace falta la clave de la plataforma y
 * el módulo nativo `RNPurchases`: en Expo Go la librería se sustituye sola por
 * una simulación, y ahí NO se ofrece una compra que no cobra.
 */
export function purchasesAvailable(): boolean {
  return !!claveTienda() && !!NativeModules.RNPurchases;
}

// La identidad en RevenueCat es el uuid de Supabase: con él escribe el
// webhook. Se configura con `appUserID` directamente (así nunca pasa por un id
// anónimo) y un cambio de cuenta es `logIn` / `logOut`. Todo en cola: dos
// cambios de sesión seguidos no se pisan.
let configurada = false;
let usuarioTienda: string | null = null;
let cola: Promise<void> = Promise.resolve();

async function aplicarUsuario(userId: string | null): Promise<void> {
  if (!purchasesAvailable()) return;
  if (userId) {
    if (!configurada) {
      Purchases.configure({ apiKey: claveTienda()!, appUserID: userId });
      configurada = true;
      usuarioTienda = userId;
      return;
    }
    if (usuarioTienda === userId) return;
    await Purchases.logIn(userId);
    usuarioTienda = userId;
    return;
  }
  if (!configurada || !usuarioTienda) return;
  usuarioTienda = null;
  try {
    await Purchases.logOut();
  } catch {
    /* ya era anónimo: nada que cerrar */
  }
}

/**
 * Ata la tienda a la cuenta con sesión, o la suelta al cerrar sesión. La llama
 * `_layout.tsx` cada vez que cambia el usuario. Nunca lanza: un fallo aquí no
 * puede tumbar la entrada, y `purchase` lo vuelve a intentar.
 */
export function identificarEnTienda(userId: string | null): Promise<void> {
  cola = cola.then(() => aplicarUsuario(userId)).catch(() => {});
  return cola;
}

/**
 * Antes de cobrar o restaurar: la tienda TIENE que estar a nombre de la cuenta
 * con sesión. El cambio va por la MISMA cola que `identificarEnTienda` (un
 * cambio de sesión a medias no puede colarse entre medias) y después se
 * pregunta al SDK quién es: si `logIn` falló, la compra quedaría a nombre de
 * la cuenta anterior, así que no se cobra.
 */
async function asegurarUsuario(): Promise<string> {
  if (!purchasesAvailable()) throw new PurchasesUnavailableError();
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) throw new ErrorVisible('Inicia sesión para suscribirte.');
  const paso = cola.then(() => aplicarUsuario(uid));
  cola = paso.catch(() => {});
  await paso;
  let actual: string | null = null;
  try {
    actual = await Purchases.getAppUserID();
  } catch {
    actual = null;
  }
  if (actual !== uid) {
    throw new ErrorVisible('La tienda aún no está vinculada a esta cuenta. Cierra y vuelve a abrir NIVL e inténtalo de nuevo.');
  }
  return uid;
}

/**
 * Ejecuta `fn` dentro de la misma cola que los cambios de cuenta: un
 * `identificarEnTienda` que llegue mientras tanto espera a que termine. Así
 * nadie cambia el appUserID entre la última comprobación y el cobro.
 */
function enColaDeTienda<T>(fn: () => Promise<T>): Promise<T> {
  const paso = cola.then(fn);
  cola = paso.then(() => {}, () => {});
  return paso;
}

/**
 * Atribución para los gráficos de RevenueCat tras un "¿Quién te trajo?"
 * aceptado. La verdad está en `referrals` (0025): esto es informativo y nunca
 * lanza.
 */
export async function marcarCreadorEnTienda(code: string): Promise<void> {
  if (!purchasesAvailable() || !configurada) return;
  try {
    await Purchases.setAttributes({ creator_code: code });
  } catch {
    /* informativo */
  }
}

function esErrorDeTienda(e: unknown): e is PurchasesError {
  return !!e && typeof e === 'object' && 'code' in e;
}

function cancelada(e: unknown): boolean {
  return esErrorDeTienda(e) && (e.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR || e.userCancelled === true);
}

/** Lo que la tienda dice, en la voz del sistema. El resto acaba en `mensajeSistema`. */
function traducir(e: unknown): unknown {
  if (!esErrorDeTienda(e)) return e;
  switch (e.code) {
    case PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR:
      // Ask to Buy (iOS) o pago diferido (Google Play): no hay cobro todavía.
      return new ErrorVisible(
        'El pago está pendiente de aprobación en la tienda. Hoy no se ha cobrado nada: el coach se activará cuando la tienda lo confirme. Si tarda, pulsa Restaurar compras.',
      );
    case PURCHASES_ERROR_CODE.RECEIPT_ALREADY_IN_USE_ERROR:
    case PURCHASES_ERROR_CODE.RECEIPT_IN_USE_BY_OTHER_SUBSCRIBER_ERROR:
      return new ErrorVisible('Esta compra de la tienda pertenece a otra cuenta de NIVL. Entra con esa cuenta para usarla.');
    case PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR:
      return new ErrorVisible('Tu cuenta de la tienda ya tiene esta suscripción. Pulsa Restaurar compras para recuperarla.');
    case PURCHASES_ERROR_CODE.OPERATION_ALREADY_IN_PROGRESS_ERROR:
      return new ErrorVisible('Ya hay una operación con la tienda en curso. Espera a que termine.');
    case PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR:
      return new ErrorVisible('La tienda no responde ahora mismo. No se ha completado ningún cobro nuevo: inténtalo en unos minutos.');
    case PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR:
      return new ErrorVisible('Este dispositivo no permite compras. Revisa las restricciones de la tienda.');
    case PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR:
      return new ErrorVisible('Ese plan no está disponible ahora mismo en la tienda.');
    case PURCHASES_ERROR_CODE.NETWORK_ERROR:
    case PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR:
      // `mensajeSistema` lo reconoce como falta de red.
      return new Error('network');
    default:
      return e;
  }
}

async function todosLosPaquetes(): Promise<PurchasesPackage[]> {
  const offerings = await Purchases.getOfferings();
  // La offering actual primero: si un producto está en dos, manda la actual.
  const todas = [offerings.current, ...Object.values(offerings.all)];
  return todas.flatMap((o) => o?.availablePackages ?? []);
}

/**
 * Los precios que da la tienda (en la moneda y el formato del comprador), por
 * id de producto. Son los que se enseñan con la tienda abierta: el que se
 * cobra es el de la tienda, no el de la tabla.
 */
export async function preciosDeTienda(): Promise<PreciosTienda> {
  await asegurarUsuario();
  const out: PreciosTienda = {};
  for (const p of await todosLosPaquetes()) {
    const id = productoBase(p.product.identifier);
    const precio = precioVisible(p.product.priceString);
    if (esProductoNivl(id) && !out[id] && precio) out[id] = precio;
  }
  return out;
}

/**
 * La oferta introductoria que declara la tienda para cada producto, ya en
 * frase (`textoIntro`). Hoy ningún producto de App Store Connect la tiene
 * (la prueba de 7 días es del servidor): esto existe para que, si un día se
 * configura una en una tienda, el paywall la declare en vez de callarla. En
 * iOS se pregunta la elegibilidad: inelegible → no se dice; desconocida → se
 * dice como condicional. En Google Play la opción por defecto ya solo trae
 * la oferta si la cuenta es elegible.
 */
export async function introsDeTienda(): Promise<Partial<Record<ProPlanId, string>>> {
  await asegurarUsuario();
  const out: Partial<Record<ProPlanId, string>> = {};
  const conIntro = (await todosLosPaquetes()).filter((p) => esProductoNivl(p.product.identifier) && p.product.introPrice);
  if (!conIntro.length) return out;
  let elegibilidad: Record<string, { status: number }> = {};
  if (Platform.OS === 'ios') {
    try {
      elegibilidad = await Purchases.checkTrialOrIntroductoryPriceEligibility(conIntro.map((p) => p.product.identifier));
    } catch {
      elegibilidad = {};
    }
  }
  for (const p of conIntro) {
    const id = productoBase(p.product.identifier) as ProPlanId;
    if (out[id]) continue;
    const st = elegibilidad[p.product.identifier]?.status;
    // 1 = INELIGIBLE, 3 = NO_INTRO_OFFER_EXISTS (INTRO_ELIGIBILITY_STATUS).
    if (Platform.OS === 'ios' && (st === 1 || st === 3)) continue;
    const t = textoIntro(p.product.introPrice, Platform.OS === 'ios' && st !== 2);
    if (t) out[id] = t;
  }
  return out;
}

async function paqueteDe(planId: ProPlanId): Promise<PurchasesPackage | null> {
  return (await todosLosPaquetes()).find((p) =>
    productoBase(p.product.identifier) === planId && precioVisible(p.product.priceString) !== null,
  ) ?? null;
}

/** Plazas de Élite fundador que quedan (0027), o null si no se sabe. */
export async function fetchFounderSeatsLeft(): Promise<number | null> {
  const { data, error } = await supabase.rpc('founder_seats_left');
  if (error || typeof data !== 'number') return null;
  return data;
}

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Verifica en servidor el derecho actual, incluso con la cuenta original
 * borrada. Nunca se envía un plan ni un recibo decidido por el cliente. */
async function reconciliarCompra(): Promise<void> {
  try {
    await supabase.functions.invoke('store-reconcile', { body: {}, timeout: 15000 });
  } catch {
    // El webhook aún puede completar la verificación. Restaurar permite reintentar.
  }
}

/**
 * Espera a que el webhook escriba la compra: reintentos cortos, unos 12 s en
 * total. True si el servidor ya la refleja.
 */
async function esperarDerecho(reflejada: (st: AiStatus) => boolean): Promise<boolean> {
  for (let i = 0; i < 6; i++) {
    if (i > 0) await pausa(2000);
    try {
      const st = await fetchAiStatus();
      if (reflejada(st)) return true;
    } catch {
      /* sin red un momento: se reintenta */
    }
  }
  return false;
}

/**
 * - `activa`: la tienda cobró y el servidor ya da el coach (o el plan nuevo).
 * - `pendiente`: la tienda cobró y el servidor aún no lo refleja; se activa en
 *   segundos (la pantalla lo dice, vuelve a leer el estado y Restaurar
 *   compras lo reintenta).
 * - `programada`: cambio de plan que la tienda aplica al renovar (Élite → Pro,
 *   o anual ↔ mensual). Hasta entonces sigue el plan actual.
 * - `cancelada`: el usuario cerró la hoja de pago. No es un error.
 */
export type ResultadoCompra = 'activa' | 'pendiente' | 'programada' | 'cancelada';

/** El importe cambió entre la oferta y el cobro: hay que volver a mostrarlo. */
export class StorePriceChangedError extends ErrorVisible {
  constructor() {
    super('El precio de la tienda ha cambiado. Revisa el importe actualizado antes de comprar.');
    this.name = 'StorePriceChangedError';
  }
}

/** La tienda de ESTE dispositivo, con el nombre que usa RevenueCat. */
function tiendaDelDispositivo(): string {
  return Platform.OS === 'ios' ? 'APP_STORE' : 'PLAY_STORE';
}

// Sin nombrar la tienda de la otra plataforma (Apple 2.3.10).
// Tampoco se remite a pagar fuera de la tienda (3.1.1): solo se dice dónde vive.
const NOMBRE_TIENDA: Record<string, string> = {
  STRIPE: 'fuera de esta app',
  RC_BILLING: 'fuera de esta app',
};

export interface SuscripcionTienda {
  /** El producto de NIVL activo, sin la parte de base plan de Google Play. */
  producto: ProPlanId;
  /** "PLAY_STORE"/"APP_STORE"/…; null si el SDK no lo dice (se asume este dispositivo). */
  store: string | null;
  /** El id tal cual lo da la tienda (en Google Play, "producto:baseplan"). */
  idTienda: string;
  managementURL: string | null;
  /** false si está cancelada pero sigue vigente hasta fin de periodo; null si el SDK no lo dice. */
  renueva: boolean | null;
}

/**
 * Las suscripciones de NIVL vivas en RevenueCat para la cuenta atada. Se mira
 * `subscriptionsByProductIdentifier`, `activeSubscriptions` y los
 * entitlements activos: cualquiera de los tres basta (en Google Play los ids
 * llegan como "producto:baseplan").
 */
function suscripcionesNivl(info: CustomerInfo | null | undefined): SuscripcionTienda[] {
  if (!info) return [];
  const out = new Map<ProPlanId, SuscripcionTienda>();
  const poner = (idTienda: string | null | undefined, store: string | null, url: string | null, renueva: boolean | null = null) => {
    if (!idTienda || !esProductoNivl(idTienda)) return;
    const producto = productoBase(idTienda) as ProPlanId;
    const previo = out.get(producto);
    if (previo && (previo.store || !store)) return;
    out.set(producto, { producto, store, idTienda, managementURL: url ?? info.managementURL ?? null, renueva });
  };
  for (const [id, sub] of Object.entries(info.subscriptionsByProductIdentifier ?? {})) {
    if (sub?.isActive) {
      poner(sub.productIdentifier || id, sub.store ?? null, sub.managementURL ?? null, typeof sub.willRenew === 'boolean' ? sub.willRenew : null);
    }
  }
  for (const id of info.activeSubscriptions ?? []) poner(id, null, null);
  for (const e of Object.values(info.entitlements?.active ?? {})) {
    if (e?.isActive !== false) poner(e?.productIdentifier, e?.store ?? null, null);
  }
  // Élite antes que Pro: si hubiera dos, la de más nivel es la que manda.
  const rango = (s: SuscripcionTienda) => (proPlan(s.producto).tier === 'elite' ? 1 : 0);
  return [...out.values()].sort((a, b) => rango(b) - rango(a));
}

/** Compra solo al precio mostrado y espera a que el servidor refleje el derecho. */
export async function purchase(planId: ProPlanId, precioMostrado: string): Promise<ResultadoCompra> {
  if (!precioVisible(precioMostrado)) throw new ErrorVisible('Espera a que se cargue el precio de la tienda.');
  const uid = await asegurarUsuario();
  let paquete: PurchasesPackage | null;
  try {
    paquete = await paqueteDe(planId);
  } catch (e) {
    throw traducir(e);
  }
  if (!paquete) throw new ErrorVisible('Ese plan no está disponible ahora mismo en la tienda.');
  if (precioVisible(paquete.product.priceString) !== precioMostrado.trim()) throw new StorePriceChangedError();

  // Sin saber qué tiene ya, no se cobra: en Google Play comprar otro producto
  // sin `productChangeInfo` abre una SEGUNDA suscripción (doble cobro).
  let actual: SuscripcionTienda | null;
  try {
    actual = suscripcionesNivl(await Purchases.getCustomerInfo())[0] ?? null;
    // Android: una suscripción de Google Play viva que RevenueCat aún no asocia
    // a esta cuenta (p. ej. borró la cuenta NIVL y creó otra sin restaurar) no
    // aparece arriba, y comprar otro plan sin productChangeInfo abriría una
    // SEGUNDA suscripción. Se sincroniza antes de decidir.
    if (!actual && Platform.OS === 'android') {
      actual = suscripcionesNivl(await Purchases.restorePurchases())[0] ?? null;
    }
  } catch (e) {
    throw traducir(e);
  }
  const tipo = tipoCambio(actual?.producto, planId);
  if (tipo === 'mismo') {
    if (actual?.renueva === false) {
      throw new ErrorVisible('Tu suscripción a este plan está cancelada pero sigue vigente. Reactívala desde Gestionar o cancelar suscripción.');
    }
    // Puede que acabe de recuperarse (sincronización de arriba): que el servidor la refleje.
    await reconciliarCompra();
    if (await esperarDerecho((st) => planExacto(st, planId))) return 'activa';
    throw new ErrorVisible('Ya tienes este plan activo en la tienda. Si no lo ves en NIVL, pulsa Restaurar compras.');
  }
  if (actual?.store && actual.store !== tiendaDelDispositivo()) {
    // Otra tienda (o la web): cambiar aquí sería pagar dos suscripciones.
    const donde = NOMBRE_TIENDA[actual.store] ?? 'en otra tienda (la de tu otro dispositivo)';
    throw new ErrorVisible(`Tu suscripción de NIVL se paga ${donde}. Cámbiala o cancélala allí: comprar aquí sería un segundo cobro.`);
  }

  let cambio: StoreProductChangeInfo | null = null;
  if (actual && Platform.OS === 'android') {
    cambio = {
      oldProductIdentifier: productoBase(actual.idTienda),
      replacementMode: modoReemplazoGoogle(tipo) as StoreProductChangeInfo['replacementMode'],
    };
  }
  const compra = cambio;
  const cobrada = await enColaDeTienda(async () => {
    // Última comprobación, ya sin cambios de cuenta posibles hasta cobrar.
    let actualId: string | null = null;
    try {
      actualId = await Purchases.getAppUserID();
    } catch {
      actualId = null;
    }
    if (actualId !== uid) throw new ErrorVisible('La cuenta ha cambiado. Vuelve a intentarlo.');
    try {
      if (compra) await Purchases.purchasePackage(paquete, null, compra);
      else await Purchases.purchasePackage(paquete);
      return true;
    } catch (e) {
      if (cancelada(e)) return false;
      throw traducir(e);
    }
  });
  if (!cobrada) return 'cancelada';
  await reconciliarCompra();
  if (tipo === 'nueva') return (await esperarDerecho((st) => compraReflejada(st, planId))) ? 'activa' : 'pendiente';
  // Cambio dentro del grupo: solo cuenta el plan EXACTO; el anterior ya daba derecho.
  if (await esperarDerecho((st) => planExacto(st, planId))) return 'activa';
  return tipo === 'subida' ? 'pendiente' : 'programada';
}

/**
 * - `activa` / `pendiente`: como en `purchase`.
 * - `nada`: esa cuenta de tienda no tiene ninguna suscripción de NIVL viva.
 */
export type ResultadoRestaurar = 'activa' | 'pendiente' | 'nada';

/**
 * Recupera una compra hecha con la misma cuenta de tienda (obligatorio en
 * iOS), también tras borrar la cuenta de NIVL y crear otra: RevenueCat la
 * transfiere al uuid nuevo y `store-reconcile` (cuerpo vacío: el servidor
 * solo mira la sesión) la aplica sin esperar al webhook.
 */
export async function restorePurchases(): Promise<ResultadoRestaurar> {
  await asegurarUsuario();
  let activas: SuscripcionTienda[];
  try {
    activas = suscripcionesNivl(await Purchases.restorePurchases());
  } catch (e) {
    throw traducir(e);
  }
  if (!activas.length) return 'nada';
  await reconciliarCompra();
  return (await esperarDerecho((st) => st.entitled && !st.trial)) ? 'activa' : 'pendiente';
}

const GESTION_TIENDA = {
  ios: 'https://apps.apple.com/account/subscriptions',
  android: 'https://play.google.com/store/account/subscriptions',
} as const;

/**
 * Abre la gestión de la suscripción (cambiar, cancelar, ver la renovación).
 * En iOS, la hoja nativa de la App Store si la suscripción es de allí; si no,
 * la `managementURL` que da RevenueCat o la página de la tienda. No toca el
 * derecho: lo que pase en la tienda llega al servidor por el webhook.
 */
export async function gestionarSuscripcion(): Promise<void> {
  let sub: SuscripcionTienda | null = null;
  let url: string | null = null;
  if (purchasesAvailable()) {
    try {
      await asegurarUsuario();
      const info = await Purchases.getCustomerInfo();
      sub = suscripcionesNivl(info)[0] ?? null;
      url = sub?.managementURL ?? info.managementURL ?? null;
    } catch {
      /* sin red: se abre la página de la tienda */
    }
    if (Platform.OS === 'ios' && (!sub?.store || sub.store === 'APP_STORE')) {
      try {
        await Purchases.showManageSubscriptions();
        return;
      } catch {
        /* sin hoja nativa: la página */
      }
    }
  }
  const destino = url ?? (Platform.OS === 'ios' ? GESTION_TIENDA.ios : Platform.OS === 'android' ? GESTION_TIENDA.android : null);
  if (!destino) throw new ErrorVisible('Gestiona tu suscripción desde la tienda donde la contrataste.');
  await Linking.openURL(destino);
}

// ── El momento de la oferta (fase 2, D1) ───────────────────────────
// El historial de ofertas enseñadas vive en el dispositivo (AsyncStorage): no
// es un dato de negocio, solo sirve para no insistir. Si se pierde (otro
// móvil, reinstalar), lo peor que pasa es UNA hoja más, con sus topes.

export const CLAVE_OFERTAS = 'nivl.ofertas.v1';

// Carga perezosa (require en la llamada): un import estático arrastraría el
// módulo nativo a todos los tests que importan `pro.ts` (también de rebote)
// sin mock, y `import()` no lo transforma Jest. Dentro del try de quien llama:
// si el módulo no está, el historial queda vacío.
type Almacen = Pick<typeof AsyncStorageTipo, 'getItem' | 'setItem'>;
function almacen(): Almacen {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require('@react-native-async-storage/async-storage') as { default?: Almacen } & Almacen;
  return m.default ?? m;
}

/** Lo enseñado en los últimos 30 días. Nunca lanza: sin almacenamiento o con JSON roto, vacío. */
export async function leerHistorialOfertas(ahora = Date.now()): Promise<EntradaOferta[]> {
  try {
    return parsearHistorial(await almacen().getItem(CLAVE_OFERTAS), ahora);
  } catch {
    return [];
  }
}

/**
 * Apunta que se enseñó una oferta (`vista`) o cómo respondió el usuario
 * (`cerrada`, `compra`, `prueba`). Una respuesta a una hoja recién vista la
 * sustituye (una sola hoja). Recorta a 30 días. Nunca lanza.
 */
export async function anotarOferta(
  momento: Momento,
  respuesta: RespuestaOferta,
  forma?: FormaOferta,
  ahora = Date.now(),
): Promise<void> {
  try {
    const previo = await leerHistorialOfertas(ahora);
    const nuevo = anotarEn(previo, { momento, respuesta, forma }, ahora);
    await almacen().setItem(CLAVE_OFERTAS, JSON.stringify(nuevo));
  } catch {
    /* sin almacenamiento: se pierde el apunte, nunca la pantalla */
  }
}

export interface OpcionesOferta {
  /** Hay una celebración en pantalla. Con true, nunca se ofrece nada. */
  celebrando: boolean;
  /** `subscriptions.provider` si se sabe: a quien paga por Stripe no se le ofrece una segunda suscripción. */
  provider?: string | null;
  /** Por defecto, una hoja que se decide enseñar se apunta ya como `vista`. */
  anotar?: boolean;
  /**
   * Para `fin_prueba`: la cuenta tuvo la prueba o una cortesía y ya acabó
   * (p. ej. `subscriptions.plan = 'cortesia'` con el periodo vencido). Sin
   * él, se deduce del historial del dispositivo.
   */
  pruebaTerminada?: boolean;
  ahora?: number;
}

/**
 * Lee el historial y decide (`decidirOferta`). Si la decisión es una hoja, la
 * apunta como `vista` en el acto: quien llama se compromete a enseñarla, y si
 * al final no lo hace, el tope cuenta igual (lo prudente). Sin estado de la IA
 * (sin red), nada: no se ofrece a ciegas. Nunca lanza.
 */
export async function ofrecerSi(momento: Momento, status: AiStatus | null | undefined, opts: OpcionesOferta): Promise<DecisionOferta> {
  const ahora = opts.ahora ?? Date.now();
  const historial = await leerHistorialOfertas(ahora);
  const d = decidirOferta(momento, {
    tier: status?.tier ?? 'free',
    entitled: !!status?.entitled,
    trial: !!status?.trial,
    trialAvailable: !!status?.trialAvailable,
    tiendaAbierta: purchasesAvailable(),
    celebrando: opts.celebrando,
    ahora,
    historial,
    mejorable: status?.entitled && !status?.trial ? puedeMejorarEnTienda(status, opts.provider ?? null) : true,
    ...(opts.pruebaTerminada !== undefined ? { pruebaTerminada: opts.pruebaTerminada } : {}),
  });
  if (!status) return { ...d, mostrar: false, razon: 'sin_estado' };
  if (d.mostrar && d.forma === 'hoja' && opts.anotar !== false) await anotarOferta(momento, 'vista', 'hoja', ahora);
  // El primer día es línea pero una vez en la vida: se anota al enseñarla.
  else if (d.mostrar && momento === 'primer_dia' && opts.anotar !== false) await anotarOferta(momento, 'vista', 'linea', ahora);
  return d;
}

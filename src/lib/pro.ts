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
// `purchasesAvailable()` es false —y la oferta se pinta de solo lectura— si
// falta la clave pública de la plataforma (EXPO_PUBLIC_RC_IOS_KEY /
// EXPO_PUBLIC_RC_ANDROID_KEY, variables de EAS) o el módulo nativo (Expo Go,
// web). `subscription.ts` (Stripe, EXPO_PUBLIC_PAYWALL) se queda como está
// para el Oráculo y para la web.

import { NativeModules, Platform } from 'react-native';
import Purchases, { PURCHASES_ERROR_CODE, type PurchasesError, type PurchasesPackage } from 'react-native-purchases';
import {
  compraReflejada,
  esProductoNivl,
  precioVisible,
  productoBase,
  type AiStatus,
  type PlanKey,
  type PreciosTienda,
  type ProPlanId,
  type Tier,
} from './proplans';
import { supabase } from './supabase';
import { ErrorVisible } from './validation';

export * from './proplans';

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
  return { ok: false, reason: 'ya_usada' };
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

/** Antes de cobrar: la tienda TIENE que estar a nombre de la cuenta con sesión. */
async function asegurarUsuario(): Promise<void> {
  if (!purchasesAvailable()) throw new PurchasesUnavailableError();
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) throw new ErrorVisible('Inicia sesión para suscribirte.');
  await cola;
  await aplicarUsuario(uid);
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
      return new ErrorVisible('El pago está pendiente de aprobación en la tienda. El coach se activará cuando se confirme.');
    case PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR:
      return new ErrorVisible('Este dispositivo no permite compras. Revisa las restricciones de la tienda.');
    case PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR:
      return new ErrorVisible('Ese plan no está disponible ahora mismo en la tienda.');
    case PURCHASES_ERROR_CODE.NETWORK_ERROR:
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
async function esperarDerecho(planId: ProPlanId | null): Promise<boolean> {
  for (let i = 0; i < 6; i++) {
    if (i > 0) await pausa(2000);
    try {
      const st = await fetchAiStatus();
      if (planId ? compraReflejada(st, planId) : st.entitled && !st.trial) return true;
    } catch {
      /* sin red un momento: se reintenta */
    }
  }
  return false;
}

/**
 * - `activa`: la tienda cobró y el servidor ya da el coach.
 * - `pendiente`: la tienda cobró y el webhook aún no ha llegado; se activa en
 *   segundos (la pantalla lo dice y vuelve a leer el estado).
 * - `cancelada`: el usuario cerró la hoja de pago. No es un error.
 */
export type ResultadoCompra = 'activa' | 'pendiente' | 'cancelada';

/** El importe cambió entre la oferta y el cobro: hay que volver a mostrarlo. */
export class StorePriceChangedError extends ErrorVisible {
  constructor() {
    super('El precio de la tienda ha cambiado. Revisa el importe actualizado antes de comprar.');
    this.name = 'StorePriceChangedError';
  }
}

/** Compra solo al precio mostrado y espera a que el servidor refleje el derecho. */
export async function purchase(planId: ProPlanId, precioMostrado: string): Promise<ResultadoCompra> {
  if (!precioVisible(precioMostrado)) throw new ErrorVisible('Espera a que se cargue el precio de la tienda.');
  await asegurarUsuario();
  let paquete: PurchasesPackage | null;
  try {
    paquete = await paqueteDe(planId);
  } catch (e) {
    throw traducir(e);
  }
  if (!paquete) throw new ErrorVisible('Ese plan no está disponible ahora mismo en la tienda.');
  if (precioVisible(paquete.product.priceString) !== precioMostrado.trim()) throw new StorePriceChangedError();
  try {
    await Purchases.purchasePackage(paquete);
  } catch (e) {
    if (cancelada(e)) return 'cancelada';
    throw traducir(e);
  }
  await reconciliarCompra();
  return (await esperarDerecho(planId)) ? 'activa' : 'pendiente';
}

/**
 * - `activa` / `pendiente`: como en `purchase`.
 * - `nada`: esa cuenta de tienda no tiene ninguna suscripción de NIVL viva.
 */
export type ResultadoRestaurar = 'activa' | 'pendiente' | 'nada';

/** Recupera una compra hecha con la misma cuenta de tienda (obligatorio en iOS). */
export async function restorePurchases(): Promise<ResultadoRestaurar> {
  await asegurarUsuario();
  let activas: string[];
  try {
    const info = await Purchases.restorePurchases();
    activas = info.activeSubscriptions ?? [];
  } catch (e) {
    throw traducir(e);
  }
  if (!activas.some((id) => esProductoNivl(id))) return 'nada';
  await reconciliarCompra();
  return (await esperarDerecho(null)) ? 'activa' : 'pendiente';
}

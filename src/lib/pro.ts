// NIVL · NIVL Pro: el estado de la IA de la cuenta y la capa de compra.
//
// El candado vive en el servidor (migración 0020): aquí solo se PREGUNTA. Que
// el cliente crea que alguien es Pro no le da IA a nadie; `ai_begin_turn` lo
// vuelve a comprobar en cada turno.
//
// La compra es una ABSTRACCIÓN a propósito. En iOS y Android las suscripciones
// tienen que ser compras integradas (Guideline 3.1.1 de Apple, política de
// pagos de Google Play), y ni los productos de tienda ni la cuenta de
// RevenueCat existen todavía. Hasta entonces `purchasesAvailable()` devuelve
// false, la pantalla de Pro se pinta completa y el botón apunta el interés en
// vez de cobrar. El código nuevo usa este módulo; `subscription.ts` (Stripe,
// EXPO_PUBLIC_PAYWALL) se queda como está para el Oráculo y para la web.

import { supabase } from './supabase';
import type { AiStatus, ProPlanId } from './proplans';

export * from './proplans';

/** Estado de la IA de la cuenta con sesión iniciada. */
export async function fetchAiStatus(): Promise<AiStatus> {
  const { data, error } = await supabase.rpc('ai_status');
  if (error) throw error;
  const s = (data ?? {}) as Partial<AiStatus>;
  return {
    entitled: !!s.entitled,
    plan: s.plan ?? null,
    budget: Number(s.budget ?? 0),
    spent: Number(s.spent ?? 0),
    remaining: Number(s.remaining ?? 0),
    renews: s.renews,
  };
}

/** Se lanza al intentar comprar o restaurar cuando la tienda aún no está conectada. */
export class PurchasesUnavailableError extends Error {
  constructor() {
    super('Las suscripciones se activan con el lanzamiento público.');
    this.name = 'PurchasesUnavailableError';
  }
}

/**
 * ¿Se puede comprar desde esta build?
 *
 * TODO(RevenueCat): cuando existan los productos `nivl_pro_mensual` y
 * `nivl_pro_anual` en App Store Connect y Play Console y el proyecto de
 * RevenueCat, añadir `react-native-purchases` (dependencia nativa: pide build
 * nueva de EAS, no sale por OTA), configurarlo al iniciar sesión con
 * `Purchases.configure({ apiKey, appUserID: userId })` —el appUserID tiene que
 * ser el id de Supabase, que es con lo que el webhook escribe en
 * `subscriptions`— y devolver aquí true si hay clave para la plataforma.
 */
export function purchasesAvailable(): boolean {
  return false;
}

/**
 * Compra un plan. Resuelve cuando la tienda confirma; el derecho a IA lo
 * activa el webhook de RevenueCat en `subscriptions`, así que tras comprar hay
 * que volver a leer `fetchAiStatus()`.
 */
export async function purchase(planId: ProPlanId): Promise<void> {
  if (!purchasesAvailable()) throw new PurchasesUnavailableError();
  // TODO(RevenueCat): buscar el paquete cuyo product.identifier === planId en
  // `Purchases.getOfferings()` y llamar a `Purchases.purchasePackage(paquete)`.
  // Una cancelación del usuario (`userCancelled`) no es un error: volver sin más.
  throw new Error(`Compra de ${planId} sin implementar.`);
}

/** Recupera una compra hecha con la misma cuenta de tienda (obligatorio en iOS). */
export async function restorePurchases(): Promise<void> {
  if (!purchasesAvailable()) throw new PurchasesUnavailableError();
  // TODO(RevenueCat): `Purchases.restorePurchases()` y releer `fetchAiStatus()`.
  throw new Error('Restauración sin implementar.');
}

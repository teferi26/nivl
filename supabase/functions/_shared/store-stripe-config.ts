// NIVL · Stripe web: catálogo, variables de entorno y CORS (puro, sin red).
//
// Los planes son los de docs/PRECIOS.md y el catálogo store_products (0025):
// el id del producto es el mismo en App Store, Google Play y Stripe, así que
// record_sale funciona igual para las tres tiendas. Los price id de Stripe NO
// están en el repo: cada uno vive en STRIPE_PRICE_<PRODUCTO> (test y live
// tienen ids distintos; se fijan por proyecto con `supabase secrets set`).

export type EnvGetter = (name: string) => string | undefined;

/** product_id (store_products) → plan de subscriptions. Espejo de 0025. */
export const STRIPE_PRODUCTS = {
  nivl_pro_mensual: 'pro_mensual',
  nivl_pro_anual: 'pro_anual',
  nivl_elite_mensual: 'elite_mensual',
  nivl_elite_anual: 'elite_anual',
  nivl_elite_fundador: 'elite_fundador',
} as const;
export type StripeProduct = keyof typeof STRIPE_PRODUCTS;
export type StripePlan = (typeof STRIPE_PRODUCTS)[StripeProduct];

/** Plan heredado de las suscripciones Stripe anteriores a 2026-10 (Pro). */
export const LEGACY_PLAN = 'mensual';

export function isStripeProduct(value: unknown): value is StripeProduct {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(STRIPE_PRODUCTS, value);
}

export const priceEnvName = (product: StripeProduct) => `STRIPE_PRICE_${product.toUpperCase()}`;

/** Price id configurado para un producto, o '' si falta o no tiene forma de price id. */
export function priceFor(env: EnvGetter, product: StripeProduct): string {
  const value = (env(priceEnvName(product)) ?? '').trim();
  return /^price_[A-Za-z0-9]{6,}$/.test(value) ? value : '';
}

/** price id → producto (inverso de priceFor). null si el price no es de ningún plan actual. */
export function productForPrice(env: EnvGetter, priceId: string | null | undefined): StripeProduct | null {
  if (!priceId) return null;
  for (const product of Object.keys(STRIPE_PRODUCTS) as StripeProduct[]) {
    if (priceFor(env, product) === priceId) return product;
  }
  return null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

/**
 * STRIPE_TEST_ACCESS: quién obtiene acceso REAL (en la base de producción) con
 * un pago de modo TEST (tarjeta 4242…). Por defecto NADIE: con la clave de test
 * desplegada y la web pública, cualquiera tendría Pro gratis.
 *   unset / 'none' → nadie · 'all' → todas las cuentas · 'uuid,uuid' → solo esas.
 * Cualquier otro valor falla en cerrado ('none').
 */
export function stripeTestPolicy(env: EnvGetter): (userId: string) => boolean {
  const raw = (env('STRIPE_TEST_ACCESS') ?? '').trim().toLowerCase();
  if (raw === 'all') return () => true;
  if (raw === '' || raw === 'none') return () => false;
  const ids = raw.split(',').map(v => v.trim()).filter(Boolean);
  if (!ids.length || ids.some(id => !UUID.test(id))) return () => false;
  const allowed = new Set(ids);
  return userId => allowed.has(userId.toLowerCase());
}

/** sk_live_/rk_live_ → live; sk_test_/rk_test_ → test; otra cosa → null (no configurado). */
export function stripeKeyMode(secretKey: string): 'live' | 'test' | null {
  if (/^(sk|rk)_live_\w+$/.test(secretKey)) return 'live';
  if (/^(sk|rk)_test_\w+$/.test(secretKey)) return 'test';
  return null;
}

/** NIVL_WEB_ORIGINS='https://nivl.app,https://www.nivl.app'. Solo https (o http://localhost para pruebas). */
export function allowedOrigins(env: EnvGetter): Set<string> {
  const out = new Set<string>();
  for (const raw of (env('NIVL_WEB_ORIGINS') ?? '').split(',')) {
    const value = raw.trim().replace(/\/+$/, '');
    if (/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(value) || /^http:\/\/localhost(:\d+)?$/i.test(value)) out.add(value.toLowerCase());
  }
  return out;
}

export function corsHeaders(origins: Set<string>, request: Request): Record<string, string> {
  const origin = (request.headers.get('origin') ?? '').toLowerCase();
  if (!origin || !origins.has(origin)) return { Vary: 'Origin' };
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/** Una URL de retorno válida: https (o localhost en pruebas), sin fragmento. '' si no vale. */
export function returnUrl(value: string | undefined): string {
  const raw = (value ?? '').trim();
  try {
    const url = new URL(raw);
    if (url.hash) return '';
    if (url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === 'localhost')) return raw;
  } catch { /* inválida */ }
  return '';
}

export const withQuery = (base: string, query: string) => base + (base.includes('?') ? '&' : '?') + query;

const LOCALES = new Set(['es', 'en', 'fr', 'de', 'it', 'pt', 'nl', 'ca', 'pl']);
/** Locale de Stripe Checkout a partir del de la web ('es-ES' → 'es'); 'auto' si no se reconoce. */
export function checkoutLocale(value: unknown): string {
  if (typeof value !== 'string') return 'auto';
  const base = value.trim().toLowerCase().split(/[-_]/)[0] ?? '';
  return LOCALES.has(base) ? base : 'auto';
}

export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

// NIVL · Stripe web: crear la sesión de Checkout y abrir el Customer Portal.
//
// La autoridad es el servidor (docs/payment-audit/STRIPE-WEB.md):
//  · el uid sale SOLO del JWT de Supabase (auth.getUser); el cuerpo elige el
//    plan y el idioma, nada más. Sustituye a los Payment Links con
//    ?client_reference_id=<uuid> en la URL (REVISION-SEGURIDAD P1-2);
//  · se rechaza (409) a quien ya tiene un derecho vigente de cualquier proveedor
//    (apple/google/stripe/manual/owner; la prueba 'cortesia'/'prueba_auto' no
//    bloquea), a quien tiene una suscripción Stripe viva que el webhook aún no ha
//    aplicado, a una cuenta con borrado pendiente y al fundador sin plazas.
//    Es la corrección de P1-3 en origen: sin checkout no hay pago doble;
//  · el price id sale del entorno (STRIPE_PRICE_<PRODUCTO>), nunca del cliente.
import {
  checkoutLocale, corsHeaders, isStripeProduct, json, priceFor, returnUrl, withQuery,
  type EnvGetter, type StripeProduct,
} from './store-stripe-config.ts';
import { entitled, isTrialRow, type SubscriptionRow } from './store-stripe.ts';

export type AuthUser = { id: string; email: string | null };

export interface CheckoutRepo {
  subscription(userId: string): Promise<SubscriptionRow | null>;
  erasurePending(userId: string): Promise<boolean>;
  founderSeatsLeft(): Promise<number>;
}
export interface CheckoutStripe {
  /** Suscripciones vivas (active, trialing, past_due, incomplete) de un cliente. */
  liveSubscriptions(customerId: string): Promise<number>;
  createCheckout(params: Record<string, unknown>): Promise<{ url: string | null }>;
  createPortal(customerId: string, returnUrl: string): Promise<{ url: string }>;
}
export interface CheckoutDeps {
  auth(token: string): Promise<AuthUser | null>;
  repo: CheckoutRepo;
  stripe: CheckoutStripe | null; // null = STRIPE_SECRET_KEY ausente o inválida
  mode: 'live' | 'test' | null;
  env: EnvGetter;
  origins: Set<string>;
  testAccess: (userId: string) => boolean;
  now?: () => number;
}

const MENSAJES = {
  no_autenticado: 'Inicia sesión para continuar.',
  plan_invalido: 'Ese plan no existe.',
  plan_no_disponible: 'Ese plan no está disponible ahora mismo.',
  no_configurado: 'El pago en la web no está disponible ahora mismo.',
  modo_prueba: 'El pago en la web está en pruebas y aún no está abierto.',
  borrado_pendiente: 'Tu cuenta tiene un borrado en curso.',
  ya_suscrito: 'Tu cuenta ya tiene una suscripción activa. Gestiónala desde donde la contrataste.',
  pago_pendiente: 'Tu suscripción tiene un pago pendiente. Actualiza el método de pago en Gestionar suscripción.',
  fundador_agotado: 'Las plazas de Élite fundador se han agotado.',
  sin_cliente: 'No hay ninguna suscripción web asociada a esta cuenta.',
  stripe: 'No se ha podido abrir el pago. Inténtalo de nuevo en unos minutos.',
  origen: 'Origen no permitido.',
} as const;
type Motivo = keyof typeof MENSAJES;

const fail = (status: number, reason: Motivo, cors: Record<string, string>, extra: Record<string, unknown> = {}) =>
  json(status, { error: reason, message: MENSAJES[reason], ...extra }, cors);

/** Preflight, método, origen, configuración y JWT: lo común a checkout y portal. */
async function gate(deps: CheckoutDeps, req: Request): Promise<{ response: Response } | { user: AuthUser; cors: Record<string, string> }> {
  const cors = corsHeaders(deps.origins, req);
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return { response: new Response(null, { status: origin && cors['Access-Control-Allow-Origin'] ? 204 : 403, headers: cors }) };
  if (req.method !== 'POST') return { response: json(405, { error: 'metodo' }, cors) };
  // Un navegador de otro origen no recibe nada (CORS); sin Origin (curl, tests) decide el JWT.
  if (origin && !cors['Access-Control-Allow-Origin']) return { response: fail(403, 'origen', cors) };
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.get('authorization') ?? '');
  if (!match) return { response: fail(401, 'no_autenticado', cors) };
  let user: AuthUser | null = null;
  try { user = await deps.auth(match[1]!); } catch { user = null; }
  if (!user || !/^[0-9a-f-]{36}$/i.test(user.id)) return { response: fail(401, 'no_autenticado', cors) };
  if (!deps.stripe || !deps.mode) {
    console.error('stripe: STRIPE_SECRET_KEY missing or invalid');
    return { response: fail(503, 'no_configurado', cors) };
  }
  if (deps.mode === 'test' && !deps.testAccess(user.id)) return { response: fail(403, 'modo_prueba', cors) };
  return { user: { ...user, id: user.id.toLowerCase() }, cors };
}

// Stripe no deja cambiar la etiqueta del botón en mode=subscription (submit_type es solo
// para payment/donate): «Pagar y suscribirme» va aquí, encima del botón.
export const TEXTO_DESISTIMIENTO =
  'Al pulsar «Pagar y suscribirme» pides que el servicio empiece ya. Si desistes en 14 días te devolvemos la parte '
  + 'no usada (art. 108.4 TRLGDCU), desde el botón «Desistir» de nivl.app. La suscripción se renueva sola hasta que la canceles.';

export function checkoutParams(input: {
  product: StripeProduct; price: string; user: AuthUser; customer: string | null; locale: unknown;
  successUrl: string; cancelUrl: string; termsUrl: string; automaticTax: boolean;
}): Record<string, unknown> {
  const metadata = { uid: input.user.id, plan: input.product };
  return {
    mode: 'subscription',
    line_items: [{ price: input.price, quantity: 1 }],
    client_reference_id: input.user.id,
    metadata,
    subscription_data: { metadata },
    success_url: withQuery(input.successUrl, 'session_id={CHECKOUT_SESSION_ID}'),
    cancel_url: input.cancelUrl,
    locale: checkoutLocale(input.locale),
    consent_collection: { terms_of_service: 'required' },
    custom_text: {
      terms_of_service_acceptance: { message: `Acepto los [Términos de NIVL](${input.termsUrl}).` },
      submit: { message: TEXTO_DESISTIMIENTO },
    },
    ...(input.customer
      ? { customer: input.customer, ...(input.automaticTax ? { customer_update: { address: 'auto', name: 'auto' } } : {}) }
      : input.user.email ? { customer_email: input.user.email } : {}),
    ...(input.automaticTax ? { automatic_tax: { enabled: true } } : {}),
  };
}

export const stripeCheckoutHandler = (deps: CheckoutDeps) => async (req: Request): Promise<Response> => {
  const gated = await gate(deps, req);
  if ('response' in gated) return gated.response;
  const { user, cors } = gated;
  let body: Record<string, unknown> = {};
  try { const parsed = await req.json(); if (parsed && typeof parsed === 'object') body = parsed as Record<string, unknown>; } catch { /* cuerpo vacío */ }
  // La web manda 'pro_mensual'…; se aceptan las dos formas ('nivl_pro_mensual' es el id del catálogo).
  const product = typeof body.plan === 'string' && !body.plan.startsWith('nivl_') ? `nivl_${body.plan}` : body.plan;
  if (!isStripeProduct(product)) return fail(400, 'plan_invalido', cors);
  const price = priceFor(deps.env, product);
  if (!price) return fail(503, 'plan_no_disponible', cors);
  const successUrl = returnUrl(deps.env('STRIPE_RETURN_URL'));
  const cancelUrl = returnUrl(deps.env('STRIPE_CANCEL_URL')) || successUrl;
  const termsUrl = returnUrl(deps.env('NIVL_TERMS_URL'));
  if (!successUrl || !termsUrl) return fail(503, 'no_configurado', cors);
  const now = (deps.now ?? Date.now)();
  try {
    if (await deps.repo.erasurePending(user.id)) return fail(409, 'borrado_pendiente', cors);
    const row = await deps.repo.subscription(user.id);
    if (row && (row.plan === 'owner' || (entitled(row, now) && !isTrialRow(row)))) {
      const pending = row.provider === 'stripe' && row.status === 'past_due';
      return fail(409, pending ? 'pago_pendiente' : 'ya_suscrito', cors, { provider: row.plan === 'owner' ? 'owner' : row.provider });
    }
    const customer = row?.stripe_customer_id ?? null;
    // Pagado pero aún sin webhook (o webhook caído): Stripe manda.
    if (customer && await deps.stripe!.liveSubscriptions(customer) > 0) return fail(409, 'ya_suscrito', cors, { provider: 'stripe' });
    if (product === 'nivl_elite_fundador' && await deps.repo.founderSeatsLeft() <= 0) return fail(409, 'fundador_agotado', cors);
    const session = await deps.stripe!.createCheckout(checkoutParams({
      product, price, user, customer, locale: body.locale, successUrl, cancelUrl, termsUrl,
      automaticTax: (deps.env('STRIPE_AUTOMATIC_TAX') ?? '').trim().toLowerCase() === 'true',
    }));
    if (!session.url) return fail(502, 'stripe', cors);
    return json(200, { url: session.url }, cors);
  } catch (error) {
    console.error('stripe-checkout error:', error instanceof Error ? error.message : 'unknown');
    return fail(502, 'stripe', cors);
  }
};

export const stripePortalHandler = (deps: CheckoutDeps) => async (req: Request): Promise<Response> => {
  const gated = await gate(deps, req);
  if ('response' in gated) return gated.response;
  const { user, cors } = gated;
  const back = returnUrl(deps.env('STRIPE_PORTAL_RETURN_URL')) || returnUrl(deps.env('STRIPE_RETURN_URL'));
  if (!back) return fail(503, 'no_configurado', cors);
  try {
    const row = await deps.repo.subscription(user.id);
    const customer = row?.stripe_customer_id ?? null;
    if (!customer) return fail(404, 'sin_cliente', cors);
    const portal = await deps.stripe!.createPortal(customer, back);
    return json(200, { url: portal.url }, cors);
  } catch (error) {
    console.error('stripe-portal error:', error instanceof Error ? error.message : 'unknown');
    return fail(502, 'stripe', cors);
  }
};

/** supabase-js (service role). Solo lectura: checkout y portal no escriben derechos. */
export function supabaseCheckoutRepo(admin: import('./db.ts').Db): CheckoutRepo {
  return {
    async subscription(userId) {
      const { data, error } = await admin.from('subscriptions')
        .select('user_id,status,plan,provider,current_period_end,stripe_subscription_id,stripe_customer_id')
        .eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return (data as SubscriptionRow | null) ?? null;
    },
    async erasurePending(userId) {
      // account_erasure_jobs: select concedido a service_role (0031).
      const { data, error } = await admin.from('account_erasure_jobs').select('user_id').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return data !== null;
    },
    async founderSeatsLeft() {
      const { data, error } = await admin.rpc('founder_seats_left');
      if (error) throw error;
      return typeof data === 'number' ? data : 0; // sin dato = agotado (falla en cerrado)
    },
  };
}

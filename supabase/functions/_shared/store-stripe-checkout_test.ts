// Stripe web: checkout y portal (docs/payment-audit/STRIPE-WEB.md). Sin red: dobles de Stripe y de la base.
import { stripeCheckoutHandler, stripePortalHandler, type CheckoutDeps } from './store-stripe-checkout.ts';
import { allowedOrigins, stripeTestPolicy } from './store-stripe-config.ts';
import type { SubscriptionRow } from './store-stripe.ts';

const UID = '00000000-0000-4000-8000-0000000000d1';
const OTHER = '00000000-0000-4000-8000-0000000000d2';
const equal = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
};
const BASE_ENV: Record<string, string> = {
  STRIPE_PRICE_NIVL_PRO_MENSUAL: 'price_ProMensual01',
  STRIPE_PRICE_NIVL_ELITE_FUNDADOR: 'price_EliteFund001',
  STRIPE_RETURN_URL: 'https://nivl.app/pro/gracias',
  NIVL_TERMS_URL: 'https://nivl.app/terminos',
  NIVL_WEB_ORIGINS: 'https://nivl.app,https://www.nivl.app',
};
const row = (o: Partial<SubscriptionRow>): SubscriptionRow => ({
  user_id: UID, status: 'active', plan: 'pro_anual', provider: 'apple',
  current_period_end: new Date(Date.now() + 86400_000).toISOString(), stripe_subscription_id: null, stripe_customer_id: null, ...o,
});

function fixture(o: { row?: SubscriptionRow | null; erasure?: boolean; seats?: number; live?: number; mode?: 'live' | 'test' | null;
  env?: Record<string, string>; user?: string } = {}) {
  const sessions: Record<string, unknown>[] = [];
  const portals: string[] = [];
  const values = { ...BASE_ENV, ...o.env };
  const env = (n: string) => values[n];
  const deps: CheckoutDeps = {
    auth: token => Promise.resolve(token === 'jwt-ok' ? { id: o.user ?? UID, email: 'a@b.es' } : null),
    repo: {
      subscription: () => Promise.resolve(o.row ?? null),
      erasurePending: () => Promise.resolve(o.erasure ?? false),
      founderSeatsLeft: () => Promise.resolve(o.seats ?? 10),
    },
    stripe: {
      liveSubscriptions: () => Promise.resolve(o.live ?? 0),
      createCheckout: params => { sessions.push(params); return Promise.resolve({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' }); },
      createPortal: customer => { portals.push(customer); return Promise.resolve({ url: 'https://billing.stripe.com/p/session/x' }); },
    },
    mode: o.mode === undefined ? 'live' : o.mode,
    env, origins: allowedOrigins(env), testAccess: stripeTestPolicy(env),
  };
  return { deps, sessions, portals };
}
const post = (body: unknown, headers: Record<string, string> = { authorization: 'Bearer jwt-ok', origin: 'https://nivl.app' }) =>
  new Request('https://x.supabase.co/functions/v1/stripe-checkout', { method: 'POST', headers, body: JSON.stringify(body) });

Deno.test('checkout: el uid sale SOLO del JWT; el cuerpo no puede elegir otra cuenta ni el precio', async () => {
  const f = fixture();
  const res = await stripeCheckoutHandler(f.deps)(post({ plan: 'nivl_pro_mensual', uid: OTHER, user_id: OTHER, price: 'price_hack', locale: 'es-ES' }));
  equal(res.status, 200);
  equal(await res.json(), { url: 'https://checkout.stripe.com/c/pay/cs_test_1' });
  equal(res.headers.get('access-control-allow-origin'), 'https://nivl.app');
  const s = f.sessions[0]!;
  equal([s.client_reference_id, s.metadata, s.subscription_data, s.line_items, s.mode, s.locale, s.customer_email],
    [UID, { uid: UID, plan: 'nivl_pro_mensual' }, { metadata: { uid: UID, plan: 'nivl_pro_mensual' } },
      [{ price: 'price_ProMensual01', quantity: 1 }], 'subscription', 'es', 'a@b.es']);
  equal(s.success_url, 'https://nivl.app/pro/gracias?session_id={CHECKOUT_SESSION_ID}');
  equal(s.consent_collection, { terms_of_service: 'required' });
  equal('automatic_tax' in s, false);
  equal(JSON.stringify(s.custom_text).includes('108.4 TRLGDCU'), true);
  // La web manda el plan sin prefijo: se normaliza al id del catálogo.
  const g = fixture();
  equal((await stripeCheckoutHandler(g.deps)(post({ plan: 'pro_mensual' }))).status, 200);
  equal(g.sessions[0]!.metadata, { uid: UID, plan: 'nivl_pro_mensual' });
  equal((await stripeCheckoutHandler(g.deps)(post({ plan: 'nivl_gratis' }))).status, 400);
  // Preflight con las cabeceras que manda supabase-js.
  const pre = await stripeCheckoutHandler(g.deps)(new Request('https://x', { method: 'OPTIONS', headers: { origin: 'https://nivl.app' } }));
  equal(pre.headers.get('access-control-allow-headers'), 'authorization, x-client-info, apikey, content-type');
});

Deno.test('checkout: sin JWT o con JWT inválido → 401; plan desconocido → 400; precio sin configurar → 503', async () => {
  const f = fixture();
  const h = stripeCheckoutHandler(f.deps);
  equal((await h(post({ plan: 'nivl_pro_mensual' }, { origin: 'https://nivl.app' }))).status, 401);
  equal((await h(post({ plan: 'nivl_pro_mensual' }, { authorization: 'Bearer forged' }))).status, 401);
  equal((await h(post({ plan: 'nivl_gratis' }))).status, 400);
  equal((await (await h(post({ plan: 'nivl_elite_anual' }))).json()).error, 'plan_no_disponible');
  equal((await h(post({ plan: 'nivl_pro_mensual' }, { authorization: 'Bearer jwt-ok', origin: 'https://evil.example' }))).status, 403);
  equal((await stripeCheckoutHandler(fixture({ mode: null }).deps)(post({ plan: 'nivl_pro_mensual' }))).status, 503);
  equal(f.sessions.length, 0);
});

Deno.test('checkout: rechaza (409) a quien ya tiene derecho vigente de cualquier proveedor', async () => {
  for (const [existing, provider] of [[row({}), 'apple'], [row({ provider: 'google' }), 'google'],
    [row({ provider: 'manual', plan: 'elite_anual' }), 'manual'], [row({ provider: 'manual', plan: 'owner', current_period_end: null }), 'owner'],
    [row({ provider: 'stripe', plan: 'pro_mensual', stripe_subscription_id: 'sub_1' }), 'stripe']] as const) {
    const f = fixture({ row: existing });
    const res = await stripeCheckoutHandler(f.deps)(post({ plan: 'nivl_pro_mensual' }));
    equal([res.status, (await res.json()).provider], [409, provider]);
    equal(f.sessions.length, 0);
  }
  const pastDue = fixture({ row: row({ provider: 'stripe', status: 'past_due', stripe_subscription_id: 'sub_1' }) });
  equal((await (await stripeCheckoutHandler(pastDue.deps)(post({ plan: 'nivl_pro_mensual' }))).json()).error, 'pago_pendiente');
});

Deno.test('checkout: la prueba (prueba_auto / cortesía) y una fila caducada NO bloquean; reutiliza el cliente Stripe', async () => {
  for (const existing of [row({ provider: 'prueba', plan: 'prueba_auto', status: 'trialing' }),
    row({ provider: 'manual', plan: 'cortesia', status: 'trialing' }),
    row({ provider: 'stripe', status: 'canceled', stripe_customer_id: 'cus_old', stripe_subscription_id: 'sub_old' })]) {
    const f = fixture({ row: existing });
    equal((await stripeCheckoutHandler(f.deps)(post({ plan: 'nivl_pro_mensual' }))).status, 200);
  }
  const reuse = fixture({ row: row({ status: 'canceled', stripe_customer_id: 'cus_old' }), env: { STRIPE_AUTOMATIC_TAX: 'true' } });
  await stripeCheckoutHandler(reuse.deps)(post({ plan: 'nivl_pro_mensual' }));
  const s = reuse.sessions[0]!;
  equal([s.customer, s.customer_email, s.automatic_tax, s.customer_update], ['cus_old', undefined, { enabled: true }, { address: 'auto', name: 'auto' }]);
});

Deno.test('checkout: suscripción Stripe viva aún sin webhook, borrado pendiente y fundador agotado → 409', async () => {
  const live = fixture({ row: row({ status: 'canceled', stripe_customer_id: 'cus_1' }), live: 1 });
  equal((await (await stripeCheckoutHandler(live.deps)(post({ plan: 'nivl_pro_mensual' }))).json()).error, 'ya_suscrito');
  const erasure = fixture({ erasure: true });
  equal((await (await stripeCheckoutHandler(erasure.deps)(post({ plan: 'nivl_pro_mensual' }))).json()).error, 'borrado_pendiente');
  const soldOut = fixture({ seats: 0 });
  const res = await stripeCheckoutHandler(soldOut.deps)(post({ plan: 'nivl_elite_fundador' }));
  equal([res.status, (await res.json()).error], [409, 'fundador_agotado']);
  equal((await stripeCheckoutHandler(fixture({ seats: 3 }).deps)(post({ plan: 'nivl_elite_fundador' }))).status, 200);
  equal([live.sessions.length, erasure.sessions.length, soldOut.sessions.length], [0, 0, 0]);
});

Deno.test('checkout en modo test: solo las cuentas de STRIPE_TEST_ACCESS', async () => {
  equal((await stripeCheckoutHandler(fixture({ mode: 'test' }).deps)(post({ plan: 'nivl_pro_mensual' }))).status, 403);
  equal((await stripeCheckoutHandler(fixture({ mode: 'test', env: { STRIPE_TEST_ACCESS: UID } }).deps)(post({ plan: 'nivl_pro_mensual' }))).status, 200);
  equal((await stripeCheckoutHandler(fixture({ mode: 'test', env: { STRIPE_TEST_ACCESS: 'basura' } }).deps)(post({ plan: 'nivl_pro_mensual' }))).status, 403);
});

Deno.test('CORS: preflight solo para los orígenes de NIVL_WEB_ORIGINS', async () => {
  const h = stripeCheckoutHandler(fixture().deps);
  const ok = await h(new Request('https://x/functions/v1/stripe-checkout', { method: 'OPTIONS', headers: { origin: 'https://www.nivl.app' } }));
  equal([ok.status, ok.headers.get('access-control-allow-origin')], [204, 'https://www.nivl.app']);
  const bad = await h(new Request('https://x/functions/v1/stripe-checkout', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }));
  equal([bad.status, bad.headers.get('access-control-allow-origin')], [403, null]);
});

Deno.test('portal: URL del Customer Portal para el cliente de la cuenta del JWT; sin cliente → 404', async () => {
  const f = fixture({ row: row({ provider: 'stripe', stripe_customer_id: 'cus_9', stripe_subscription_id: 'sub_9' }) });
  const res = await stripePortalHandler(f.deps)(post({ customer: 'cus_ajeno' }));
  equal([res.status, (await res.json()).url, f.portals], [200, 'https://billing.stripe.com/p/session/x', ['cus_9']]);
  equal((await stripePortalHandler(fixture().deps)(post({}))).status, 404);
  equal((await stripePortalHandler(fixture().deps)(post({}, { origin: 'https://nivl.app' }))).status, 401);
});

// Revisión independiente (c) de seguridad y escenarios de cobro, 2026-10-02.
// docs/payment-audit/REVISION-SEGURIDAD.md. Aislado: no contacta Supabase, RevenueCat ni Stripe.
//
// Los tests "DEFECTO …" REPRODUCEN el comportamiento actual defectuoso (pasan
// mientras el defecto exista). Al corregirlo, invierte la aserción marcada.
import { revenueCatServerKey, sandboxPolicy } from './store-config.ts';
import { parseCustomerInfo } from './store-reconcile.ts';
import { stripeWebhookHandler, type StripeDeps, type StripeSubscriptionState, type SubscriptionRow } from './store-stripe.ts';

const VICTIM = '00000000-0000-4000-8000-0000000000a1';
const equal = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
};
const env = (values: Record<string, string>) => (name: string) => values[name];

// ── Clave de servidor ───────────────────────────────────────────────
Deno.test('clave: formato documentado sk_ + alfanumérico se acepta; cualquier otro carácter falla en cerrado', () => {
  // Ejemplo literal de https://www.revenuecat.com/docs/projects/authentication (2026-10-02).
  equal(revenueCatServerKey(env({ REVENUECAT_API_KEY: 'sk_1234567890abcdef' })), 'sk_1234567890abcdef');
  equal(revenueCatServerKey(env({ REVENUECAT_API_KEY: 'sk_' + 'Ab9'.repeat(10) })), 'sk_' + 'Ab9'.repeat(10));
  // Riesgo P2: si RevenueCat emitiera claves con '_' o '-' tras el prefijo, el
  // servidor quedaría en 503 (seguro, pero caída de restauración/webhooks).
  equal(revenueCatServerKey(env({ REVENUECAT_API_KEY: 'sk_abc_defghijk' })), '');
  equal(revenueCatServerKey(env({ REVENUECAT_API_KEY: 'sk_abc-defghijk' })), '');
  // Claves cliente y de Test Store nunca valen.
  for (const k of ['appl_x1234567890', 'goog_x1234567890', 'test_x1234567890', 'sk_short']) {
    equal(revenueCatServerKey(env({ REVENUECAT_API_KEY: k })), '');
  }
});

// ── Sandbox ─────────────────────────────────────────────────────────
Deno.test('sandbox=none: un snapshot solo-sandbox llega vacío al SQL (0033 cancela la fila apple/google y conserva manual)', () => {
  const now = Date.now();
  const value = { request_date_ms: now, subscriber: { subscriptions: {
    nivl_elite_anual: { store: 'app_store', is_sandbox: true, period_type: 'normal', refunded_at: null,
      expires_date: new Date(now + 3600_000).toISOString(), grace_period_expires_date: null },
    'nivl_pro_anual:anual': { store: 'play_store', is_sandbox: true, period_type: 'normal', refunded_at: null,
      expires_date: new Date(now + 3600_000).toISOString(), grace_period_expires_date: null },
    // Test Store / promocional / Stripe nunca dan derecho de tienda nativa.
    nivl_pro_mensual: { store: 'test_store', is_sandbox: false, period_type: 'normal', refunded_at: null,
      expires_date: new Date(now + 3600_000).toISOString(), grace_period_expires_date: null },
  } } };
  const snap = parseCustomerInfo(value, { user_id: VICTIM, revision: 1 }, now, sandboxPolicy(env({ STORE_SANDBOX_ACCESS: 'none' })));
  equal(snap.subscriptions, []);
  const all = parseCustomerInfo(value, { user_id: VICTIM, revision: 1 }, now, sandboxPolicy(env({})));
  equal(all.subscriptions.map(s => [s.product_id, s.provider, s.environment]),
    [['nivl_elite_anual', 'apple', 'SANDBOX'], ['nivl_pro_anual', 'google', 'SANDBOX']]);
});

// ── Stripe ──────────────────────────────────────────────────────────
function stripeFixture(rows: SubscriptionRow[], subs: Record<string, Partial<StripeSubscriptionState>>) {
  const table = new Map(rows.map(r => [r.user_id, { ...r }]));
  const deps: StripeDeps = {
    verify: body => Promise.resolve(JSON.parse(body)),
    retrieve: id => Promise.resolve({ id, status: 'active', customer: 'cus_x', current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400, ...subs[id] }),
    repo: {
      byUser: id => Promise.resolve(table.get(id) ?? null),
      bySubscription: id => Promise.resolve([...table.values()].find(r => r.stripe_subscription_id === id) ?? null),
      insert: row => {
        if (table.has(row.user_id as string)) return Promise.resolve(false);
        table.set(row.user_id as string, row as unknown as SubscriptionRow); return Promise.resolve(true);
      },
      update: (id, expect, patch) => {
        const row = table.get(id);
        if (!row || row.provider !== expect.provider || row.plan !== expect.plan || row.stripe_subscription_id !== expect.stripe_subscription_id) return Promise.resolve(false);
        table.set(id, { ...row, ...patch } as SubscriptionRow); return Promise.resolve(true);
      },
    },
  };
  return { deps, table };
}
const req = (event: unknown) => new Request('https://local.invalid/stripe-webhook', {
  method: 'POST', headers: { 'stripe-signature': 'valid' }, body: JSON.stringify(event),
});

Deno.test('CORREGIDO P1 (Stripe web): un tercero con el uuid de la víctima NO sustituye su suscripción Stripe vigente', async () => {
  const victimRow: SubscriptionRow = {
    user_id: VICTIM, status: 'active', plan: 'mensual', provider: 'stripe',
    current_period_end: new Date(Date.now() + 20 * 86400_000).toISOString(), stripe_subscription_id: 'sub_victim',
  };
  const { deps, table } = stripeFixture([victimRow], { sub_attacker: {}, sub_victim: {} });
  const handler = stripeWebhookHandler(deps);
  equal(await (await handler(req({ id: 'e1', type: 'checkout.session.completed',
    data: { object: { client_reference_id: VICTIM, subscription: 'sub_attacker', customer: 'cus_attacker' } } }))).json(),
    { received: true, ignored: 'fila_protegida' });
  equal(table.get(VICTIM)!.stripe_subscription_id, 'sub_victim');
  equal(table.get(VICTIM)!.status, 'active');
});

Deno.test('ABIERTO P1-3 (Stripe web, bloquea activar Stripe): checkout sobre fila protegida → 200 "fila_protegida" y la suscripción Stripe pagada no queda registrada', async () => {
  const appleRow: SubscriptionRow = {
    user_id: VICTIM, status: 'active', plan: 'pro_anual', provider: 'apple',
    current_period_end: new Date(Date.now() + 5 * 86400_000).toISOString(), stripe_subscription_id: null,
  };
  const { deps, table } = stripeFixture([appleRow], { sub_new: {} });
  const res = await stripeWebhookHandler(deps)(req({ id: 'e4', type: 'checkout.session.completed',
    data: { object: { client_reference_id: VICTIM, subscription: 'sub_new', customer: 'cus_v' } } }));
  equal(await res.json(), { received: true, ignored: 'fila_protegida' });
  // DEFECTO: nadie guarda sub_new; al caducar la fila Apple, Stripe sigue cobrando y
  // customer.subscription.updated de sub_new se ignora ('sin_fila_stripe'): paga sin acceso.
  equal([...table.values()].some(r => r.stripe_subscription_id === 'sub_new'), false);
});

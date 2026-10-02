// Regression tests for the 2026-10-02 payment-server audit (docs/payment-audit/SERVIDOR.md).
// Isolated: no Supabase, RevenueCat or Stripe is contacted.
import type { Db } from './db.ts';
import { revenueCatServerKey, sandboxPolicy } from './store-config.ts';
import { normalizeStoreEvent, parseCustomerInfo, storeReconcileHandler } from './store-reconcile.ts';
import { storeWebhookHandler } from './store-webhook.ts';
import {
  stripeMayTakeOver, stripeWebhookHandler, type StripeDeps, type StripeSubscriptionState, type SubscriptionRow,
} from './store-stripe.ts';

const UID = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';
const equal = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
};
const env = (values: Record<string, string>) => (name: string) => values[name];
const raw = (overrides = {}) => ({
  store: 'app_store', is_sandbox: true, period_type: 'normal', refunded_at: null,
  expires_date: new Date(Date.now() + 3600_000).toISOString(), grace_period_expires_date: null, ...overrides,
});
const info = (subscriptions: unknown) => ({ request_date_ms: Date.now(), subscriber: { subscriptions } });

function rcFixture() {
  const trace: unknown[][] = [];
  const admin = {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: UID } }, error: null }) },
    rpc: (name: string, args: Record<string, unknown>) => {
      trace.push([name, args]);
      if (name === 'begin_store_reconciliation') return Promise.resolve({ data: [{ user_id: UID, revision: 1 }], error: null });
      return Promise.resolve({ data: { ok: true }, error: null });
    },
  } as unknown as Db;
  const fetcher = ((url: string, options: RequestInit) => {
    trace.push(['fetch', url, (options.headers as Record<string, string>).Authorization]);
    return Promise.resolve(new Response(JSON.stringify(info({ nivl_pro_mensual: raw() })), { status: 200 }));
  }) as typeof fetch;
  return { trace, admin, fetcher };
}
const webhookRequest = (event: Record<string, unknown>) => new Request('https://local.invalid/revenuecat-webhook', {
  method: 'POST', headers: { authorization: 'Bearer shared' }, body: JSON.stringify({ event }),
});

// ── P0-1 · RevenueCat key ───────────────────────────────────────────
Deno.test('server key: only a RevenueCat secret key is accepted; the iOS SDK key is never a fallback', () => {
  equal(revenueCatServerKey(env({})), '');
  equal(revenueCatServerKey(env({ EXPO_PUBLIC_RC_IOS_KEY: 'appl_publicIosKey123' })), '');
  equal(revenueCatServerKey(env({ REVENUECAT_API_KEY: 'appl_publicIosKey123' })), '');
  equal(revenueCatServerKey(env({ REVENUECAT_API_KEY: 'goog_publicAndroidKey1' })), '');
  equal(revenueCatServerKey(env({ REVENUECAT_API_KEY: ' sk_SecretProjectKey1 ' })), 'sk_SecretProjectKey1');
});

Deno.test('entrypoints do not read the iOS client key', async () => {
  for (const path of ['../revenuecat-webhook/index.ts', '../store-reconcile/index.ts']) {
    const source = await Deno.readTextFile(new URL(path, import.meta.url));
    equal(source.includes("get('EXPO_PUBLIC_RC_IOS_KEY')"), false);
    equal(source.includes('revenueCatServerKey(env)'), true);
  }
});

Deno.test('without a server key the webhook answers a retryable 503 before any RPC or HTTP call', async () => {
  const { trace, admin, fetcher } = rcFixture();
  const response = await storeWebhookHandler(admin, 'shared', '', fetcher)(webhookRequest({ id: 'e1', type: 'RENEWAL', app_user_id: UID }));
  equal(response.status, 503);
  equal(await response.json(), { error: 'store_not_configured' });
  equal(trace, []);
  const restore = await storeReconcileHandler(admin, '', fetcher)(new Request('https://local.invalid', {
    method: 'POST', headers: { authorization: 'Bearer token' },
  }));
  equal(restore.status, 503);
  equal(trace, []);
});

// ── P1 · Google Play product ids ────────────────────────────────────
Deno.test('Google Play product ids <subscription>:<base plan> reach SQL as the catalog id (sales are not dropped)', async () => {
  equal(normalizeStoreEvent({ product_id: 'nivl_pro_mensual:mensual' }),
    { product_id: 'nivl_pro_mensual', store_product_id_raw: 'nivl_pro_mensual:mensual' });
  equal(normalizeStoreEvent({ product_id: 'nivl_pro_mensual' }), { product_id: 'nivl_pro_mensual' });
  equal(normalizeStoreEvent({ product_id: 'otro:base' }), { product_id: 'otro:base' });
  const { trace, admin, fetcher } = rcFixture();
  const response = await storeWebhookHandler(admin, 'shared', 'sk_SecretProjectKey1', fetcher)(webhookRequest({
    id: 'g1', type: 'INITIAL_PURCHASE', app_user_id: UID, store: 'PLAY_STORE', environment: 'PRODUCTION',
    product_id: 'nivl_pro_mensual:mensual', event_timestamp_ms: Date.now() - 1000,
  }));
  equal(response.status, 200);
  const apply = trace.find(t => t[0] === 'apply_store_reconciliation')![1] as { p_event: Record<string, unknown> };
  equal(apply.p_event.product_id, 'nivl_pro_mensual');
  equal(apply.p_event.store_product_id_raw, 'nivl_pro_mensual:mensual');
  equal(trace.find(t => t[0] === 'fetch')![2], 'Bearer sk_SecretProjectKey1');
});

// ── P1 · Sandbox access policy ──────────────────────────────────────
Deno.test('sandbox policy: default keeps App Review working; none/allowlist stop free sandbox access', () => {
  const reservation = { user_id: UID, revision: 1 };
  const value = info({ nivl_pro_mensual: raw(), nivl_elite_anual: raw({ is_sandbox: false }) });
  equal(parseCustomerInfo(value, reservation, Date.now(), sandboxPolicy(env({}))).subscriptions.length, 2);
  equal(parseCustomerInfo(value, reservation, Date.now(), sandboxPolicy(env({ STORE_SANDBOX_ACCESS: 'all' }))).subscriptions.length, 2);
  const none = parseCustomerInfo(value, reservation, Date.now(), sandboxPolicy(env({ STORE_SANDBOX_ACCESS: 'none' })));
  equal(none.subscriptions.map(s => s.environment), ['PRODUCTION']);
  equal(parseCustomerInfo(value, reservation, Date.now(), sandboxPolicy(env({ STORE_SANDBOX_ACCESS: `${OTHER}` }))).subscriptions.length, 1);
  equal(parseCustomerInfo(value, reservation, Date.now(), sandboxPolicy(env({ STORE_SANDBOX_ACCESS: `${OTHER}, ${UID.toUpperCase()}` }))).subscriptions.length, 2);
  // A typo fails closed instead of opening sandbox to everyone.
  equal(sandboxPolicy(env({ STORE_SANDBOX_ACCESS: 'todos' }))(UID), false);
});

// ── Stripe ──────────────────────────────────────────────────────────
function stripeFixture(rows: SubscriptionRow[], sub: Partial<StripeSubscriptionState> = {}) {
  const writes: unknown[][] = [];
  const table = new Map(rows.map(r => [r.user_id, { ...r }]));
  const deps: StripeDeps = {
    verify: (body, signature) => signature === 'valid' ? Promise.resolve(JSON.parse(body)) : Promise.reject(new Error('bad')),
    retrieve: id => Promise.resolve({ id, status: 'active', customer: 'cus_1', current_period_end: Math.floor(Date.now() / 1000) + 86400, ...sub }),
    repo: {
      byUser: id => Promise.resolve(table.get(id) ?? null),
      bySubscription: id => Promise.resolve([...table.values()].find(r => r.stripe_subscription_id === id) ?? null),
      insert: row => {
        writes.push(['insert', row]);
        if (table.has(row.user_id as string)) return Promise.resolve(false);
        table.set(row.user_id as string, row as unknown as SubscriptionRow); return Promise.resolve(true);
      },
      update: (id, expect, patch) => {
        writes.push(['update', id, patch]);
        const row = table.get(id);
        if (!row || row.provider !== expect.provider || row.plan !== expect.plan || row.stripe_subscription_id !== expect.stripe_subscription_id) return Promise.resolve(false);
        table.set(id, { ...row, ...patch } as SubscriptionRow); return Promise.resolve(true);
      },
    },
  };
  return { deps, writes, table };
}
const stripeRequest = (event: unknown, signature = 'valid') => new Request('https://local.invalid/stripe-webhook', {
  method: 'POST', headers: { 'stripe-signature': signature }, body: JSON.stringify(event),
});
const checkout = (ref: unknown, subscription: unknown = 'sub_1') => ({
  id: 'evt_c', type: 'checkout.session.completed', data: { object: { client_reference_id: ref, subscription, customer: 'cus_1' } },
});
const row = (o: Partial<SubscriptionRow>): SubscriptionRow => ({
  user_id: UID, status: 'active', plan: 'pro_anual', provider: 'apple',
  current_period_end: new Date(Date.now() + 86400_000).toISOString(), stripe_subscription_id: null, ...o,
});

Deno.test('stripe: missing secrets fail closed (500) and bad signatures are rejected (400)', async () => {
  equal((await stripeWebhookHandler(null)(stripeRequest(checkout(UID)))).status, 500);
  const { deps, writes } = stripeFixture([]);
  equal((await stripeWebhookHandler(deps)(stripeRequest(checkout(UID), 'forged'))).status, 400);
  equal((await stripeWebhookHandler(deps)(new Request('https://x.invalid', { method: 'POST', body: '{}' }))).status, 400);
  equal(writes, []);
});

Deno.test('stripe: invalid client_reference_id and checkouts without subscription grant nothing (no forever-active row)', async () => {
  const { deps, writes } = stripeFixture([]);
  for (const event of [checkout('not-a-uuid'), checkout(UID, null)]) {
    const response = await stripeWebhookHandler(deps)(stripeRequest(event));
    equal(response.status, 200);
  }
  equal(writes, []);
});

Deno.test('stripe: a checkout never overwrites owner, an entitled Apple/Google row or an entitled manual grant', async () => {
  for (const protectedRow of [row({}), row({ plan: 'owner', provider: 'manual', current_period_end: null }),
    row({ plan: 'elite_anual', provider: 'manual' })]) {
    const { deps, writes } = stripeFixture([protectedRow]);
    const response = await stripeWebhookHandler(deps)(stripeRequest(checkout(UID)));
    equal(response.status, 200);
    equal(writes, []);
  }
  // A trial or an expired store row is replaced by the paying Stripe subscription.
  equal(stripeMayTakeOver(row({ plan: 'cortesia', provider: 'manual', status: 'trialing' }), Date.now()), true);
  equal(stripeMayTakeOver(row({ status: 'canceled' }), Date.now()), true);
  const { deps, table } = stripeFixture([row({ plan: 'cortesia', provider: 'manual', status: 'trialing' })]);
  equal((await stripeWebhookHandler(deps)(stripeRequest(checkout(UID)))).status, 200);
  equal([table.get(UID)!.provider, table.get(UID)!.plan, table.get(UID)!.status], ['stripe', 'mensual', 'active']);
});

Deno.test('stripe: a stale/duplicate "active" event cannot resurrect a canceled subscription (state is re-read)', async () => {
  const { deps, table } = stripeFixture([row({ provider: 'stripe', plan: 'mensual', stripe_subscription_id: 'sub_1' })], { status: 'canceled' });
  const stale = { id: 'evt_old', type: 'customer.subscription.updated', data: { object: { id: 'sub_1', status: 'active' } } };
  equal((await stripeWebhookHandler(deps)(stripeRequest(stale))).status, 200);
  equal(table.get(UID)!.status, 'canceled');
});

Deno.test('stripe: subscription events never touch a row that moved to the App Store / Google Play', async () => {
  const { deps, writes } = stripeFixture([row({ provider: 'apple', stripe_subscription_id: 'sub_1' })], { status: 'canceled' });
  const deleted = { id: 'evt_d', type: 'customer.subscription.deleted', data: { object: { id: 'sub_1' } } };
  equal((await stripeWebhookHandler(deps)(stripeRequest(deleted))).status, 200);
  equal(writes, []);
});

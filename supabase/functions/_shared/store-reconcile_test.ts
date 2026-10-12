import { eventUsers, parseCustomerInfo, reconcileStore, storeReconcileHandler } from './store-reconcile.ts';
import type { Db } from './db.ts';
import { storeWebhookHandler } from './store-webhook.ts';

const UID = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';
const equal = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
};
const fails = (fn: () => unknown) => {
  let failed = false;
  try { fn(); } catch { failed = true; }
  equal(failed, true);
};
const rawSubscription = (overrides = {}) => ({
  store: 'app_store', is_sandbox: true, period_type: 'normal', refunded_at: null,
  expires_date: new Date(Date.now() + 3600_000).toISOString(), grace_period_expires_date: null,
  store_transaction_id: 'current-period-not-original', ...overrides,
});
const info = (subscriptions: unknown = { nivl_pro_anual: rawSubscription() }, requested = Date.now()) => ({
  request_date_ms: requested, subscriber: { subscriptions },
});
const request = (authorization = 'Bearer test-token') => new Request('https://local.invalid/store-reconcile', {
  method: 'POST', headers: { authorization },
  body: JSON.stringify({ user_id: OTHER, api_key: 'caller-controlled', url: 'https://attacker.invalid', plan: 'owner' }),
});

function fixture() {
  const trace: unknown[][] = [];
  const state = {
    authenticated: true, reserveError: false, applyError: false, missingUser: false, stale: false,
    status: 200, body: info() as unknown, accountActive: true, guardError: false,
  };
  const admin = {
    auth: { getUser: (token: string) => {
      trace.push(['getUser', token]);
      return Promise.resolve({ data: { user: state.authenticated ? { id: UID } : null }, error: null });
    } },
    rpc: (name: string, args: Record<string, unknown>) => {
      trace.push([name, args]);
      if (name === 'request_store_erasure_cleanup') return Promise.resolve({ data: true, error: null });
      if (name === 'store_account_active') return Promise.resolve({ data: state.accountActive, error: state.guardError ? {} : null });
      if (name === 'begin_store_reconciliation') return Promise.resolve({ data: state.missingUser ? [] : [{ user_id: UID, revision: 2 }], error: state.reserveError ? {} : null });
      if (name === 'apply_store_reconciliation') return Promise.resolve({ data: { ok: !state.stale }, error: state.applyError ? {} : null });
      throw new Error('Unexpected RPC');
    },
  } as unknown as Db;
  const fetcher = ((url: string, options: RequestInit) => {
    trace.push(['fetch', url, options.method, options.headers]);
    return Promise.resolve(new Response(JSON.stringify(state.body), { status: state.status }));
  }) as typeof fetch;
  return { state, trace, admin, fetcher, handler: storeReconcileHandler(admin, 'pinned-public-key', fetcher),
    applies: () => trace.filter(t => t[0] === 'apply_store_reconciliation') };
}

Deno.test('customer parser accepts native catalog entries, server grace, and sandbox without inventing transaction ids', () => {
  const expiration = new Date(Date.now() + 3600_000).toISOString();
  const grace = new Date(Date.now() + 7200_000).toISOString();
  const snapshot = parseCustomerInfo(info({
    nivl_pro_anual: rawSubscription({ expires_date: expiration, grace_period_expires_date: grace }),
    'nivl_elite_anual:base': rawSubscription({ store: 'play_store', is_sandbox: false, period_type: 'trial', expires_date: expiration }),
    unknown_product: rawSubscription(),
    nivl_elite_mensual: rawSubscription({ store: 'stripe' }),
  }), { user_id: UID, revision: 1 });
  equal(snapshot.subscriptions, [
    { product_id: 'nivl_pro_anual', provider: 'apple', environment: 'SANDBOX', expires_at: grace, trial: false, refunded: false },
    { product_id: 'nivl_elite_anual', provider: 'google', environment: 'PRODUCTION', expires_at: expiration, trial: true, refunded: false },
  ]);
  equal(JSON.stringify(snapshot).includes('current-period-not-original'), false);
});

Deno.test('customer parser rejects malformed/stale snapshots instead of interpreting them as no purchase', () => {
  const reservation = { user_id: UID, revision: 1 };
  for (const value of [null, {}, info(null), info([]), info({}, Date.now() - 130_000), info({}, Date.now() + 70_000),
    info({ nivl_pro_anual: null }), info({ nivl_pro_anual: rawSubscription({ expires_date: null }) }),
    info({ nivl_pro_anual: rawSubscription({ is_sandbox: 'false' }) }),
    info({ nivl_pro_anual: rawSubscription({ grace_period_expires_date: 'invalid' }) }),
    info({ nivl_pro_anual: rawSubscription({ refunded_at: 'invalid' }) }),
    info({ nivl_pro_anual: rawSubscription({ period_type: 'unknown' }) })]) {
    fails(() => parseCustomerInfo(value, reservation));
  }
});

Deno.test('endpoint verifies JWT, ignores body identity/key/plan and uses pinned RevenueCat URL/key', async () => {
  const f = fixture();
  equal((await f.handler(request())).status, 200);
  equal(f.trace.filter(t => t[0] !== 'store_account_active').slice(0, 3), [
    ['getUser', 'test-token'], ['begin_store_reconciliation', { p_users: [UID] }],
    ['fetch', `https://api.revenuecat.com/v1/subscribers/${UID}`, 'GET', { Authorization: 'Bearer pinned-public-key', Accept: 'application/json' }],
  ]);
  const args = f.applies()[0][1] as { p_event: unknown; p_snapshots: { user_id: string; revision: number }[] };
  equal(args.p_event, null); equal(args.p_snapshots[0].user_id, UID); equal(args.p_snapshots[0].revision, 2);
});

Deno.test('endpoint accepts only POST with a verified bearer session', async () => {
  const f = fixture();
  equal((await f.handler(new Request('https://local.invalid'))).status, 405);
  equal((await f.handler(request(''))).status, 401);
  equal((await f.handler(request('not-a-bearer'))).status, 401);
  equal(f.trace, []);
  f.state.authenticated = false;
  equal((await f.handler(request())).status, 401); equal(f.trace, [['getUser', 'test-token']]);
});

Deno.test('HTTP failures, missing user, malformed provider data and missing key never mutate entitlement', async () => {
  for (const status of [401, 404, 429, 500]) {
    const f = fixture(); f.state.status = status;
    const response = await f.handler(request());
    equal(response.status, 503); equal(f.applies(), []);
    equal(JSON.stringify(await response.json()).includes('pinned-public-key'), false);
  }
  for (const invalid of [null, {}, info(null)]) {
    const f = fixture(); f.state.body = invalid;
    equal((await f.handler(request())).status, 503); equal(f.applies(), []);
  }
  const f = fixture(); f.state.missingUser = true;
  equal((await f.handler(request())).status, 503); equal(f.applies(), []);
  const noKey = fixture();
  equal((await storeReconcileHandler(noKey.admin, '', noKey.fetcher)(request())).status, 503);
  equal(noKey.trace, [['getUser', 'test-token']]);
});

Deno.test('superseded snapshot is pending, never confirmed; database error remains retryable', async () => {
  const f = fixture(); f.state.stale = true;
  const response = await f.handler(request());
  equal(response.status, 202); equal(await response.json(), { ok: false, pending: true });
  f.state.applyError = true;
  equal((await f.handler(request())).status, 503);
});

Deno.test('transfer identities include all valid sources/destinations, including a deleted source', async () => {
  const event = { id: 'transfer', type: 'TRANSFER', transferred_from: [OTHER, '$RCAnonymousID:old'], transferred_to: [UID, UID] };
  equal(eventUsers(event), [UID, OTHER]);
  const f = fixture(); // Reservation omits OTHER because Auth no longer contains it.
  equal(await reconcileStore(f.admin, eventUsers(event), 'pinned-public-key', event, f.fetcher), { ok: true });
  const args = f.applies()[0][1] as { p_event: unknown; p_snapshots: { user_id: string }[] };
  equal(args.p_event, event); equal(args.p_snapshots.map(s => s.user_id), [UID]);
});

Deno.test('snapshot preceding an authenticated webhook is rejected for retry', async () => {
  const f = fixture();
  let failed = false;
  try {
    await reconcileStore(f.admin, [UID], 'pinned-public-key', { id: 'new', type: 'RENEWAL', event_timestamp_ms: Date.now() + 500 }, f.fetcher);
  } catch { failed = true; }
  equal(failed, true); equal(f.applies(), []);
});

const webhookRequest = (event: unknown, authorization = 'Bearer webhook-secret') => new Request('https://local.invalid/revenuecat-webhook', {
  method: 'POST', headers: { authorization }, body: JSON.stringify({ api_version: '1.0', event }),
});

Deno.test('webhook keeps shared-secret authentication and never contacts RevenueCat before verification', async () => {
  const f = fixture(); const event = { id: 'event', type: 'RENEWAL', app_user_id: UID };
  const handler = storeWebhookHandler(f.admin, 'webhook-secret', 'pinned-public-key', f.fetcher);
  equal((await handler(new Request('https://local.invalid'))).status, 405);
  equal((await handler(webhookRequest(event, ''))).status, 401);
  equal((await handler(webhookRequest(event, 'other-secret'))).status, 401);
  equal((await storeWebhookHandler(f.admin, '', 'pinned-public-key', f.fetcher)(webhookRequest(event))).status, 401);
  equal(f.trace, []);
  equal((await handler(webhookRequest(event, 'webhook-secret'))).status, 200);
  equal(f.applies().length, 1);
  equal(f.trace.some(t => t[0] === 'getUser' || t[0] === 'apply_store_event'), false);
});

Deno.test('authenticated transfer webhook reconciles surviving destination even if source account is gone', async () => {
  const f = fixture(); const event = { id: 'transfer', type: 'TRANSFER', transferred_from: [OTHER], transferred_to: [UID] };
  const response = await storeWebhookHandler(f.admin, 'webhook-secret', 'pinned-public-key', f.fetcher)(webhookRequest(event));
  equal(response.status, 200); equal(await response.json(), { ok: true });
  const args = f.applies()[0][1] as { p_event: unknown; p_snapshots: { user_id: string }[] };
  equal(args.p_event, event); equal(args.p_snapshots.map(s => s.user_id), [UID]);
});

Deno.test('webhook returns retryable failure for provider errors, database errors and superseded snapshots', async () => {
  for (const failure of ['provider', 'database', 'stale']) {
    const f = fixture();
    if (failure === 'provider') f.state.status = 503;
    if (failure === 'database') f.state.applyError = true;
    if (failure === 'stale') f.state.stale = true;
    const response = await storeWebhookHandler(f.admin, 'webhook-secret', 'pinned-public-key', f.fetcher)(
      webhookRequest({ id: 'refund', type: 'CANCELLATION', app_user_id: UID, cancel_reason: 'CUSTOMER_SUPPORT' }),
    );
    equal(response.status, 503);
    if (failure === 'provider') equal(f.applies(), []);
  }
});


Deno.test('reconciliation compensates delayed GET that recreates a customer after account erasure', async () => {
  const f = fixture();
  let finish!: () => void;
  let providerExists = true;
  const methods: string[] = [];
  const fetcher = ((_: string, options: RequestInit) => {
    methods.push(options.method!);
    if (options.method === 'DELETE') { providerExists = false; return Promise.resolve(new Response(null, { status: 200 })); }
    return new Promise<Response>((resolve) => { finish = () => {
      providerExists = true;
      resolve(new Response(JSON.stringify(info()), { status: 200 }));
    }; });
  }) as typeof fetch;
  const running = reconcileStore(f.admin, [UID], 'sk_server', undefined, fetcher);
  for (let i = 0; i < 10; i++) await Promise.resolve();
  f.state.accountActive = false;
  providerExists = false;
  finish();
  let failed = false;
  try { await running; } catch { failed = true; }
  equal(failed, true);
  equal(methods, ['GET', 'DELETE']);
  equal(providerExists, false);
  equal(f.applies(), []);
});


Deno.test('pending erasure before GET stops a provider read without deleting an active customer blindly', async () => {
  const f = fixture(); f.state.accountActive = false;
  let failed = false;
  try { await reconcileStore(f.admin, [UID], 'sk_server', undefined, f.fetcher); } catch { failed = true; }
  equal(failed, true);
  equal(f.trace.filter(t => t[0] === 'fetch'), []);
  equal(f.applies(), []);
});

Deno.test('account status lookup errors never trigger destructive provider cleanup', async () => {
  const f = fixture();
  const methods: string[] = [];
  const fetcher = ((_: string, options: RequestInit) => {
    methods.push(options.method!);
    f.state.guardError = true;
    return Promise.resolve(new Response(JSON.stringify(info()), { status: 200 }));
  }) as typeof fetch;
  let failed = false;
  try { await reconcileStore(f.admin, [UID], 'sk_server', undefined, fetcher); } catch { failed = true; }
  equal(failed, true); equal(methods, ['GET']); equal(f.applies(), []);
});

Deno.test('compensation runs even when a GET loses its response and never reports failed DELETE as success', async () => {
  for (const deleteStatus of [200, 404, 500]) {
    const f = fixture(); const methods: string[] = [];
    const fetcher = ((_: string, options: RequestInit) => {
      methods.push(options.method!);
      if (options.method === 'DELETE') return Promise.resolve(new Response(null, { status: deleteStatus }));
      f.state.accountActive = false;
      return Promise.reject(new Error('Connection lost after provider creation'));
    }) as typeof fetch;
    let failed = false;
    try { await reconcileStore(f.admin, [UID], 'sk_server', undefined, fetcher); } catch { failed = true; }
    equal(failed, true);
    equal(methods, deleteStatus === 500 ? ['GET', 'DELETE', 'DELETE', 'DELETE'] : ['GET', 'DELETE']);
    equal(f.applies(), []);
  }
});

Deno.test('erasure during SQL application is checked again before a successful response', async () => {
  const f = fixture(); const rpc = f.admin.rpc.bind(f.admin);
  f.admin.rpc = ((name: string, args: Record<string, unknown>) => {
    if (name === 'apply_store_reconciliation') f.state.accountActive = false;
    return rpc(name, args);
  }) as Db['rpc'];
  let failed = false;
  try { await reconcileStore(f.admin, [UID], 'sk_server', undefined, f.fetcher); } catch { failed = true; }
  equal(failed, true);
  equal(f.trace.filter(t => t[0] === 'fetch').map(t => t[2]), ['GET', 'DELETE']);
});


Deno.test('compensation retries transient DELETE failures within a strict bound', async () => {
  const f = fixture(); let deletes = 0; let providerExists = true;
  const fetcher = ((_: string, options: RequestInit) => {
    if (options.method === 'GET') {
      f.state.accountActive = false;
      return Promise.resolve(new Response(JSON.stringify(info()), { status: 200 }));
    }
    deletes++;
    if (deletes === 1) return Promise.reject(new Error('Lost network'));
    if (deletes === 2) return Promise.resolve(new Response(null, { status: 503 }));
    providerExists = false;
    return Promise.resolve(new Response(null, { status: 404 }));
  }) as typeof fetch;
  let failed = false;
  try { await reconcileStore(f.admin, [UID], 'sk_server', undefined, fetcher); } catch { failed = true; }
  equal(failed, true); equal(deletes, 3); equal(providerExists, false); equal(f.applies(), []);
});

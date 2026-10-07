import type { Db } from './db.ts';
import { storeErasureCleanupHandler } from './store-erasure-cleanup.ts';
import { reconcileStore } from './store-reconcile.ts';

const UID = '00000000-0000-4000-8000-000000000001';
const LEASE = '10000000-0000-4000-8000-000000000001';
const equal = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
};
const request = (secret = 'server-only-secret') => new Request('https://local.invalid/cleanup', {
  method: 'POST', headers: { 'x-ritual-secret': secret, authorization: 'Bearer ordinary-user-token' },
  body: JSON.stringify({ user_id: 'attacker-chosen-id', limit: 99999 }),
});

function fixture() {
  const trace: unknown[][] = [];
  const state = { active: true, queued: true, providerExists: false, providerStatus: 200, finishError: false, claimError: false };
  const admin = { rpc: (name: string, args: Record<string, unknown>) => {
    trace.push([name, args]);
    if (name === 'begin_store_reconciliation') return Promise.resolve({ data: [{ user_id: UID, revision: 1 }], error: null });
    if (name === 'store_account_active') return Promise.resolve({ data: state.active, error: null });
    if (name === 'request_store_erasure_cleanup') { state.queued = true; return Promise.resolve({ data: true, error: null }); }
    if (name === 'claim_store_erasure_cleanup') return Promise.resolve({ data: state.queued ? [{ user_id: UID, lease_id: LEASE }] : [], error: state.claimError ? {} : null });
    if (name === 'finish_store_erasure_cleanup') return Promise.resolve({ data: !state.finishError, error: state.finishError ? {} : null });
    throw new Error('Unexpected RPC');
  } } as unknown as Db;
  const fetcher = ((url: string, options: RequestInit) => {
    trace.push(['fetch', url, options.method]);
    if (options.method !== 'DELETE') throw new Error('Unexpected read');
    const status = state.providerStatus === 200 && !state.providerExists ? 404 : state.providerStatus;
    if (status === 200 || status === 404) state.providerExists = false;
    return Promise.resolve(new Response(null, { status }));
  }) as typeof fetch;
  return { state, trace, admin, fetcher, handler: storeErasureCleanupHandler(admin, 'sk_server', 'server-only-secret', fetcher) };
}

Deno.test('cleanup rejects anonymous and ordinary Auth callers before any claim/provider request', async () => {
  const f = fixture();
  equal((await f.handler(request(''))).status, 401);
  equal((await f.handler(request('wrong-secret'))).status, 401);
  equal((await f.handler(new Request('https://local.invalid'))).status, 405);
  equal((await storeErasureCleanupHandler(f.admin, 'sk_server', '', f.fetcher)(request())).status, 401);
  equal(f.trace, []);
});

Deno.test('cleanup uses only database leases and ignores request identity/limit; 404 schedules another pass', async () => {
  const f = fixture();
  const response = await f.handler(request());
  equal(response.status, 200);
  equal(await response.json(), { ok: true, processed: 1 });
  equal(f.trace, [
    ['claim_store_erasure_cleanup', { p_limit: 20 }],
    ['fetch', `https://api.revenuecat.com/v1/subscribers/${UID}`, 'DELETE'],
    ['finish_store_erasure_cleanup', { p_user: UID, p_lease: LEASE, p_deleted: true }],
  ]);
  equal(f.state.queued, true);
});

Deno.test('aborted GET recreates provider customer AFTER DELETE404; independent cleanup removes it after Auth is gone', async () => {
  const f = fixture();
  let remoteFinish!: () => void;
  const fetcher = ((url: string, options: RequestInit) => {
    if (options.method === 'DELETE') return f.fetcher(url, options);
    // Request was accepted remotely. Local cancellation does not stop the remote side effect.
    remoteFinish = () => { f.state.providerExists = true; };
    f.state.active = false;
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }) as typeof fetch;
  let failed = false;
  try { await reconcileStore(f.admin, [UID], 'sk_server', undefined, fetcher); } catch { failed = true; }
  equal(failed, true);
  equal(f.trace.some(t => t[0] === 'fetch' && t[2] === 'DELETE'), true);
  equal(f.state.providerExists, false); // compensation DELETE404 has completed
  remoteFinish();
  equal(f.state.providerExists, true); // actual defect: provider completed GET after that 404
  equal((await f.handler(request())).status, 200);
  equal(f.state.active, false);
  equal(f.state.providerExists, false);
  equal(f.state.queued, true); // no Auth FK, no removal of the tombstone on 404
  remoteFinish(); // another extremely late remote request
  equal((await f.handler(request())).status, 200);
  equal(f.state.providerExists, false);
});

Deno.test('provider and acknowledgement failures leave retryable cleanup; missing configuration claims nothing', async () => {
  const f = fixture(); f.state.providerStatus = 503;
  equal((await f.handler(request())).status, 503);
  equal(f.trace.at(-1), ['finish_store_erasure_cleanup', { p_user: UID, p_lease: LEASE, p_deleted: false }]);
  equal(f.state.queued, true);
  f.state.providerStatus = 200; f.state.finishError = true;
  equal((await f.handler(request())).status, 503);
  f.trace.length = 0;
  equal((await storeErasureCleanupHandler(f.admin, '', 'server-only-secret', f.fetcher)(request())).status, 503);
  equal(f.trace, []);
});

Deno.test('malformed or failed claims never select a provider identity from client data', async () => {
  const f = fixture(); f.state.claimError = true;
  equal((await f.handler(request())).status, 503);
  equal(f.trace.length, 1);
  f.admin.rpc = (() => Promise.resolve({ data: [{ user_id: UID, lease_id: 'invalid' }], error: null })) as unknown as Db['rpc'];
  f.trace.length = 0;
  equal((await f.handler(request())).status, 503);
  equal(f.trace, []);
});

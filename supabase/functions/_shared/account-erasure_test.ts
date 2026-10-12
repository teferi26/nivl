import { accountErasureHandler } from './account-erasure.ts';
import type { Db } from './db.ts';

const UID = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';
const JOB = '10000000-0000-4000-8000-000000000001';
const equal = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
};
const request = (body: unknown = { confirm: 'BORRAR_CUENTA_NIVL', user_id: OTHER }, authorization = 'Bearer test-only') =>
  new Request('https://local.invalid/account-erasure', { method: 'POST', headers: { authorization }, body: JSON.stringify(body) });

function fixture() {
  const trace: unknown[][] = [];
  const state = {
    authenticated: true, beginError: false, queueError: false, listError: false, ready: true,
    deleteError: false, removeError: '', throwRemove: false, staleList: false,
    objects: [{ bucket: 'evidence', path: `${UID}/nested/photo.jpg` }, { bucket: 'avatars', path: `${UID}/avatar.jpg` }] as unknown,
  };
  const admin = {
    auth: {
      getUser: (token: string) => {
        trace.push(['getUser', token]);
        return Promise.resolve({ data: { user: state.authenticated ? { id: UID } : null }, error: null });
      },
      admin: { deleteUser: (uid: string, soft: boolean) => {
        trace.push(['deleteUser', uid, soft]);
        return Promise.resolve({ data: null, error: state.deleteError ? {} : null });
      } },
    },
    rpc: (name: string, args: unknown) => {
      trace.push([name, args]);
      if (name === 'request_store_erasure_cleanup') return Promise.resolve({ data: !state.queueError, error: state.queueError ? {} : null });
      if (name === 'begin_account_erasure') return Promise.resolve({ data: { ok: true, job_id: JOB }, error: state.beginError ? {} : null });
      if (name === 'account_erasure_paths') return Promise.resolve({ data: state.objects, error: state.listError ? {} : null });
      if (name === 'account_erasure_ready') return Promise.resolve({ data: state.ready, error: null });
      throw new Error('Unexpected RPC');
    },
    storage: { from: (bucket: string) => ({ remove: (paths: string[]) => {
      trace.push(['remove', bucket, paths]);
      if (state.throwRemove) throw new Error('private provider details');
      if (state.removeError === bucket) return Promise.resolve({ error: {} });
      if (!state.staleList && Array.isArray(state.objects)) state.objects = state.objects.filter(item => item.bucket !== bucket || !paths.includes(item.path));
      return Promise.resolve({ error: null });
    } }) },
  } as unknown as Db;
  return { state, trace, handler: accountErasureHandler(admin, { revenueCatKey: 'sk_testOnly123', fetcher: (() => Promise.resolve(new Response(null, { status: 200 }))) as typeof fetch }), deletions: () => trace.filter(t => t[0] === 'deleteUser'), removals: () => trace.filter(t => t[0] === 'remove') };
}

Deno.test('account erasure requires POST, verified owner, and exact confirmation before any mutation', async () => {
  const f = fixture();
  equal((await f.handler(new Request('https://local.invalid/'))).status, 405);
  equal((await f.handler(request(undefined, ''))).status, 401);
  equal((await f.handler(request(undefined, 'not-a-bearer-token'))).status, 401);
  equal(f.trace, []);
  equal((await f.handler(request({ confirm: 'BORRAR_TODO' }))).status, 400);
  equal((await f.handler(request(null))).status, 400);
  f.state.authenticated = false;
  equal((await f.handler(request())).status, 401);
  equal(f.trace.every(t => t[0] === 'getUser'), true);
});

Deno.test('account erasure ignores body user_id, blocks first, removes both buckets and verifies empty before hard Auth delete', async () => {
  const f = fixture();
  const response = await f.handler(request());
  equal(response.status, 200); equal(await response.json(), { ok: true });
  equal(f.trace, [
    ['getUser', 'test-only'], ['begin_account_erasure', { p_user: UID }],
    ['request_store_erasure_cleanup', { p_user: UID }],
    ['account_erasure_paths', { p_user: UID, p_job: JOB }],
    ['remove', 'evidence', [`${UID}/nested/photo.jpg`]], ['remove', 'avatars', [`${UID}/avatar.jpg`]],
    ['account_erasure_paths', { p_user: UID, p_job: JOB }],
    ['account_erasure_ready', { p_user: UID, p_job: JOB }], ['deleteUser', UID, false],
  ]);
});

Deno.test('invalid bucket, other owner, traversal and malformed list never reach the Storage API', async () => {
  for (const objects of [null, {}, [{ bucket: 'private', path: `${UID}/photo.jpg` }],
    [{ bucket: 'avatars', path: `${OTHER}/photo.jpg` }], [{ bucket: 'avatars', path: `${UID}/../${OTHER}/photo.jpg` }],
    [{ bucket: 'avatars', path: `${UID}/a\\b.jpg` }], [{ bucket: 'avatars', path: `${UID}//x.jpg` }],
    [{ bucket: 'avatars', path: `${UID}/./x.jpg` }], [{ bucket: 'avatars', path: `${UID}/` }]]) {
    const f = fixture(); f.state.objects = objects;
    equal((await f.handler(request())).status, 503);
    equal(f.removals(), []); equal(f.deletions(), []);
  }
});

Deno.test('partial Storage failure keeps Auth; retry resumes only remaining files under the same job', async () => {
  const f = fixture(); f.state.removeError = 'avatars';
  const first = await f.handler(request()); equal(first.status, 503); equal((await first.json()).pending, true);
  equal(f.deletions(), []); equal(f.state.objects, [{ bucket: 'avatars', path: `${UID}/avatar.jpg` }]);
  f.state.removeError = '';
  equal((await f.handler(request())).status, 200);
  equal(f.removals().filter(t => t[1] === 'evidence').length, 1);
  equal(f.deletions().length, 1);
});

Deno.test('a job/list/final-empty/Auth failure never returns success', async () => {
  for (const field of ['beginError', 'listError', 'deleteError'] as const) {
    const f = fixture(); f.state[field] = true;
    equal((await f.handler(request())).status, 503);
    if (field !== 'deleteError') equal(f.deletions(), []);
    if (field === 'beginError') equal(f.removals(), []);
  }
  const f = fixture(); f.state.ready = false;
  equal((await f.handler(request())).status, 503); equal(f.deletions(), []);
});

Deno.test('thrown provider errors remain resumable and do not leak error details', async () => {
  const f = fixture(); f.state.throwRemove = true;
  const response = await f.handler(request()); equal(response.status, 503);
  const body = await response.text(); equal(body.includes('private provider details'), false);
  equal(f.deletions(), []);
});

Deno.test('bounded work returns pending when successful removals have not actually cleared metadata', async () => {
  const f = fixture(); f.state.staleList = true;
  const response = await f.handler(request()); equal(response.status, 202); equal((await response.json()).ok, false);
  equal(f.deletions(), []); equal(f.trace.filter(t => t[0] === 'account_erasure_paths').length, 20);
});


Deno.test('account erasure cannot delete Auth when its durable provider cleanup queue fails', async () => {
  const f = fixture(); f.state.queueError = true;
  const response = await f.handler(request());
  equal(response.status, 503);
  equal((await response.json()).pending, true);
  equal(f.deletions(), []); equal(f.removals(), []);
});

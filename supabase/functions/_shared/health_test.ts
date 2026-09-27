import { healthConsent, healthGuardedResult, healthRevision, healthScopedClient, requireHealth } from './health.ts';
import { healthErasureHandler } from './health-erasure.ts';
import { buildContext } from './context.ts';
import { construirEstudio } from './analytics.ts';
import { construirResumen } from './recap.ts';
import { executeTool } from './tools.ts';
import type { Db } from './db.ts';

const equal = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
};
const rejects = async (fn: () => Promise<unknown>) => {
  let rejected = false; try { await fn(); } catch { rejected = true; } equal(rejected, true);
};
const UID = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';

Deno.test('health: only explicit true authorizes; errors, null and truthy strings do not', async () => {
  for (const value of [false, null, 'true', {}]) {
    const sb = { rpc: () => Promise.resolve({ data: value, error: null }) } as unknown as Db;
    equal(await healthConsent(sb, UID), false);
    await rejects(() => requireHealth(sb, UID));
  }
  equal(await healthConsent({ rpc: () => Promise.resolve({ data: true, error: null }) } as unknown as Db, UID), true);
  equal(await healthConsent({ rpc: () => Promise.resolve({ data: true, error: {} }) } as unknown as Db, UID), null);
});

Deno.test('no health consent stops context, analytics, recap and tool BEFORE reading private data or writing', async () => {
  let reads = 0;
  const sb = { rpc: () => Promise.resolve({ data: false, error: null }), from: () => { reads++; throw new Error('Private read/write must not happen'); } } as unknown as Db;
  await rejects(() => buildContext(sb, UID, '2026-09-27'));
  await rejects(() => construirEstudio(sb, UID, '2026-09-27'));
  await rejects(() => construirResumen(sb, UID, 'semanal', '2026-09-27'));
  await rejects(() => executeTool('crear_mision', { titulo: 'test' }, { sb, userId: UID, today: '2026-09-27' }));
  equal(reads, 0);
});

Deno.test('withdraw/reaccept changes revision and invalidates a request that began before withdrawal', async () => {
  let revision = 4;
  const query = { select: () => query, eq: () => query, maybeSingle: () => Promise.resolve({ data: { revision, accepted: true }, error: null }) };
  const sb = { rpc: () => Promise.resolve({ data: true, error: null }), from: () => query } as unknown as Db;
  equal(await healthRevision(sb, UID), 4);
  const scoped = healthScopedClient(sb, 4);
  equal(await healthConsent(scoped, UID), true);
  revision = 6;
  equal(await healthConsent(scoped, UID), false);
  await rejects(() => requireHealth(scoped, UID));
});

Deno.test('AI mixed writes carry provenance including array inserts, updates and dynamic table names', () => {
  const seen: unknown[] = [];
  const builder = { insert: (v: unknown) => { seen.push(v); return builder; }, upsert: (v: unknown) => { seen.push(v); return builder; }, update: (v: unknown) => { seen.push(v); return builder; }, eq: () => builder };
  const scoped = healthScopedClient({ from: () => builder } as unknown as Db, 1);
  scoped.from('quests').insert({ title: 'A', health_data: false });
  scoped.from('calendar_events').upsert([{ title: 'B' }, { title: 'C' }]);
  scoped.from('rules').update({ active: false }).eq('id', 'x');
  scoped.from('transactions').insert({ amount: 2 });
  scoped.from('transactions').insert({ amount: 3, description: 'AI note' });
  scoped.from('budgets').update({ active: false });
  scoped.from('money_plan').update({ rationale: 'AI rationale' });
  scoped.from('category_rules').upsert({ pattern: 'AI merchant' });
  equal(seen, [{ title: 'A', health_data: true }, [{ title: 'B', health_data: true }, { title: 'C', health_data: true }], { active: false, health_data: true }, { amount: 2 },
    { amount: 3, description: 'AI note', health_note: true }, { active: false }, { rationale: 'AI rationale', health_note: true }, { pattern: 'AI merchant', health_note: true }]);
});

Deno.test('provider response is not delivered after withdraw/reaccept while its request is in flight', async () => {
  let revision = 1;
  let delivered = false;
  const query = { select: () => query, eq: () => query, maybeSingle: () => Promise.resolve({ data: { revision }, error: null }) };
  const scoped = healthScopedClient({ rpc: () => Promise.resolve({ data: true, error: null }), from: () => query } as unknown as Db, 1);
  await rejects(async () => {
    await healthGuardedResult(scoped, UID, async () => { revision = 3; return 'sensitive answer'; });
    delivered = true;
  });
  equal(delivered, false);
});

function erasureFixture() {
  const trace: unknown[] = [];
  let paths: string[] = [`${UID}/photo.jpg`];
  let removalError = false;
  let validSession = true;
  const user = { rpc: async (name: string, args: unknown) => {
    trace.push([name, args]);
    if (name === 'withdraw_health_consent') return { data: { ok: true, job_id: 'job-own' }, error: null };
    if (name === 'health_erasure_paths') return { data: paths, error: null };
    throw new Error('unexpected user RPC');
  } } as unknown as Db;
  const admin = {
    auth: { getUser: () => Promise.resolve({ data: { user: validSession ? { id: UID } : null }, error: null }) },
    rpc: (name: string, args: unknown) => { trace.push([name, args]); return Promise.resolve({ data: { ok: true }, error: null }); },
    storage: { from: (bucket: string) => ({ remove: (value: string[]) => {
      trace.push(['remove', bucket, value]); if (!removalError) paths = [];
      return Promise.resolve({ error: removalError ? {} : null });
    } }) },
  } as unknown as Db;
  return { trace, handler: healthErasureHandler(admin, () => user), setPaths: (v: string[]) => { paths = v; }, failRemove: () => { removalError = true; }, denySession: () => { validSession = false; } };
}
const request = (confirm = 'BORRAR_SALUD_DIARIO_FOTOS_COACH') => new Request('https://local.invalid/health-erasure', { method: 'POST', headers: { authorization: 'Bearer test-only' }, body: JSON.stringify({ confirm, user_id: OTHER }) });

Deno.test('erasure needs authenticated owner and exact confirmation; no mutation before either', async () => {
  const f = erasureFixture();
  equal((await f.handler(request('not-confirmed'))).status, 400); equal(f.trace, []);
  f.denySession(); equal((await f.handler(request())).status, 401); equal(f.trace, []);
});

Deno.test('erasure ignores body user_id, withdraws first, removes only own storage, completes last', async () => {
  const f = erasureFixture(); const res = await f.handler(request());
  equal(res.status, 200); equal(await res.json(), { ok: true });
  equal(f.trace, [
    ['withdraw_health_consent', { p_erase: true }], ['health_erasure_paths', { p_job: 'job-own' }],
    ['remove', 'evidence', [`${UID}/photo.jpg`]], ['health_erasure_paths', { p_job: 'job-own' }],
    ['complete_health_erasure', { p_user: UID, p_job: 'job-own' }],
  ]);
});

Deno.test('erasure storage failure keeps withdrawal pending and never completes; retry can resume', async () => {
  const f = erasureFixture(); f.failRemove(); const res = await f.handler(request());
  equal(res.status, 503); equal((await res.json()).pending, true);
  equal(f.trace.some(v => Array.isArray(v) && v[0] === 'complete_health_erasure'), false);
  // On a subsequent invocation the same server job can report the folder empty.
  f.setPaths([]); equal((await f.handler(request())).status, 200);
});

Deno.test('an unexpected other-owner storage path is rejected without attempting removal', async () => {
  const f = erasureFixture(); f.setPaths([`${OTHER}/photo.jpg`]);
  equal((await f.handler(request())).status, 503);
  equal(f.trace.some(v => Array.isArray(v) && v[0] === 'remove'), false);
});

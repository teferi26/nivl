// Chat 3 · fotos de progreso (bucket 'progress'): el borrado de cuenta y la retirada de salud
// vacían también ese bucket. Backend simulado: ni Supabase real ni Franky.
import { accountErasureHandler } from './account-erasure.ts';
import { healthErasureHandler } from './health-erasure.ts';
import type { Db } from './db.ts';

const UID = '00000000-0000-4000-8000-0000000000f1';
const OTHER = '00000000-0000-4000-8000-0000000000f2';
const JOB = '10000000-0000-4000-8000-0000000000f1';
const equal = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
};
type Obj = { bucket: string; path: string };

/** Storage compartido; `paths` simula health_erasure_paths (evidence en cadena, progress como objeto). */
function storage(initial: Obj[], opts: { stale?: boolean } = {}) {
  const s = { objects: [...initial], trace: [] as unknown[][] };
  const from = (bucket: string) => ({ remove: (paths: string[]) => {
    s.trace.push(['remove', bucket, paths]);
    if (!opts.stale) s.objects = s.objects.filter(o => o.bucket !== bucket || !paths.includes(o.path));
    return Promise.resolve({ error: null });
  } });
  const healthList = () => s.objects.filter(o => o.bucket === 'evidence' || o.bucket === 'progress')
    .map(o => o.bucket === 'evidence' ? o.path : { bucket: o.bucket, path: o.path });
  return { s, from, healthList };
}

function accountBackend(initial: Obj[]) {
  const st = storage(initial);
  let deleted = false;
  const admin = {
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: UID } }, error: null }),
      admin: { deleteUser: () => { st.s.trace.push(['deleteUser']); deleted = true; return Promise.resolve({ data: null, error: null }); } },
    },
    rpc: (name: string) => {
      st.s.trace.push([name]);
      if (name === 'request_store_erasure_cleanup') return Promise.resolve({ data: true, error: null });
      if (name === 'begin_account_erasure') return Promise.resolve({ data: { ok: true, job_id: JOB }, error: null });
      if (name === 'account_erasure_paths') return Promise.resolve({ data: st.s.objects.slice(0, 100), error: null });
      if (name === 'account_erasure_ready') return Promise.resolve({ data: st.s.objects.length === 0, error: null });
      throw new Error('Unexpected RPC');
    },
    storage: { from: st.from },
  } as unknown as Db;
  return { ...st, handler: accountErasureHandler(admin, { revenueCatKey: 'sk_testOnly123', fetcher: (() => Promise.resolve(new Response(null, { status: 200 }))) as typeof fetch }), deleted: () => deleted };
}

function healthBackend(list: () => unknown, st: ReturnType<typeof storage>) {
  const user = { rpc: (name: string) => {
    st.s.trace.push([name]);
    if (name === 'withdraw_health_consent') return Promise.resolve({ data: { ok: true, job_id: JOB }, error: null });
    return Promise.resolve({ data: list(), error: null });
  } } as unknown as Db;
  const admin = {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: UID } }, error: null }) },
    rpc: (name: string) => {
      st.s.trace.push([name]);
      // Como en SQL: complete_health_erasure exige 'evidence' y 'progress' vacíos.
      const left = st.s.objects.some(o => o.bucket === 'evidence' || o.bucket === 'progress');
      return Promise.resolve(left ? { data: null, error: { message: 'Quedan fotos por eliminar' } } : { data: { ok: true }, error: null });
    },
    storage: { from: st.from },
  } as unknown as Db;
  return healthErasureHandler(admin, () => user);
}

const accountRequest = () => new Request('https://local.invalid/account-erasure', {
  method: 'POST', headers: { authorization: 'Bearer test-only' }, body: JSON.stringify({ confirm: 'BORRAR_CUENTA_NIVL' }),
});
const healthRequest = () => new Request('https://local.invalid/health-erasure', {
  method: 'POST', headers: { authorization: 'Bearer test-only' }, body: JSON.stringify({ confirm: 'BORRAR_SALUD_DIARIO_FOTOS_COACH' }),
});

Deno.test('borrado de cuenta: vacía progress junto a evidence y avatars antes de borrar Auth', async () => {
  const b = accountBackend([
    { bucket: 'evidence', path: `${UID}/e.jpg` }, { bucket: 'avatars', path: `${UID}/a.jpg` },
    { bucket: 'progress', path: `${UID}/p1.jpg` }, { bucket: 'progress', path: `${UID}/p2.webp` },
  ]);
  equal((await b.handler(accountRequest())).status, 200);
  equal(b.s.trace.filter(t => t[0] === 'remove'), [
    ['remove', 'evidence', [`${UID}/e.jpg`]], ['remove', 'avatars', [`${UID}/a.jpg`]],
    ['remove', 'progress', [`${UID}/p1.jpg`, `${UID}/p2.webp`]],
  ]);
  equal(b.s.objects, []); equal(b.deleted(), true);
});

Deno.test('borrado de cuenta: mientras quede una foto de progreso, ready=false y Auth sigue viva', async () => {
  // Storage dice «ok» pero el objeto sigue (lista obsoleta): nunca se borra Auth.
  const stale = storage([{ bucket: 'progress', path: `${UID}/p1.jpg` }], { stale: true });
  const admin = {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: UID } }, error: null }),
      admin: { deleteUser: () => { throw new Error('no debe borrarse Auth'); } } },
    rpc: (name: string) => {
      if (name === 'request_store_erasure_cleanup') return Promise.resolve({ data: true, error: null });
      if (name === 'begin_account_erasure') return Promise.resolve({ data: { ok: true, job_id: JOB }, error: null });
      if (name === 'account_erasure_paths') return Promise.resolve({ data: stale.s.objects, error: null });
      if (name === 'account_erasure_ready') return Promise.resolve({ data: stale.s.objects.length === 0, error: null });
      throw new Error('Unexpected RPC');
    },
    storage: { from: stale.from },
  } as unknown as Db;
  const res = await accountErasureHandler(admin)(accountRequest());
  equal(res.status, 202);
  equal(stale.s.trace.every(t => t[1] === 'progress'), true);
});

Deno.test('borrado de cuenta: una foto de progreso de otra persona o con ruta hostil nunca llega a Storage', async () => {
  for (const objects of [[{ bucket: 'progress', path: `${OTHER}/p.jpg` }], [{ bucket: 'progress', path: `${UID}/../${OTHER}/p.jpg` }],
    [{ bucket: 'progress', path: `${UID}//p.jpg` }], [{ bucket: 'progreso', path: `${UID}/p.jpg` }]]) {
    const b = accountBackend(objects);
    equal((await b.handler(accountRequest())).status, 503);
    equal(b.s.trace.filter(t => t[0] === 'remove' || t[0] === 'deleteUser'), []);
  }
});

Deno.test('retirada de salud: formato mixto, borra evidence y progress de su bucket y completa una vez', async () => {
  const st = storage([
    { bucket: 'evidence', path: `${UID}/e.jpg` },
    { bucket: 'progress', path: `${UID}/p1.jpg` }, { bucket: 'progress', path: `${UID}/p2.webp` },
    { bucket: 'avatars', path: `${UID}/a.jpg` },
  ]);
  const res = await healthBackend(st.healthList, st)(healthRequest());
  equal(res.status, 200);
  equal(st.s.trace.filter(t => t[0] === 'remove'), [
    ['remove', 'evidence', [`${UID}/e.jpg`]], ['remove', 'progress', [`${UID}/p1.jpg`, `${UID}/p2.webp`]],
  ]);
  equal(st.s.trace.filter(t => t[0] === 'complete_health_erasure').length, 1);
  // El retrato no es dato de salud: se queda.
  equal(st.s.objects, [{ bucket: 'avatars', path: `${UID}/a.jpg` }]);
});

Deno.test('retirada de salud: solo fotos de progreso también se vacían antes de completar', async () => {
  const st = storage([{ bucket: 'progress', path: `${UID}/p1.jpg` }]);
  equal((await healthBackend(st.healthList, st)(healthRequest())).status, 200);
  equal(st.s.objects, []);
});

Deno.test('retirada de salud: si progress no se vacía, no se completa (202 pendiente)', async () => {
  const st = storage([{ bucket: 'progress', path: `${UID}/p1.jpg` }], { stale: true });
  const res = await healthBackend(st.healthList, st)(healthRequest());
  equal(res.status, 202); equal((await res.json()).pending, true);
  equal(st.s.trace.some(t => t[0] === 'complete_health_erasure'), false);
});

Deno.test('retirada de salud: objeto de otro bucket, de otra persona o con ruta hostil → 503 sin tocar Storage', async () => {
  for (const item of [{ bucket: 'avatars', path: `${UID}/a.jpg` }, { bucket: 'progress', path: `${OTHER}/p.jpg` },
    { bucket: 'progress', path: `${UID}/../p.jpg` }, { bucket: 'progress', path: `${UID}/a\u0000.jpg` },
    { bucket: 'progress' }, { path: `${UID}/p.jpg` }, null, 7]) {
    const st = storage([]);
    const res = await healthBackend(() => [`${UID}/e.jpg`, item], st)(healthRequest());
    equal(res.status, 503); equal((await res.json()).pending, true);
    equal(st.s.trace.filter(t => t[0] === 'remove' || t[0] === 'complete_health_erasure'), []);
  }
});

Deno.test('retirada de salud: rutas legítimas con letras u y dígitos 0 se aceptan (regresión de la clase de caracteres)', async () => {
  const st = storage([{ bucket: 'evidence', path: `${UID}/u0u0.jpg` }, { bucket: 'progress', path: `${UID}/u000.webp` }]);
  equal((await healthBackend(st.healthList, st)(healthRequest())).status, 200);
});

// Chat 3 · (b) privacidad y borrado: fallos parciales, reintentos y concurrencia
// del borrado de cuenta. Backend simulado: ni Supabase real ni Franky.
import { accountErasureHandler, type ErasureOptions } from './account-erasure.ts';
import type { Db } from './db.ts';

const UID = '00000000-0000-4000-8000-0000000000a1';
const JOB = '10000000-0000-4000-8000-0000000000a1';
const equal = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
};
const request = (body: unknown = { confirm: 'BORRAR_CUENTA_NIVL' }) =>
  new Request('https://local.invalid/account-erasure', { method: 'POST', headers: { authorization: 'Bearer test-only' }, body: JSON.stringify(body) });

type AuthErr = { code?: string; status?: number } | null;

/** Un "servidor" con Auth, la BD de trabajos y Storage compartidos entre llamadas. */
function backend(opts: ErasureOptions = {}) {
  const trace: unknown[][] = [];
  const s = {
    userExists: true,
    getUserError: null as AuthErr,
    deleteError: null as AuthErr,
    listFailsAfterRemovals: -1,
    removeFailOnce: '' as string,
    objects: [
      { bucket: 'evidence', path: `${UID}/a.jpg` },
      { bucket: 'evidence', path: `${UID}/b/c.jpg` },
      { bucket: 'avatars', path: `${UID}/avatar.jpg` },
    ],
    removals: 0,
    beforeDelete: undefined as undefined | (() => void),
  };
  const admin = {
    auth: {
      getUser: (token: string) => {
        trace.push(['getUser', token]);
        if (s.getUserError) return Promise.resolve({ data: { user: null }, error: s.getUserError });
        if (!s.userExists) return Promise.resolve({ data: { user: null }, error: { code: 'user_not_found', status: 403 } });
        return Promise.resolve({ data: { user: { id: UID } }, error: null });
      },
      admin: {
        deleteUser: (uid: string, soft: boolean) => {
          trace.push(['deleteUser', uid, soft]);
          s.beforeDelete?.();
          if (s.deleteError) return Promise.resolve({ data: null, error: s.deleteError });
          if (!s.userExists) return Promise.resolve({ data: null, error: { code: 'user_not_found', status: 404 } });
          s.userExists = false;
          return Promise.resolve({ data: null, error: null });
        },
      },
    },
    rpc: (name: string, args: unknown) => {
      trace.push([name, args]);
      if (name === 'begin_account_erasure') return Promise.resolve({ data: { ok: true, job_id: JOB }, error: null });
      if (name === 'account_erasure_paths') {
        if (s.listFailsAfterRemovals >= 0 && s.removals > s.listFailsAfterRemovals) return Promise.resolve({ data: null, error: {} });
        return Promise.resolve({ data: s.objects.slice(0, 2), error: null });
      }
      if (name === 'account_erasure_ready') return Promise.resolve({ data: s.objects.length === 0, error: null });
      throw new Error('Unexpected RPC');
    },
    storage: {
      from: (bucket: string) => ({
        remove: (paths: string[]) => {
          trace.push(['remove', bucket, paths]);
          if (s.removeFailOnce === bucket) { s.removeFailOnce = ''; return Promise.resolve({ error: {} }); }
          s.removals++;
          s.objects = s.objects.filter(o => o.bucket !== bucket || !paths.includes(o.path));
          return Promise.resolve({ error: null });
        },
      }),
    },
  } as unknown as Db;
  return { s, trace, handler: accountErasureHandler(admin, opts), deletes: () => trace.filter(t => t[0] === 'deleteUser') };
}

Deno.test('respuesta perdida: el reintento con el mismo token confirma el borrado sin repetir ninguna operación', async () => {
  const b = backend();
  equal((await b.handler(request())).status, 200); // la app no llegó a recibir este 200
  const before = b.trace.length;
  const retry = await b.handler(request());
  equal(retry.status, 200); equal(await retry.json(), { ok: true });
  equal(b.trace.slice(before), [['getUser', 'test-only']]);
  equal(b.deletes().length, 1);
});

Deno.test('sesión caducada o revocada NO cuenta como cuenta borrada', async () => {
  for (const error of [{ code: 'session_not_found', status: 403 }, { code: 'bad_jwt', status: 403 }, { status: 401 }]) {
    const b = backend(); b.s.getUserError = error;
    equal((await b.handler(request())).status, 401);
    equal(b.trace.filter(t => t[0] !== 'getUser'), []);
  }
});

Deno.test('dos borrados concurrentes: el segundo deleteUser ve user_not_found y también responde éxito', async () => {
  const b = backend();
  // Otra petición borra Auth justo antes de que esta llegue a deleteUser.
  b.s.beforeDelete = () => { b.s.userExists = false; b.s.beforeDelete = undefined; };
  const r = await b.handler(request());
  equal(r.status, 200);
  equal(b.s.objects, []);
});

Deno.test('un error de Auth distinto de user_not_found al borrar deja la cuenta pendiente (nunca éxito falso)', async () => {
  for (const error of [{ status: 500 }, { code: 'unexpected_failure', status: 500 }, {}]) {
    const b = backend(); b.s.deleteError = error;
    const r = await b.handler(request());
    equal(r.status, 503); equal((await r.json()).pending, true);
    equal(b.s.userExists, true);
  }
});

Deno.test('Storage borra un lote y la BD falla al releer: Auth sigue viva; el reintento termina con el mismo trabajo', async () => {
  const b = backend(); b.s.listFailsAfterRemovals = 0;
  const first = await b.handler(request());
  equal(first.status, 503);
  equal(b.deletes(), []); equal(b.s.userExists, true);
  equal(b.s.objects.length < 3, true); // parte de los bytes ya no están
  b.s.listFailsAfterRemovals = -1;
  equal((await b.handler(request())).status, 200);
  equal(b.s.objects, []); equal(b.s.userExists, false);
  const jobs = b.trace.filter(t => t[0] === 'account_erasure_paths').map(t => (t[1] as { p_job: string }).p_job);
  equal(new Set(jobs).size, 1);
});

Deno.test('fallo de Storage en mitad de varios lotes: nada de Auth hasta que la BD confirma cero objetos', async () => {
  const b = backend(); b.s.removeFailOnce = 'avatars';
  // Lote 1 (evidence) sale bien; en el lote 2 falla avatars: pendiente, Auth intacta.
  equal((await b.handler(request())).status, 503); equal(b.deletes(), []); equal(b.s.userExists, true);
  equal(b.s.objects, [{ bucket: 'avatars', path: `${UID}/avatar.jpg` }]);
  const b2 = backend(); b2.s.objects = [{ bucket: 'avatars', path: `${UID}/avatar.jpg` }]; b2.s.removeFailOnce = 'avatars';
  equal((await b2.handler(request())).status, 503); equal(b2.deletes(), []);
  equal((await b2.handler(request())).status, 200); equal(b2.deletes().length, 1);
});

Deno.test('sin confirmación exacta no hay ninguna mutación aunque la cuenta exista', async () => {
  for (const body of [{}, { confirm: 'borrar_cuenta_nivl' }, { confirm: 'BORRAR_CUENTA_FRANKY' }, 'BORRAR_CUENTA_NIVL']) {
    const b = backend();
    equal((await b.handler(request(body))).status, 400);
    equal(b.trace.filter(t => t[0] !== 'getUser'), []);
  }
});

// ── RevenueCat (PRIV-1): DELETE /v1/subscribers/{uuid} justo antes de Auth ──
function rcFetch(statuses: (number | 'throw' | 'hang')[], log: unknown[][]) {
  return ((url: string | URL | Request, init?: RequestInit) => {
    const status = statuses.length > 1 ? statuses.shift()! : statuses[0];
    log.push(['rc', String(url), init?.method, (init?.headers as Record<string, string>)?.Authorization]);
    if (status === 'throw') return Promise.reject(new Error('network'));
    if (status === 'hang') return new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
    return Promise.resolve(new Response('{}', { status }));
  }) as typeof fetch;
}

Deno.test('RevenueCat 200: DELETE con clave secreta, después de vaciar Storage y JUSTO antes de borrar Auth', async () => {
  const log: unknown[][] = [];
  const b = backend({ revenueCatKey: 'sk_test_only', fetcher: rcFetch([200], log) });
  // Al llegar a deleteUser, RevenueCat ya se ha llamado exactamente una vez.
  const merged = b.trace;
  b.s.beforeDelete = () => { merged.push(['(rc antes)', log.length]); };
  equal((await b.handler(request())).status, 200);
  equal(log, [['rc', `https://api.revenuecat.com/v1/subscribers/${UID}`, 'DELETE', 'Bearer sk_test_only']]);
  const names = merged.map(t => t[0]);
  equal(names.indexOf('account_erasure_ready') < names.indexOf('deleteUser'), true);
  equal(merged.find(t => t[0] === '(rc antes)'), ['(rc antes)', 1]);
  equal(b.s.userExists, false);
});

Deno.test('RevenueCat 404 cuenta como hecho', async () => {
  const log: unknown[][] = [];
  const b = backend({ revenueCatKey: 'sk_test_only', fetcher: rcFetch([404], log) });
  equal((await b.handler(request())).status, 200); equal(b.deletes().length, 1);
});

Deno.test('RevenueCat 500 o 401: 503 pendiente, Auth intacta; el reintento lo repite y termina', async () => {
  for (const fail of [500, 401, 429, 'throw'] as const) {
    const log: unknown[][] = [];
    const b = backend({ revenueCatKey: 'sk_test_only', fetcher: rcFetch([fail, 200], log) });
    const first = await b.handler(request());
    equal(first.status, 503); equal((await first.json()).pending, true);
    equal(b.deletes(), []); equal(b.s.userExists, true);
    equal((await b.handler(request())).status, 200);
    equal(log.length, 2); equal(b.deletes().length, 1);
  }
});

Deno.test('RevenueCat que no responde: se corta por timeout y queda pendiente', async () => {
  const log: unknown[][] = [];
  const b = backend({ revenueCatKey: 'sk_test_only', fetcher: rcFetch(['hang'], log), timeoutMs: 20 });
  const started = Date.now();
  equal((await b.handler(request())).status, 503);
  equal(Date.now() - started < 5000, true); equal(b.deletes(), []);
});

Deno.test('sin clave (o con la pública del SDK): no bloquea, avisa sin datos personales y no llama a RevenueCat', async () => {
  for (const revenueCatKey of [undefined, '', '   ', 'appl_public_sdk_key', 'goog_public_sdk_key']) {
    const log: unknown[][] = [];
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(' ')); };
    try {
      const b = backend({ revenueCatKey, fetcher: rcFetch([500], log) });
      equal((await b.handler(request())).status, 200);
      equal(log, []); equal(b.deletes().length, 1);
      equal(warnings.length, 1); equal(warnings[0].includes(UID), false);
    } finally {
      console.warn = original;
    }
  }
});

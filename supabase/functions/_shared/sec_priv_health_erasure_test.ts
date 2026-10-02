// Chat 3 · (b) Borrado de salud: rutas hostiles, excepciones y reintentos.
import { healthErasureHandler } from './health-erasure.ts';
import type { Db } from './db.ts';

const UID = '00000000-0000-4000-8000-0000000000b1';
const equal = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
};
const request = () => new Request('https://local.invalid/health-erasure', {
  method: 'POST', headers: { authorization: 'Bearer test-only' }, body: JSON.stringify({ confirm: 'BORRAR_SALUD_DIARIO_FOTOS_COACH' }),
});

function fixture(paths: unknown, opts: { throwOn?: string } = {}) {
  const trace: string[] = [];
  let current = paths;
  const maybeThrow = (name: string) => { if (opts.throwOn === name) throw new Error('private provider details'); };
  const user = { rpc: (name: string) => {
    trace.push(name); maybeThrow(name);
    if (name === 'withdraw_health_consent') return Promise.resolve({ data: { ok: true, job_id: 'job' }, error: null });
    return Promise.resolve({ data: current, error: null });
  } } as unknown as Db;
  const admin = {
    auth: { getUser: () => { maybeThrow('getUser'); return Promise.resolve({ data: { user: { id: UID } }, error: null }); } },
    rpc: (name: string) => { trace.push(name); maybeThrow(name); return Promise.resolve({ data: { ok: true }, error: null }); },
    storage: { from: () => ({ remove: () => { trace.push('remove'); maybeThrow('remove'); current = []; return Promise.resolve({ error: null }); } }) },
  } as unknown as Db;
  return { trace, handler: healthErasureHandler(admin, () => user) };
}

Deno.test('rutas con segmentos vacíos, punto, punto-punto final, barra invertida o NUL nunca llegan a Storage', async () => {
  for (const bad of [`${UID}/x/..`, `${UID}/./x.jpg`, `${UID}//x.jpg`, `${UID}/a\\b.jpg`, `${UID}/a\u0000.jpg`, `${UID}/`, [`${UID}/ok.jpg`, 7]]) {
    const f = fixture(Array.isArray(bad) ? bad : [bad]);
    const res = await f.handler(request());
    equal(res.status, 503); equal((await res.json()).pending, true);
    equal(f.trace.includes('remove'), false); equal(f.trace.includes('complete_health_erasure'), false);
  }
});

Deno.test('más de 100 rutas en un lote se rechaza (el servidor nunca debería devolverlas)', async () => {
  const f = fixture(Array.from({ length: 101 }, (_, i) => `${UID}/${i}.jpg`));
  equal((await f.handler(request())).status, 503); equal(f.trace.includes('remove'), false);
});

Deno.test('una excepción del proveedor tras retirar el permiso devuelve pendiente, sin 500 ni detalles', async () => {
  for (const throwOn of ['health_erasure_paths', 'remove', 'complete_health_erasure']) {
    const f = fixture([`${UID}/a.jpg`], { throwOn });
    const res = await f.handler(request());
    equal(res.status, 503);
    const text = await res.text();
    equal(text.includes('private provider details'), false); equal(JSON.parse(text).pending, true);
  }
});

Deno.test('una excepción antes de registrar la retirada no dice que el permiso esté retirado', async () => {
  for (const throwOn of ['getUser', 'withdraw_health_consent']) {
    const f = fixture([], { throwOn });
    const res = await f.handler(request());
    equal(res.status, 503);
    const body = await res.json();
    equal(body.pending, undefined); equal(String(body.error).includes('retirado'), false);
  }
});

Deno.test('reintento tras fallo: termina y completa una sola vez', async () => {
  const f = fixture([`${UID}/a.jpg`], { throwOn: 'remove' });
  equal((await f.handler(request())).status, 503);
  const g = fixture([`${UID}/a.jpg`]);
  equal((await g.handler(request())).status, 200);
  equal(g.trace.filter(t => t === 'complete_health_erasure').length, 1);
});

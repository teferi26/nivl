import { deepEqual, equal, rejects } from 'node:assert/strict';
import { clasificarPendientes, ClasificacionConsentimientoError } from './clasificar.ts';
import { consentimientoIa } from './consent.ts';
import type { Db } from './db.ts';

const USER_ID = '00000000-0000-4000-8000-000000000029';

function fixture(answer: () => { data: unknown; error: { message: string } | null }, onRead = () => {}) {
  const trace: string[] = [];
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: async () => {
      trace.push('read');
      onRead();
      return { data: [{ id: 'fake-transaction', date: '2026-09-27', amount: -10, description: 'Compra de prueba', counterparty: null }], error: null };
    },
    update: () => { trace.push('write'); return query; },
    then: (resolve: (value: { error: null }) => unknown) => Promise.resolve({ error: null }).then(resolve),
  };
  const sb = { from: (table: string) => { equal(table, 'transactions'); return query; } } as unknown as Db;
  const admin = {
    rpc: async (name: string, args: unknown) => {
      trace.push('consent');
      equal(name, 'ai_consent_ok');
      deepEqual(args, { p_user: USER_ID });
      return answer();
    },
  } as unknown as Db;
  return { sb, admin, trace };
}

async function withProviderStub(trace: string[], run: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    trace.push('provider');
    const event = { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '1|super' } };
    return new Response(`data: ${JSON.stringify(event)}\n\n`, { headers: { 'content-type': 'text/event-stream' } });
  };
  try { await run(); } finally { globalThis.fetch = original; }
}

Deno.test('clasificación: solo un consentimiento positivo permite enviar tras leer movimientos', async () => {
  const f = fixture(() => ({ data: true, error: null }));
  await withProviderStub(f.trace, async () => {
    const result = await clasificarPendientes(f.sb, f.admin, USER_ID);
    equal(result.clasificados, 1);
    deepEqual(f.trace, ['read', 'consent', 'provider', 'write']);
  });
});

for (const scenario of [
  { name: 'retirado', answer: { data: false, error: null }, status: 403 },
  { name: 'sin respuesta positiva', answer: { data: null, error: null }, status: 403 },
  { name: 'fallo RPC', answer: { data: null, error: { message: 'stub RPC failure' } }, status: 503 },
]) {
  Deno.test(`clasificación: ${scenario.name} impide enviar y escribir`, async () => {
    const f = fixture(() => scenario.answer);
    await withProviderStub(f.trace, async () => {
      await rejects(() => clasificarPendientes(f.sb, f.admin, USER_ID), (error: unknown) =>
        error instanceof ClasificacionConsentimientoError && error.status === scenario.status);
      deepEqual(f.trace, ['read', 'consent']);
    });
  });
}

Deno.test('clasificación: una retirada durante la lectura invalida el permiso inicial', async () => {
  let granted = true;
  const f = fixture(() => ({ data: granted, error: null }), () => { granted = false; });
  equal(await consentimientoIa(f.admin, USER_ID), true);
  await withProviderStub(f.trace, async () => {
    await rejects(() => clasificarPendientes(f.sb, f.admin, USER_ID), ClasificacionConsentimientoError);
    deepEqual(f.trace, ['consent', 'read', 'consent']);
  });
});

Deno.test('clasificación: una excepción de red tampoco autoriza la llamada', async () => {
  const f = fixture(() => { throw new Error('stub network failure'); });
  await withProviderStub(f.trace, async () => {
    await rejects(() => clasificarPendientes(f.sb, f.admin, USER_ID), /stub network failure/);
    deepEqual(f.trace, ['read', 'consent']);
  });
});

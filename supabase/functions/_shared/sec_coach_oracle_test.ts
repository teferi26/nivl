// Chat 3 · c — El Oráculo y el candado de gasto.
//
// El Oráculo leía el cupo (oracle_usage) y lo escribía DESPUÉS de llamar al
// modelo, con `count = leído + 1`. N peticiones a la vez leen todas el mismo
// número, pasan todas, llaman todas al proveedor y el contador sube 1. Ráfaga a
// ráfaga, el cupo de 100 no frena nada, y su gasto no constaba en coach_runs
// (el candado 0020 ni lo veía). Basta la prueba gratuita (start_trial) para
// tener `trialing` y entrar.

import { equal, ok } from 'node:assert/strict';
import { instalar, peticion, sse, USER_ID } from './sec_coach_fake_test.ts';

const { handler } = await import('../oracle/handler.ts');

function respuestaOraculo(): Response {
  return new Response(
    JSON.stringify({
      content: [{ type: 'text', text: JSON.stringify({ quests: [], plan_summary: 'ok' }) }],
      usage: { input_tokens: 1_000, output_tokens: 2_500 },
      model: 'claude-haiku-4-5',
    }),
    { headers: { 'content-type': 'application/json' } },
  );
}

/** Imita el cerrojo real de ai_begin_turn (insert … on conflict … where viejo). */
function cerrojo() {
  let ocupado = false;
  return {
    ai_begin_turn: () => {
      if (ocupado) return { allowed: false, reason: 'turno_en_curso', remaining: 400_000 };
      ocupado = true;
      return { allowed: true, mode: 'estandar', turn_budget: 400_000, remaining: 400_000, routes: {} };
    },
    ai_end_turn: () => {
      ocupado = false;
      return null;
    },
  };
}

Deno.test('oráculo: una ráfaga concurrente no puede saltarse el cupo ni el candado', async () => {
  const fake = instalar({
    rpc: cerrojo(),
    filas: {
      subscriptions: [{ status: 'trialing', current_period_end: new Date(Date.now() + 86_400_000).toISOString() }],
      // Le queda UNA consulta del mes.
      oracle_usage: [{ count: 99 }],
    },
    proveedor: async () => {
      // El proveedor tarda: es la ventana en la que entran las demás.
      await new Promise((r) => setTimeout(r, 30));
      return respuestaOraculo();
    },
  });
  try {
    const N = 8;
    const res = await Promise.all(
      Array.from({ length: N }, () => handler(peticion({ kind: 'generate', goal: 'correr 10 km' }))),
    );
    await Promise.all(res.map((r) => r.text()));
    equal(fake.proveedor.length, 1, `llamadas al proveedor con 1 consulta restante: ${fake.proveedor.length}`);
    ok(res.filter((r) => r.status === 200).length === 1);
  } finally {
    fake.restaurar();
  }
});

Deno.test('oráculo: lo que cuesta queda en coach_runs (el candado lo ve)', async () => {
  const fake = instalar({
    rpc: cerrojo(),
    filas: {
      subscriptions: [{ status: 'active', current_period_end: null }],
      oracle_usage: [{ count: 3 }],
    },
    proveedor: () => respuestaOraculo(),
  });
  try {
    const r = await handler(peticion({ kind: 'generate', goal: 'leer 20 páginas' }));
    equal(r.status, 200, await r.text());
    const filas = fake.escrituras('coach_runs').map((l) => l.body as Record<string, unknown>);
    equal(filas.length, 1);
    equal(filas[0].user_id, USER_ID);
    equal(filas[0].kind, 'oracle');
    // 1.000 × 1 $ + 2.500 × 5 $ (Haiku) = 13.500 µ$.
    equal(filas[0].cost_micro_usd, 13_500);
    ok(fake.llamadas.some((l) => l.url.pathname === '/rest/v1/rpc/ai_end_turn'), 'el cerrojo se suelta');
  } finally {
    fake.restaurar();
  }
});

Deno.test('oráculo: sin plan con IA (ai_begin_turn lo niega) no se llama al proveedor', async () => {
  const fake = instalar({
    rpc: { ai_begin_turn: () => ({ allowed: false, reason: 'sin_suscripcion' }) },
    filas: { subscriptions: [{ status: 'active', current_period_end: null }] },
    proveedor: () => respuestaOraculo(),
  });
  try {
    const r = await handler(peticion({ kind: 'generate', goal: 'x' }));
    await r.text();
    equal(r.status, 402);
    equal(fake.proveedor.length, 0);
  } finally {
    fake.restaurar();
  }
});

Deno.test('oráculo: un error del proveedor no enseña su cuerpo ni la cuenta del dueño', async () => {
  const fake = instalar({
    rpc: cerrojo(),
    filas: { subscriptions: [{ status: 'active', current_period_end: null }], oracle_usage: [] },
    proveedor: () =>
      new Response('{"error":{"message":"Your credit balance is too low to access the Anthropic API"}}', { status: 400 }),
  });
  try {
    const r = await handler(peticion({ kind: 'weekly', weeklyInput: { a: 1 } }));
    const t = await r.text();
    equal(r.status, 502);
    ok(!/credit|anthropic|balance/i.test(t), t);
  } finally {
    fake.restaurar();
  }
});

// sse se reexporta para que el arnés no quede sin usar si se borra un test.
void sse;

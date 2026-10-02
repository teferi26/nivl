// IA v2 · L0 «Telemetría de coste».
//
//   · El turno apunta en coach_runs ruta, intención, herramientas ofrecidas y
//     llamadas, vueltas y tamaño del estado (columnas de la 0047).
//   · Si la 0047 aún no está aplicada (columna inexistente: 42703 o PGRST204),
//     la fila se repite SIN esas columnas: el gasto, que es lo que lee el
//     candado, se apunta siempre. Otros errores no se reintentan.
//   · La contabilidad: escrituras de caché de 1 h a 2× y el `usage` de
//     `message_delta` tratado como acumulado (antes se sumaba al de inicio).

import { deepEqual, equal, ok } from 'node:assert/strict';
import { instalar, peticion, sse, turnoHerramienta, turnoTexto, type Llamada } from './sec_coach_fake_test.ts';
import { callClaude, costMicroUsd, usoDeStream } from './anthropic.ts';
import { columnasTelemetria, COLUMNAS_TELEMETRIA, esColumnaInexistente, insertarRun } from './telemetria.ts';
import { TOOL_DEFS } from './tools.ts';

const { handler } = await import('../coach/handler.ts');

const filasRuns = (fake: { escrituras: (t: string) => Llamada[] }) =>
  fake.escrituras('coach_runs').map((l) => l.body as Record<string, unknown>);

Deno.test('telemetría: el turno del coach apunta ruta, intención, herramientas, vueltas y estado', async () => {
  const fake = instalar({
    proveedor: (_b, n) =>
      n === 0
        ? turnoHerramienta('consultar_historial', { que: 'peso', desde: '2026-01-01', hasta: '2026-01-02', filtro: '' })
        : turnoTexto('Hecho.'),
  });
  try {
    // Afirmación con pregunta: va por la ruta completa (la estrecha, L3, tiene su test).
    await (await handler(peticion({ kind: 'chat', message: 'te he subido el gym, ¿lo ves?', stream: false }))).text();
    const filas = filasRuns(fake);
    equal(filas.length, 1);
    const f = filas[0];
    equal(f.route, 'completa');
    equal(f.intent, 'afirmacion');
    equal(f.tools_offered, TOOL_DEFS.length);
    equal(f.tool_calls, 1);
    equal(f.iterations, 2);
    ok(Number(f.state_chars) > 0, 'tamaño del estado');
    ok(Number(f.cost_micro_usd) > 0);
    // Ni textos del usuario ni del modelo en la telemetría.
    ok(!JSON.stringify(f).includes('gym'));
  } finally {
    fake.restaurar();
  }
});

Deno.test('telemetría: un ritual no lleva intención; un chat normal es "general"', async () => {
  const fake = instalar();
  try {
    await (await handler(peticion({ kind: 'chat', message: '¿qué toca hoy?', stream: false }))).text();
    await (await handler(peticion({ kind: 'brief', stream: false }))).text();
    const [chat, brief] = filasRuns(fake);
    equal(chat.intent, 'general');
    equal(brief.intent, null);
    equal(brief.route, 'completa');
    equal(brief.iterations, 1);
    equal(brief.tool_calls, 0);
  } finally {
    fake.restaurar();
  }
});

Deno.test('telemetría: sin la 0047 (PGRST204) la fila se repite sin columnas nuevas y el gasto consta', async () => {
  const fake = instalar({
    otras: (c) => {
      if (c.url.pathname !== '/rest/v1/coach_runs' || c.method !== 'POST') return undefined;
      const fila = c.body as Record<string, unknown>;
      if ('route' in fila) {
        return new Response(
          JSON.stringify({ code: 'PGRST204', message: "Could not find the 'intent' column of 'coach_runs' in the schema cache" }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(null, { status: 201 });
    },
  });
  try {
    await (await handler(peticion({ kind: 'chat', message: 'hola', stream: false }))).text();
    const intentos = filasRuns(fake);
    equal(intentos.length, 2, 'primero con telemetría, luego sin ella');
    ok('route' in intentos[0]);
    for (const k of COLUMNAS_TELEMETRIA) ok(!(k in intentos[1]), `sin ${k} en el reintento`);
    ok(Number(intentos[1].cost_micro_usd) >= 220_000, 'el gasto se apunta igual');
    equal(intentos[1].kind, 'chat');
  } finally {
    fake.restaurar();
  }
});

Deno.test('telemetría: otro error (p. ej. CHECK de kind) no se reintenta sin columnas', async () => {
  const llamadas: Record<string, unknown>[] = [];
  const db = {
    from: (_t: string) => ({
      insert: (fila: Record<string, unknown>) => {
        llamadas.push(fila);
        return Promise.resolve({ error: { code: '23514', message: 'violates check constraint "coach_runs_kind_check"' } });
      },
    }),
  };
  const r = await insertarRun(db, { kind: 'titular', cost_micro_usd: 5 }, { route: 'mecanica', iterations: 1 });
  equal(llamadas.length, 1);
  equal(r.error.code, '23514');
});

Deno.test('telemetría: 42703 también cuenta como columna inexistente; saneado de valores', async () => {
  ok(esColumnaInexistente({ code: '42703', message: 'column "route" of relation "coach_runs" does not exist' }));
  ok(esColumnaInexistente({ code: 'PGRST204' }));
  ok(!esColumnaInexistente({ code: '23514' }));
  ok(!esColumnaInexistente(null));
  deepEqual(columnasTelemetria({ route: '  completa ', intent: 'x'.repeat(100), tools_offered: 99_999, tool_calls: -3, iterations: 2.6, state_chars: Number.NaN }), {
    route: 'completa',
    intent: 'x'.repeat(40),
    tools_offered: 32_767,
    tool_calls: 0,
    iterations: 3,
    state_chars: null,
  });
  const llamadas: Record<string, unknown>[] = [];
  const db = {
    from: (_t: string) => ({
      insert: (fila: Record<string, unknown>) => {
        llamadas.push(fila);
        return Promise.resolve({ error: llamadas.length === 1 ? { code: '42703', message: 'column "route" does not exist' } : null });
      },
    }),
  };
  const r = await insertarRun(db, { kind: 'titular' }, { route: 'mecanica' });
  equal(r.error, null);
  equal(llamadas.length, 2);
  deepEqual(llamadas[1], { kind: 'titular' });
});

// ── Contabilidad ───────────────────────────────────────────────────────

Deno.test('coste: la escritura de 1 h se cobra a 2× y la de 5 min a 1,25×', () => {
  // Sonnet 5: 2 $/M de entrada.
  equal(costMicroUsd('claude-sonnet-5', { cache_creation_input_tokens: 1_000_000 }), 2_500_000);
  equal(
    costMicroUsd('claude-sonnet-5', {
      cache_creation_input_tokens: 1_000_000,
      cache_creation: { ephemeral_5m_input_tokens: 600_000, ephemeral_1h_input_tokens: 400_000 },
    }),
    600_000 * 2.5 + 400_000 * 4,
  );
  // Un desglose incoherente (1 h > total) no infla el total.
  equal(
    costMicroUsd('claude-sonnet-5', { cache_creation_input_tokens: 100, cache_creation: { ephemeral_1h_input_tokens: 999 } }),
    400,
  );
});

Deno.test('coste: el usage de message_delta es ACUMULADO y no se suma al de message_start', async () => {
  const inicio = { input_tokens: 2_000, cache_read_input_tokens: 15_000, cache_creation_input_tokens: 30_000, output_tokens: 3 };
  deepEqual(usoDeStream(inicio, { output_tokens: 500 }), { ...inicio, output_tokens: 500 });
  deepEqual(usoDeStream(inicio, { ...inicio, output_tokens: 500 }), { ...inicio, output_tokens: 500 });

  const fake = instalar({
    proveedor: () =>
      sse([
        { type: 'message_start', message: { model: 'claude-sonnet-5', usage: { ...inicio, cache_creation: { ephemeral_5m_input_tokens: 30_000, ephemeral_1h_input_tokens: 0 } } } },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'hola' } },
        { type: 'content_block_stop', index: 0 },
        // La API puede repetir aquí entrada y caché (acumulados).
        { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { ...inicio, output_tokens: 500 } },
      ]),
  });
  try {
    const t = await callClaude({ system: [{ type: 'text', text: 's' }], messages: [{ role: 'user', content: 'x' }] });
    equal(t.usage.input_tokens, 2_000);
    equal(t.usage.cache_read_input_tokens, 15_000);
    equal(t.usage.cache_creation_input_tokens, 30_000);
    equal(t.usage.output_tokens, 500);
    equal(costMicroUsd(t.model, t.usage), 2_000 * 2 + 15_000 * 0.2 + 30_000 * 2.5 + 500 * 10);
  } finally {
    fake.restaurar();
  }
});

Deno.test('coste: con tool_choice y herramientas la petición a Anthropic los envía juntos; sin herramientas, ninguno', async () => {
  const fake = instalar();
  try {
    await callClaude({ system: [{ type: 'text', text: 's' }], messages: [{ role: 'user', content: 'x' }], tools: TOOL_DEFS, toolChoice: { type: 'none' } });
    await callClaude({ system: [{ type: 'text', text: 's' }], messages: [{ role: 'user', content: 'x' }], toolChoice: { type: 'none' } });
    const [con, sin] = fake.proveedor.map((c) => c.body as Record<string, unknown>);
    deepEqual(con.tool_choice, { type: 'none' });
    equal((con.tools as unknown[]).length, TOOL_DEFS.length);
    ok(!('tool_choice' in sin) && !('tools' in sin));
  } finally {
    fake.restaurar();
  }
});

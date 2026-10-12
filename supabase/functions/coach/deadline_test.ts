import { equal, ok } from 'node:assert/strict';
import { instalar, peticion, turnoHerramienta, turnoTexto } from '../_shared/sec_coach_fake_test.ts';
const { handler } = await import('./handler.ts');

Deno.test('weekly final synthesis lowers effort only after time budget, keeping normal weekly depth', async () => {
  const originalNow = Date.now;
  let offset = 0;
  Date.now = () => originalNow() + offset;
  const fake = instalar({ proveedor: (_body, n) => {
    if (n === 0) {
      offset = 101_000;
      return turnoHerramienta('consultar_historial', { que: 'peso', desde: '2026-01-01', hasta: '2026-01-02', filtro: '' });
    }
    return turnoTexto('Esta es la revisión completa.');
  } });
  try {
    const response = await handler(peticion({ kind: 'revision_semanal', message: 'Revisa mi semana', stream: false }));
    equal(response.status, 200);
    equal((await response.json()).text, 'Esta es la revisión completa.');
    equal(fake.proveedor.length, 2);
    const first = fake.proveedor[0].body as any;
    const last = fake.proveedor[1].body as any;
    equal(first.output_config.effort, 'xhigh');
    equal(first.max_tokens, 16000);
    equal(last.output_config.effort, 'low');
    equal(last.max_tokens, 8000);
    equal(last.tool_choice.type, 'none');
  } finally { Date.now = originalNow; fake.restaurar(); }
});

for (const stream of [false, true]) {
  Deno.test(`provider timeout after partial text records expense but never publishes/persists incomplete response (stream=${stream})`, async () => {
    const originalTimeout = AbortSignal.timeout;
    let timer: ReturnType<typeof setTimeout> | undefined;
    AbortSignal.timeout = () => {
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(new DOMException('Turn timed out', 'TimeoutError')), 20);
      return controller.signal;
    };
    const events = [
      { type: 'message_start', message: { model: 'claude-sonnet-5', usage: { input_tokens: 100_000, output_tokens: 0 } } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'INCOMPLETE_PRIVATE_RESPONSE' } },
    ];
    const fake = instalar({ proveedor: () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('')));
        // Remains open until AbortSignal cancels the actual reader.
      },
    })) });
    try {
      const response = await handler(peticion({ kind: 'revision_semanal', message: 'Revisa mi semana', stream }));
      const body = await response.text();
      ok(!body.includes('INCOMPLETE_PRIVATE_RESPONSE'), body);
      if (stream) {
        ok(body.includes('event: error'), body);
        ok(!body.includes('event: done'), body);
      } else {
        equal(response.status, 502);
        ok(typeof JSON.parse(body).error === 'string');
      }
      const ledgers = fake.escrituras('coach_runs').map((c) => c.body as any);
      equal(ledgers.length, 1);
      ok(ledgers[0].cost_micro_usd > 200_000);
      ok(ledgers[0].out_tokens > 0);
      equal(ledgers[0].error, 'turn_failed');
      equal(fake.escrituras('coach_messages').filter((c) => (c.body as any).role === 'assistant').length, 0);
      ok(fake.llamadas.some((c) => c.url.pathname.endsWith('/rpc/ai_end_turn')));
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      AbortSignal.timeout = originalTimeout;
      fake.restaurar();
    }
  });
}

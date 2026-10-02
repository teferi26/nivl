// Chat 3 · c — El gasto de un turno que falla tiene que quedar en coach_runs.
//
// coach_runs es lo único que alimenta ai_state (lo gastado del mes). Si un
// turno que YA ha pagado al proveedor se apunta con coste 0, el candado de
// gasto (0020/0024) no lo ve, y repetirlo sale gratis tantas veces como se
// quiera. Antes del arreglo pasaba en dos caminos que el propio usuario puede
// provocar a voluntad: retirar el permiso de salud o el consentimiento de IA
// mientras el turno está en el aire.

import { equal, ok } from 'node:assert/strict';
import { instalar, peticion, turnoTexto } from './sec_coach_fake_test.ts';

const { handler } = await import('../coach/handler.ts');

function costeApuntado(fake: ReturnType<typeof instalar>): number {
  const filas = fake.escrituras('coach_runs').map((l) => l.body as Record<string, unknown>);
  equal(filas.length, 1, 'una fila de contabilidad por turno');
  return Number(filas[0].cost_micro_usd);
}

Deno.test('ledger: retirar el permiso de salud a mitad de turno no borra lo ya gastado', async () => {
  let llamadasProveedor = 0;
  const fake = instalar({
    rpc: {
      // Antes de la primera llamada al proveedor hay permiso; después, no.
      health_consent_ok: () => llamadasProveedor === 0,
    },
    proveedor: () => {
      llamadasProveedor++;
      return turnoTexto('hola', { input_tokens: 100_000, output_tokens: 2_000 });
    },
  });
  try {
    const res = await handler(peticion({ kind: 'chat', message: 'hola', stream: false }));
    await res.text();
    equal(llamadasProveedor, 1, 'el proveedor cobró una llamada');
    // 100k × 2 $ + 2k × 10 $ (Sonnet) = 220.000 µ$.
    ok(costeApuntado(fake) >= 220_000, `el coste real debe constar; apuntado: ${costeApuntado(fake)}`);
  } finally {
    fake.restaurar();
  }
});

Deno.test('ledger: retirar el consentimiento de IA tras la llamada no borra lo ya gastado', async () => {
  let llamadasProveedor = 0;
  const fake = instalar({
    rpc: { ai_consent_ok: () => llamadasProveedor === 0 },
    proveedor: () => {
      llamadasProveedor++;
      return turnoTexto('hola', { input_tokens: 100_000, output_tokens: 2_000 });
    },
  });
  try {
    const res = await handler(peticion({ kind: 'chat', message: 'hola', stream: false }));
    await res.text();
    equal(llamadasProveedor, 1);
    ok(costeApuntado(fake) >= 220_000, `el coste real debe constar; apuntado: ${costeApuntado(fake)}`);
  } finally {
    fake.restaurar();
  }
});

Deno.test('ledger: un fallo del proveedor en la segunda vuelta conserva el coste de la primera', async () => {
  const fake = instalar({
    proveedor: (_b, n) =>
      n === 0
        ? (() => {
            // Primera vuelta: pide una herramienta inofensiva.
            const ev = [
              { type: 'message_start', message: { model: 'claude-sonnet-5', usage: { input_tokens: 100_000, output_tokens: 0 } } },
              { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'tu1', name: 'consultar_historial', input: {} } },
              { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify({ que: 'peso', desde: '2026-01-01', hasta: '2026-01-02', filtro: '' }) } },
              { type: 'content_block_stop', index: 0 },
              { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 2_000 } },
            ];
            return new Response(ev.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''));
          })()
        : new Response('{"error":{"type":"overloaded_error"}}', { status: 529 }),
  });
  try {
    const res = await handler(peticion({ kind: 'chat', message: 'hola', stream: false }));
    await res.text();
    equal(fake.proveedor.length, 2);
    ok(costeApuntado(fake) >= 220_000, `el coste real debe constar; apuntado: ${costeApuntado(fake)}`);
  } finally {
    fake.restaurar();
  }
});

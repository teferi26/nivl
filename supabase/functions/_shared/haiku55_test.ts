// Migración a claude-haiku-5-5 como único modelo: los dos tramos de tarifa, la cota de la reserva, el
// techo de 100.000 fichas y el rechazo de los clasificadores (sin reserva en servidor).

import { deepEqual, equal, ok } from 'node:assert/strict';
import { instalar, peticion, sse, turnoHerramienta, turnoTexto } from './sec_coach_fake_test.ts';
import {
  COACH_MODEL,
  costeMaximo,
  costMicroUsd,
  fichasDelPrompt,
  historialEnTramo,
  tarifa,
  TECHO_PROMPT,
  type ApiMessage,
} from './anthropic.ts';
import { Gasto } from '../coach/guard.ts';

const { handler } = await import('../coach/handler.ts');
const esperar = () => new Promise((r) => setTimeout(r, 50));

function rechazo(categoria = 'general_harms'): Response {
  return sse([
    { type: 'message_start', message: { model: COACH_MODEL, usage: { input_tokens: 2_000, output_tokens: 0 } } },
    { type: 'message_delta', delta: { stop_reason: 'refusal', stop_details: { type: 'refusal', category: categoria } }, usage: { output_tokens: 1 } },
  ]);
}

Deno.test('tarifa: las cifras oficiales de cada tramo', () => {
  equal(COACH_MODEL, 'claude-haiku-5-5');
  deepEqual(tarifa(COACH_MODEL, 100_000), { in: 0.1, out: 0.5 });
  deepEqual(tarifa(COACH_MODEL, 100_001), { in: 0.5, out: 2.5 });
  deepEqual(tarifa('claude-haiku-5-5-20261101', 100_001), { in: 0.5, out: 2.5 });
});

Deno.test('coste, tramo barato: entrada, 5 min, 1 h, lectura y salida', () => {
  equal(costMicroUsd(COACH_MODEL, { input_tokens: 1_000 }), 100);
  equal(costMicroUsd(COACH_MODEL, { cache_creation_input_tokens: 1_000 }), 125);
  equal(costMicroUsd(COACH_MODEL, { cache_creation_input_tokens: 1_000, cache_creation: { ephemeral_1h_input_tokens: 1_000 } }), 200);
  equal(costMicroUsd(COACH_MODEL, { cache_read_input_tokens: 1_000 }), 10);
  equal(costMicroUsd(COACH_MODEL, { output_tokens: 1_000 }), 500);
  equal(costMicroUsd(COACH_MODEL, { input_tokens: 100_000, output_tokens: 1_000 }), 10_500);
});

Deno.test('coste, tramo caro: toda la petición a 5× y la caché cuenta para el umbral', () => {
  equal(costMicroUsd(COACH_MODEL, { input_tokens: 100_001, output_tokens: 1_000 }), 52_501);
  // Solo 1 ficha sin caché, pero 100.001 de prompt: tramo caro.
  equal(costMicroUsd(COACH_MODEL, { input_tokens: 1, cache_read_input_tokens: 100_000, output_tokens: 1_000 }), 7_501);
  equal(costMicroUsd(COACH_MODEL, { input_tokens: 1, cache_creation_input_tokens: 100_000 }), 62_501);
  equal(
    costMicroUsd(COACH_MODEL, { input_tokens: 1, cache_creation_input_tokens: 100_000, cache_creation: { ephemeral_1h_input_tokens: 100_000 } }),
    100_001,
  );
  equal(fichasDelPrompt({ input_tokens: 1, cache_read_input_tokens: 2, cache_creation_input_tokens: 3, output_tokens: 99 }), 6);
});

Deno.test('cota de la reserva: sigue siendo una cota superior en los dos tramos', () => {
  equal(costeMaximo(COACH_MODEL, 100_000, 1_000), 13_000);
  equal(costeMaximo(COACH_MODEL, 100_001, 1_000), Math.ceil(100_001 * 0.625) + 2_500);
  for (const fichas of [1_000, 99_999, 100_000, 100_001, 300_000]) {
    for (const factor of [1.25, 2]) {
      const real = factor === 2
        ? costMicroUsd(COACH_MODEL, { cache_creation_input_tokens: fichas, cache_creation: { ephemeral_1h_input_tokens: fichas }, output_tokens: 4_000 })
        : costMicroUsd(COACH_MODEL, { cache_creation_input_tokens: fichas, output_tokens: 4_000 });
      ok(costeMaximo(COACH_MODEL, fichas, 4_000, factor) >= real, `${fichas} a ${factor}×`);
    }
  }
});

Deno.test('Gasto: el tramo se decide por llamada, no por la suma del turno', () => {
  const g = new Gasto(COACH_MODEL);
  for (let i = 0; i < 5; i++) g.sumar({ input_tokens: 30_000, output_tokens: 100 }, COACH_MODEL);
  equal(g.micro(), 5 * costMicroUsd(COACH_MODEL, { input_tokens: 30_000, output_tokens: 100 }));
  equal(g.usage.input_tokens, 150_000);
});

Deno.test('historialEnTramo: tira lo más viejo, empieza por usuario y no toca lo que cabe', () => {
  const m = (role: 'user' | 'assistant', k: number): ApiMessage => ({ role, content: [{ type: 'text', text: 'x'.repeat(k) }] });
  const pequeno = [m('user', 10), m('assistant', 10)];
  deepEqual(historialEnTramo(pequeno, { s: 'y' }), pequeno);
  const grande = [m('user', 200_000), m('assistant', 200_000), m('user', 100), m('assistant', 100)];
  const r = historialEnTramo(grande, { s: 'y'.repeat(1000) });
  deepEqual(r, grande.slice(2));
  equal(historialEnTramo([m('user', 400_000)], { s: 'y' }).length, 0);
});

Deno.test('rechazo: reintenta solo con el mensaje, sin datos ni herramientas, y el usuario tiene respuesta', async () => {
  const fake = instalar({
    proveedor: (body: { tools?: unknown[] }) => (body.tools?.length ? rechazo() : turnoTexto('Hablemos de tu día.', { input_tokens: 500, output_tokens: 40 }, COACH_MODEL)),
  });
  try {
    const r = await handler(peticion({ kind: 'chat', message: '¿cómo enfoco la semana?', stream: false }));
    equal(r.status, 200);
    equal(((await r.json()) as { text: string }).text, 'Hablemos de tu día.');
    equal(fake.proveedor.length, 2);
    const segunda = fake.proveedor[1].body as { tools?: unknown[]; messages: { content: { text: string }[] }[]; system: { text: string }[] };
    equal(segunda.tools, undefined);
    equal(segunda.messages.length, 1);
    equal(segunda.messages[0].content[0].text, '¿cómo enfoco la semana?');
    const guardado = fake.escrituras('coach_messages').map((l) => JSON.stringify(l.body)).join('');
    ok(guardado.includes('Hablemos de tu día.'));
    const [run] = fake.escrituras('coach_runs').map((l) => l.body as Record<string, unknown>);
    equal(run.error, null);
    ok(Number(run.cost_micro_usd) > 0, 'el rechazo se apunta');
  } finally {
    await esperar();
    fake.restaurar();
  }
});

Deno.test('rechazo doble: texto fijo, sin error y sin guion largo', async () => {
  const fake = instalar({ proveedor: () => rechazo('bio') });
  try {
    const r = await handler(peticion({ kind: 'chat', message: '¿cómo enfoco la semana?', stream: false }));
    equal(r.status, 200);
    const { text } = (await r.json()) as { text: string };
    ok(text.length > 20);
    ok(!/[—–]/.test(text));
    equal(fake.proveedor.length, 2, 'un solo reintento');
  } finally {
    await esperar();
    fake.restaurar();
  }
});

Deno.test('rechazo tras ejecutar herramientas: no repite y dice que lo hecho queda guardado', async () => {
  const fake = instalar({
    proveedor: (_b: unknown, n: number) => (n === 0
      ? turnoHerramienta('consultar_dia', { fecha: '' }, 'tu_1', { input_tokens: 5_000, output_tokens: 50 }, COACH_MODEL)
      : rechazo()),
  });
  try {
    const r = await handler(peticion({ kind: 'chat', message: '¿cómo enfoco la semana?', stream: false }));
    equal(r.status, 200);
    ok(((await r.json()) as { text: string }).text.includes('queda guardado'));
    equal(fake.proveedor.length, 2, 'sin reintento: ya se ha actuado');
  } finally {
    await esperar();
    fake.restaurar();
  }
});

Deno.test('techo de 100.000: si otra vuelta sacaría el prompt del tramo barato, se contesta sin herramientas', async () => {
  const fake = instalar({
    proveedor: (_b: unknown, n: number) => (n === 0
      ? turnoHerramienta('consultar_dia', { fecha: '' }, 'tu_1', { input_tokens: TECHO_PROMPT + 1, output_tokens: 50 }, COACH_MODEL)
      : turnoTexto('Con lo que hay, esto.', { input_tokens: 95_000, output_tokens: 50 }, COACH_MODEL)),
  });
  try {
    const r = await handler(peticion({ kind: 'chat', message: '¿cómo enfoco la semana?', stream: false }));
    equal(r.status, 200);
    equal(fake.proveedor.length, 2);
    equal((fake.proveedor[0].body as { tool_choice?: unknown }).tool_choice, undefined);
    deepEqual((fake.proveedor[1].body as { tool_choice?: unknown }).tool_choice, { type: 'none' });
  } finally {
    await esperar();
    fake.restaurar();
  }
});

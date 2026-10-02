// Chat 3 · c — Aviso operativo de moderación en el ritual (0037_moderacion).
//
// moderation_digest() (solo service_role) devuelve {nuevos, abiertos, owners}.
// El ritual avisa por push SOLO a los dispositivos de esos owners, sin
// contenido de las denuncias, sin depender de consentimientos de IA/salud, y
// sin romperse si la RPC aún no existe.

import { deepEqual, equal, ok } from 'node:assert/strict';
import { instalar, type Llamada } from './sec_coach_fake_test.ts';

Deno.env.set('RITUAL_SECRET', 'secreto-del-cron-de-prueba-0123456789');
const { handler, avisarModeracion } = await import('../ritual/handler.ts');
const { adminClient } = await import('./db.ts');

const OWNER_A = '0000000a-0000-4000-8000-00000000000a';
const OWNER_B = '0000000b-0000-4000-8000-00000000000b';
const CUALQUIERA = '0000000c-0000-4000-8000-00000000000c';

const TOKENS = [
  { user_id: OWNER_A, token: 'ExponentPushToken[ownerA]' },
  { user_id: OWNER_B, token: 'ExponentPushToken[ownerB]' },
  { user_id: CUALQUIERA, token: 'ExponentPushToken[otro]' },
];

function cron(): Request {
  return new Request('http://localhost/functions/v1/ritual', {
    method: 'POST',
    headers: { 'x-ritual-secret': 'secreto-del-cron-de-prueba-0123456789' },
  });
}

/** El fake no filtra: aquí se aplica el `in` de user_id como lo haría PostgREST. */
function pushTokensFiltrados(c: Llamada): Response | undefined {
  if (c.url.pathname !== '/rest/v1/push_tokens' || c.method !== 'GET') return undefined;
  const filtro = c.url.searchParams.get('user_id') ?? '';
  const ids = /^in\.\((.*)\)$/.exec(filtro)?.[1]?.split(',').map((x) => x.replace(/"/g, '')) ?? [];
  const filas = TOKENS.filter((t) => ids.includes(t.user_id)).map(({ token }) => ({ token }));
  return new Response(JSON.stringify(filas), { headers: { 'content-type': 'application/json' } });
}

function montar(digest: (c: Llamada) => unknown, consentimientos = true) {
  const enviados: Llamada[] = [];
  const fake = instalar({
    filas: { profiles: [] },
    rpc: {
      moderation_digest: (_a, c) => {
        if (c.rol !== 'service') throw { status: 403, message: 'No autorizado' };
        return digest(c);
      },
      // El aviso no puede depender de esto: aquí se niegan.
      ai_consent_ok: () => consentimientos,
      health_consent_ok: () => consentimientos,
    },
    otras: (c) => {
      if (c.url.hostname === 'exp.host') {
        enviados.push(c);
        return new Response('{"data":[]}', { headers: { 'content-type': 'application/json' } });
      }
      return pushTokensFiltrados(c);
    },
  });
  return { fake, enviados };
}

Deno.test('moderación: nuevos = 0 no envía nada', async () => {
  const { fake, enviados } = montar(() => ({ nuevos: 0, abiertos: 4, owners: [OWNER_A] }));
  try {
    const r = await handler(cron());
    await r.text();
    equal(r.status, 200);
    equal(enviados.length, 0);
    ok(fake.llamadas.some((l) => l.url.pathname === '/rest/v1/rpc/moderation_digest' && l.rol === 'service'));
  } finally {
    fake.restaurar();
  }
});

Deno.test('moderación: nuevos > 0 envía solo a los dispositivos de los owners, sin contenido', async () => {
  const { fake, enviados } = montar(() => ({ nuevos: 2, abiertos: 5, owners: [OWNER_A, OWNER_B] }), false);
  try {
    const r = await handler(cron());
    await r.text();
    equal(r.status, 200);
    equal(enviados.length, 1);
    const mensajes = enviados[0].body as { to: string; title: string; body: string; data?: unknown }[];
    deepEqual(mensajes.map((m) => m.to).sort(), ['ExponentPushToken[ownerA]', 'ExponentPushToken[ownerB]']);
    for (const m of mensajes) {
      equal(m.title, 'Moderación');
      equal(m.body, '2 denuncias o revisiones nuevas · 5 abiertas');
      equal(m.data, undefined, 'sin carga extra');
    }
    // Con los consentimientos NEGADOS también sale: es operativo.
    ok(!fake.proveedor.length, 'no llama a ningún modelo');
  } finally {
    fake.restaurar();
  }
});

Deno.test('moderación: el texto no lleva contenido aunque la RPC devolviera de más', async () => {
  const { fake, enviados } = montar(() => ({
    nuevos: 1, abiertos: 1, owners: [OWNER_A],
    excerpt: 'texto denunciado SECRETO', reportes: [{ excerpt: 'SECRETO' }],
  }));
  try {
    await (await handler(cron())).text();
    equal(enviados.length, 1);
    ok(!JSON.stringify(enviados[0].body).includes('SECRETO'));
  } finally {
    fake.restaurar();
  }
});

Deno.test('moderación: si la RPC no existe (PGRST202 / 42883) el ritual sigue sin ruido', async () => {
  for (const code of ['PGRST202', '42883']) {
    const enviados: Llamada[] = [];
    const avisos: unknown[][] = [];
    const warn = console.warn;
    console.warn = (...a: unknown[]) => avisos.push(a);
    const fake = instalar({
      filas: { profiles: [] },
      otras: (c) => {
        if (c.url.pathname === '/rest/v1/rpc/moderation_digest') {
          return new Response(JSON.stringify({ code, message: 'Could not find the function public.moderation_digest' }), {
            status: 404,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (c.url.hostname === 'exp.host') enviados.push(c);
        return undefined;
      },
    });
    try {
      const r = await handler(cron());
      const cuerpo = JSON.parse(await r.text());
      equal(r.status, 200);
      deepEqual(cuerpo, { hechos: [], fallos: [] });
      equal(enviados.length, 0);
      equal(avisos.length, 1);
      ok(!JSON.stringify(avisos).includes('Could not find'), 'el aviso no lleva datos');
    } finally {
      console.warn = warn;
      fake.restaurar();
    }
  }
});

Deno.test('moderación: cualquier fallo (red, respuesta rara) devuelve 0 y no lanza', async () => {
  const fake = instalar({
    otras: (c) => (c.url.pathname === '/rest/v1/rpc/moderation_digest' ? Promise.reject(new Error('red caída')) : undefined),
  });
  const warn = console.warn;
  console.warn = () => {};
  try {
    equal(await avisarModeracion(adminClient()), 0);
  } finally {
    console.warn = warn;
    fake.restaurar();
  }
  const fake2 = instalar({ rpc: { moderation_digest: () => ({ nuevos: 'muchos', owners: 'x' }) } });
  try {
    equal(await avisarModeracion(adminClient()), 0);
  } finally {
    fake2.restaurar();
  }
});

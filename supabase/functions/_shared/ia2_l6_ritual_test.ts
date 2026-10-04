// L6 · El checkin dentro del ritual, con el backend simulado: consentimiento,
// caducidad (last_open_on), un push al día, el candado de gasto, sin
// herramientas, coste apuntado como 'checkin' y que un fallo no tumba nada.

import { equal, ok } from 'node:assert/strict';
import { instalar, SUPABASE_URL, turnoTexto, USER_ID, USER_TOKEN, type Fake, type Opciones } from './sec_coach_fake_test.ts';
import { CHEAP_MODEL } from './anthropic.ts';

Deno.env.set('RITUAL_SECRET', 'secreto-del-cron-de-prueba-0123456789');
const { handler, relojRitual } = await import('../ritual/handler.ts');

// Sábado 2026-10-10, 18:30 en Madrid: la hora del checkin con 08:00–23:00, y
// ningún ritual (ni despertar, ni domingo 20:00, ni las 11:00, ni día 1).
const AHORA = new Date('2026-10-10T16:30:00Z');
const TEXTO = 'Pierna sigue pendiente hoy. ¿A qué hora la vas a hacer?';

const perfil = (extra: Record<string, unknown> = {}) => ({
  id: USER_ID,
  name: 'Gladiador',
  timezone: 'Europe/Madrid',
  wake_time: '08:00:00',
  sleep_time: '23:00:00',
  coach_mode: 'A',
  profile_kind: 'general',
  streak_days: 3,
  last_open_on: '2026-10-09',
  ...extra,
});

function llamadaCron(): Request {
  return new Request('http://localhost/functions/v1/ritual', {
    method: 'POST',
    headers: { 'x-ritual-secret': 'secreto-del-cron-de-prueba-0123456789' },
  });
}

const pushes = (f: Fake) => f.llamadas.filter((l) => l.url.hostname === 'exp.host');
const rpcs = (f: Fake, nombre: string) => f.llamadas.filter((l) => l.url.pathname === `/rest/v1/rpc/${nombre}`);

function escenario(op: Opciones & { perfilExtra?: Record<string, unknown> } = {}): Fake {
  return instalar({
    ...op,
    filas: {
      profiles: [perfil(op.perfilExtra)],
      push_tokens: [{ token: 'ExponentPushToken[prueba]' }],
      ...(op.filas ?? {}),
    },
    proveedor: op.proveedor ?? (() => turnoTexto(TEXTO, { input_tokens: 1_500, output_tokens: 60 }, CHEAP_MODEL)),
    otras: async (c) => {
      if (c.url.hostname === 'exp.host') return new Response('{"data":[]}', { headers: { 'content-type': 'application/json' } });
      return op.otras ? await op.otras(c) : undefined;
    },
  });
}

async function correr(f: Fake): Promise<{ status: number; cuerpo: { hechos: { kind: string }[]; fallos: { error: string }[] } }> {
  const original = relojRitual.ahora;
  relojRitual.ahora = () => new Date(AHORA);
  try {
    const r = await handler(llamadaCron());
    return { status: r.status, cuerpo: JSON.parse(await r.text()) };
  } finally {
    relojRitual.ahora = original;
    f.restaurar();
  }
}

Deno.test('L6 ritual: checkin a su hora → Haiku sin herramientas, mensaje en el hilo, push y coste como checkin', async () => {
  const f = escenario();
  const { status, cuerpo } = await correr(f);
  equal(status, 200);
  ok(cuerpo.hechos.some((h) => h.kind === 'checkin'), JSON.stringify(cuerpo));

  equal(f.proveedor.length, 1);
  const peticion = f.proveedor[0].body as Record<string, unknown>;
  equal(peticion.model, CHEAP_MODEL);
  ok(!('tools' in peticion), 'sin herramientas');
  ok(!('tool_choice' in peticion));
  ok(!('thinking' in peticion) && !('output_config' in peticion), 'Haiku 4.5: ni thinking ni effort');
  ok(Number(peticion.max_tokens) <= 300);

  const runs = f.escrituras('coach_runs').map((l) => l.body as Record<string, unknown>);
  equal(runs.length, 1);
  equal(runs[0].kind, 'checkin');
  equal(runs[0].route, 'checkin');
  equal(runs[0].tools_offered, 0);
  equal(runs[0].error, null);
  ok(Number(runs[0].cost_micro_usd) > 0 && Number(runs[0].cost_micro_usd) < 3_000, `coste ${runs[0].cost_micro_usd} < 0,003 $`);

  const msgs = f.escrituras('coach_messages').map((l) => l.body as Record<string, unknown>);
  equal(msgs.length, 1);
  equal(msgs[0].role, 'assistant');
  equal(msgs[0].user_id, USER_ID);
  equal((msgs[0].content as { text: string }[])[0].text, TEXTO);

  const p = pushes(f);
  equal(p.length, 1);
  const envio = (p[0].body as { title: string; body: string; data: { ruta: string } }[])[0];
  equal(envio.title, 'Una pregunta del coach');
  // 4.5.4: el push no lleva lo que escribió el coach, solo un cuerpo fijo.
  equal(envio.body, 'Tu coach te ha hecho una pregunta.');
  ok(!envio.body.includes(TEXTO));
  equal(envio.data.ruta, '/(tabs)/coach');

  equal(rpcs(f, 'ai_begin_turn').length, 1);
  equal(rpcs(f, 'ai_end_turn').length, 1, 'el candado se suelta');
});

Deno.test('L6 ritual: sin consentimiento de IA, ni modelo ni push', async () => {
  const f = escenario({ rpc: { ai_consent_ok: () => false } });
  const { status } = await correr(f);
  equal(status, 200);
  equal(f.proveedor.length, 0);
  equal(pushes(f).length, 0);
  equal(f.escrituras('coach_messages').length, 0);
  equal(rpcs(f, 'ai_begin_turn').length, 0);
});

Deno.test('L6 ritual: sin consentimiento de salud, ni modelo ni push', async () => {
  const f = escenario({ rpc: { health_consent_ok: () => false } });
  await correr(f);
  equal(f.proveedor.length, 0);
  equal(pushes(f).length, 0);
});

Deno.test('L6 ritual: last_open_on hace 7+ días → el servidor calla (ni se genera)', async () => {
  for (const ultima of ['2026-10-03', '2026-09-10']) {
    const f = escenario({ perfilExtra: { last_open_on: ultima } });
    await correr(f);
    equal(f.proveedor.length, 0, ultima);
    equal(pushes(f).length, 0, ultima);
    equal(rpcs(f, 'ai_begin_turn').length, 0, ultima);
  }
});

Deno.test('L6 ritual: last_open_on null (cliente antiguo) cuenta como abierta hoy', async () => {
  const f = escenario({ perfilExtra: { last_open_on: null } });
  await correr(f);
  equal(pushes(f).length, 1);
});

Deno.test('L6 ritual: si el ritual ya empujó hoy, el checkin se escribe pero no añade push', async () => {
  const f = escenario({
    filas: { coach_runs: [{ kind: 'brief', created_at: '2026-10-10T06:00:00Z', error: null }] },
  });
  const { cuerpo } = await correr(f);
  ok(cuerpo.hechos.some((h) => h.kind === 'checkin'));
  equal(f.escrituras('coach_messages').length, 1);
  equal(pushes(f).length, 0, '1 push del servidor al día en total');
});

Deno.test('L6 ritual: el candado manda (402/429 → ni modelo ni push, y no se suelta un turno ajeno)', async () => {
  for (const reason of ['sin_suscripcion', 'presupuesto_agotado', 'turno_en_curso']) {
    const f = escenario({ rpc: { ai_begin_turn: () => ({ allowed: false, reason }) } });
    const { status } = await correr(f);
    equal(status, 200);
    equal(f.proveedor.length, 0, reason);
    equal(pushes(f).length, 0, reason);
    equal(f.escrituras('coach_messages').length, 0, reason);
    equal(rpcs(f, 'ai_end_turn').length, 0, `${reason}: no se suelta lo que no se tomó`);
  }
});

Deno.test('L6 ritual: fuera de su hora no se toca la base para el checkin', async () => {
  const f = escenario({ perfilExtra: { wake_time: '05:00', sleep_time: '15:00' } });
  await correr(f);
  equal(f.proveedor.length, 0);
  equal(f.llamadas.filter((l) => l.url.pathname === '/rest/v1/coach_runs').length, 0);
});

Deno.test('L6 ritual: tope semanal y retiro (2 ignorados) → no se genera', async () => {
  const semana = escenario({
    filas: {
      coach_runs: [
        { kind: 'checkin', created_at: '2026-10-09T16:00:00Z', error: null },
        { kind: 'checkin', created_at: '2026-10-07T16:00:00Z', error: null },
        { kind: 'checkin', created_at: '2026-10-05T16:00:00Z', error: null },
      ],
      coach_messages: [
        { created_at: '2026-10-09T18:00:00Z', tipo: 'text', texto: 'Hecho' },
        { created_at: '2026-10-07T18:00:00Z', tipo: 'text', texto: 'Hecho' },
      ],
    },
  });
  await correr(semana);
  equal(semana.proveedor.length, 0, 'tope semanal');

  const retiro = escenario({
    filas: {
      coach_runs: [
        { kind: 'checkin', created_at: '2026-10-09T16:00:00Z', error: null },
        { kind: 'checkin', created_at: '2026-10-07T16:00:00Z', error: null },
      ],
      // Solo encargos del cron y resultados de herramientas: él no ha dicho nada.
      coach_messages: [
        { created_at: '2026-10-10T06:00:00Z', tipo: 'text', texto: 'Es 2026-10-10. Dicta el brief de hoy y escribe el plan.' },
        { created_at: '2026-10-10T06:00:05Z', tipo: 'tool_result', texto: null },
      ],
    },
  });
  await correr(retiro);
  equal(retiro.proveedor.length, 0, 'retirado tras 2 ignorados');
});

Deno.test('L6 ritual: un fallo del checkin no tumba el ritual ni el aviso de moderación', async () => {
  // El proveedor cae: se apunta el intento con error y se suelta el candado.
  const caido = escenario({ proveedor: () => new Response('boom', { status: 500 }) });
  const r1 = await correr(caido);
  equal(r1.status, 200);
  equal(pushes(caido).length, 0);
  const runs = caido.escrituras('coach_runs').map((l) => l.body as Record<string, unknown>);
  equal(runs.length, 1);
  equal(runs[0].kind, 'checkin');
  equal(runs[0].error, 'checkin_failed');
  equal(rpcs(caido, 'ai_end_turn').length, 1);
  equal(rpcs(caido, 'moderation_digest').length, 1);

  // La base falla a mitad: se apunta en fallos y el cron sigue hasta el final.
  const roto = escenario({
    otras: (c) => c.url.pathname === '/rest/v1/coach_messages' && c.method === 'GET'
      ? new Response(JSON.stringify({ message: 'caída' }), { status: 500, headers: { 'content-type': 'application/json' } })
      : undefined,
  });
  const r2 = await correr(roto);
  equal(r2.status, 200);
  ok(r2.cuerpo.fallos.some((x) => x.error === 'checkin_failed'));
  equal(rpcs(roto, 'moderation_digest').length, 1);
  equal(roto.proveedor.length, 0);
});

Deno.test('L6 ritual: el brief no empuja si lleva 7+ días sin abrir (la regla vale para todo push del servidor)', async () => {
  const f = escenario({
    perfilExtra: { last_open_on: '2026-10-01' },
    otras: (c) => {
      const ruta = c.url.pathname;
      const j = (b: unknown, extra: ResponseInit = {}) => new Response(JSON.stringify(b), { headers: { 'content-type': 'application/json' }, ...extra });
      if (ruta === `/auth/v1/admin/users/${USER_ID}`) return j({ id: USER_ID, email: 'g@test.local' });
      if (ruta === '/auth/v1/admin/generate_link') return j({ id: USER_ID, action_link: 'x', hashed_token: 'h', verification_type: 'magiclink' });
      if (ruta === '/auth/v1/verify') {
        return new Response(null, { status: 303, headers: { location: `http://localhost/#access_token=${USER_TOKEN}&token_type=bearer` } });
      }
      if (ruta === '/functions/v1/coach') return j({ text: 'Brief. '.repeat(60) });
      if (ruta === '/auth/v1/logout') return new Response(null, { status: 204 });
      return undefined;
    },
  });
  const original = relojRitual.ahora;
  // 08:30 en Madrid: la hora del brief.
  relojRitual.ahora = () => new Date('2026-10-10T06:30:00Z');
  try {
    const r = await handler(llamadaCron());
    const cuerpo = JSON.parse(await r.text());
    equal(r.status, 200);
    ok(cuerpo.hechos.some((h: { kind: string }) => h.kind === 'brief'), 'el brief se escribe igual');
    equal(pushes(f).length, 0, 'sin push');
    equal(f.escrituras('coach_runs').length, 0, 'ni titular de Haiku');
    ok(f.llamadas.some((l) => l.url.origin === SUPABASE_URL && l.url.pathname === '/auth/v1/logout'));
  } finally {
    relojRitual.ahora = original;
    f.restaurar();
  }
});

Deno.test('Día 1: el único push es «Tu mes en imágenes» (prioridad mensual > brief); el cierre queda en el hilo', async () => {
  const f = escenario({
    perfilExtra: { last_open_on: '2026-10-31' },
    otras: (c) => {
      const ruta = c.url.pathname;
      const j = (b: unknown, extra: ResponseInit = {}) => new Response(JSON.stringify(b), { headers: { 'content-type': 'application/json' }, ...extra });
      if (ruta === `/auth/v1/admin/users/${USER_ID}`) return j({ id: USER_ID, email: 'g@test.local' });
      if (ruta === '/auth/v1/admin/generate_link') return j({ id: USER_ID, action_link: 'x', hashed_token: 'h', verification_type: 'magiclink' });
      if (ruta === '/auth/v1/verify') {
        return new Response(null, { status: 303, headers: { location: `http://localhost/#access_token=${USER_TOKEN}&token_type=bearer` } });
      }
      if (ruta === '/functions/v1/coach') {
        return c.body && JSON.stringify(c.body).includes('"periodo":"mensual"')
          ? j({ slides: [{}, {}], fotos: 1 })
          : j({ text: 'Cierre del mes. '.repeat(40) });
      }
      if (ruta === '/auth/v1/logout') return new Response(null, { status: 204 });
      return undefined;
    },
  });
  const original = relojRitual.ahora;
  // 1 de noviembre, 08:30 en Madrid: cierre mensual a la hora de despertar.
  relojRitual.ahora = () => new Date('2026-11-01T07:30:00Z');
  try {
    const r = await handler(llamadaCron());
    const cuerpo = JSON.parse(await r.text());
    equal(r.status, 200);
    ok(cuerpo.hechos.some((h: { kind: string }) => h.kind === 'cierre_mensual'));
    const enviados = pushes(f);
    equal(enviados.length, 1, 'un solo push el día 1');
    ok(JSON.stringify(enviados[0].body).includes('Tu mes en im'), JSON.stringify(enviados[0].body));
    ok(JSON.stringify(enviados[0].body).includes('1 foto.'), 'singular: «1 foto», no «1 fotos»');
  } finally {
    relojRitual.ahora = original;
    f.restaurar();
  }
});

// Chat 3 · c — La función `ritual` (la llama pg_cron, desplegada con
// --no-verify-jwt): secreto en tiempo constante, sesiones de servidor que se
// cierran al acabar y el titular del push apuntado en el libro de gasto.

import { equal, ok } from 'node:assert/strict';
import { instalar, SUPABASE_URL, turnoTexto, USER_ID, USER_TOKEN } from './sec_coach_fake_test.ts';

Deno.env.set('RITUAL_SECRET', 'secreto-del-cron-de-prueba-0123456789');
const { handler, secretoValido } = await import('../ritual/handler.ts');

function llamadaCron(secreto?: string): Request {
  return new Request('http://localhost/functions/v1/ritual', {
    method: 'POST',
    headers: secreto === undefined ? {} : { 'x-ritual-secret': secreto },
  });
}

Deno.test('ritual: sin secreto o con uno parecido, 401 y no se lee ningún perfil', async () => {
  const fake = instalar();
  try {
    for (const s of [undefined, '', 'secreto-del-cron-de-prueba-012345678', 'secreto-del-cron-de-prueba-01234567899']) {
      const r = await handler(llamadaCron(s));
      await r.text();
      equal(r.status, 401);
    }
    equal(fake.llamadas.length, 0, 'ni una consulta antes de autenticar');
  } finally {
    fake.restaurar();
  }
});

Deno.test('ritual: comparación del secreto', () => {
  ok(secretoValido('abc', 'abc'));
  ok(!secretoValido('abd', 'abc'));
  ok(!secretoValido('ab', 'abc'));
  ok(!secretoValido('abcd', 'abc'));
  ok(!secretoValido(null, 'abc'));
  ok(!secretoValido('abc', undefined));
  ok(!secretoValido('', ''));
});

Deno.test('ritual: la sesión abierta por el gladiador se cierra y el titular se apunta', async () => {
  // Que le toque algo ahora: el brief a su hora de despertar = la hora actual.
  const hora = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', hour12: false })
    .format(new Date())
    .padStart(2, '0')
    .slice(0, 2);
  const perfil = {
    id: USER_ID, name: 'G', timezone: 'Europe/Madrid', wake_time: `${hora}:00`, sleep_time: '23:00', coach_mode: 'A',
  };
  const fake = instalar({
    filas: { profiles: [perfil] },
    proveedor: () => turnoTexto('Hoy toca pierna a las 7.', { input_tokens: 2_000, output_tokens: 40 }),
    otras: (c) => {
      const ruta = c.url.pathname;
      if (ruta === `/auth/v1/admin/users/${USER_ID}`) {
        return new Response(JSON.stringify({ id: USER_ID, email: 'g@test.local' }), { headers: { 'content-type': 'application/json' } });
      }
      if (ruta === '/auth/v1/admin/generate_link') {
        return new Response(JSON.stringify({ id: USER_ID, action_link: 'x', hashed_token: 'h', verification_type: 'magiclink' }), {
          headers: { 'content-type': 'application/json' },
        });
      }
      if (ruta === '/auth/v1/verify') {
        return new Response(null, { status: 303, headers: { location: `http://localhost/#access_token=${USER_TOKEN}&token_type=bearer` } });
      }
      if (ruta === '/functions/v1/coach') {
        // Un brief largo: el titular lo resume Haiku.
        return new Response(JSON.stringify({ text: 'Brief. '.repeat(60) }), { headers: { 'content-type': 'application/json' } });
      }
      if (ruta === '/auth/v1/logout') return new Response(null, { status: 204 });
      return undefined;
    },
  });
  try {
    const r = await handler(llamadaCron('secreto-del-cron-de-prueba-0123456789'));
    const cuerpo = JSON.parse(await r.text());
    equal(r.status, 200);
    equal(cuerpo.hechos.length, 1, JSON.stringify(cuerpo));
    const logout = fake.llamadas.filter((l) => l.url.origin === SUPABASE_URL && l.url.pathname === '/auth/v1/logout');
    equal(logout.length, 1, 'se revoca la sesión minteada');
    equal(logout[0].headers.get('authorization'), `Bearer ${USER_TOKEN}`);
    equal(logout[0].url.searchParams.get('scope'), 'local');
    const titular = fake.escrituras('coach_runs').map((l) => l.body as Record<string, unknown>);
    equal(titular.length, 1);
    equal(titular[0].kind, 'titular');
    ok(Number(titular[0].cost_micro_usd) > 0);
  } finally {
    fake.restaurar();
  }
});

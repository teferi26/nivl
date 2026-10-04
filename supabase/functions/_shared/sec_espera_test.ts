// Lista de espera (0054): la función `espera` sin red ni base de datos.
import { assertEquals } from 'jsr:@std/assert@1';
import { esperaHandler, ipDe, limpiarOrigen, VERSION_CONSENTIMIENTO, type ResultadoAlta } from '../espera/handler.ts';

const NIVL = 'https://nivl.app';

function peticion(body: unknown, opts: { origin?: string | null; method?: string; ct?: string; xff?: string } = {}) {
  const headers: Record<string, string> = {};
  if (opts.origin !== null) headers.origin = opts.origin ?? NIVL;
  if (opts.ct !== '') headers['content-type'] = opts.ct ?? 'application/json';
  if (opts.xff) headers['x-forwarded-for'] = opts.xff;
  const method = opts.method ?? 'POST';
  return new Request('https://x.supabase.co/functions/v1/espera', {
    method,
    headers,
    body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });
}

function espia(resultado: ResultadoAlta | Error = 'ok') {
  const llamadas: unknown[][] = [];
  const h = esperaHandler((...a) => {
    llamadas.push(a);
    return resultado instanceof Error ? Promise.reject(resultado) : Promise.resolve(resultado);
  });
  return { h, llamadas };
}

Deno.test('alta válida: 200 {ok}, versión del servidor, origen limpio e IP del proxy', async () => {
  const { h, llamadas } = espia('ok');
  const r = await h(peticion({ email: 'A@B.es', consentimiento: true, origen: 'c:CODIGO1', version: 'v999' }, { xff: '1.2.3.4, 10.0.0.1' }));
  assertEquals(r.status, 200);
  assertEquals(await r.json(), { ok: true });
  assertEquals(r.headers.get('access-control-allow-origin'), NIVL);
  assertEquals(llamadas, [['A@B.es', VERSION_CONSENTIMIENTO, 'c:CODIGO1', '1.2.3.4']]);
});

Deno.test('ya apuntado y alta nueva responden idéntico (sin enumeración)', async () => {
  // La RPC devuelve 'ok' en los dos casos; aquí se fija que la respuesta no depende de nada más.
  const a = await espia('ok').h(peticion({ email: 'nuevo@b.es', consentimiento: true }));
  const b = await espia('ok').h(peticion({ email: 'repetido@b.es', consentimiento: true }));
  assertEquals([a.status, await a.text()], [b.status, await b.text()]);
});

Deno.test('honeypot: 200 como un alta y no se llama a la base de datos', async () => {
  const { h, llamadas } = espia('ok');
  const r = await h(peticion({ email: 'bot@b.es', consentimiento: true, web: 'http://spam' }));
  assertEquals(r.status, 200);
  assertEquals(await r.json(), { ok: true });
  assertEquals(llamadas.length, 0);
});

Deno.test('sin consentimiento explícito (true) no se apunta', async () => {
  for (const c of [undefined, false, 'true', 1]) {
    const { h, llamadas } = espia('ok');
    const r = await h(peticion({ email: 'a@b.es', consentimiento: c }));
    assertEquals(r.status, 400);
    assertEquals(await r.json(), { error: 'consentimiento' });
    assertEquals(llamadas.length, 0);
  }
});

Deno.test('correo no válido, freno y fallo: códigos y cuerpo genérico', async () => {
  assertEquals((await espia('correo').h(peticion({ email: 'x', consentimiento: true }))).status, 400);
  assertEquals((await espia('ok').h(peticion({ email: 5, consentimiento: true }))).status, 400);
  assertEquals((await espia('ok').h(peticion({ email: 'a'.repeat(250) + '@b.es', consentimiento: true }))).status, 400);
  const f = await espia('frenado').h(peticion({ email: 'a@b.es', consentimiento: true }));
  assertEquals([f.status, await f.json()], [429, { error: 'frenado' }]);
  const e = await espia(new Error('duplicate key … detalle interno')).h(peticion({ email: 'a@b.es', consentimiento: true }));
  assertEquals([e.status, await e.json()], [500, { error: 'sistema' }]);
});

Deno.test('CORS: solo https://nivl.app; otro origen o ninguno, 403 sin cabeceras CORS', async () => {
  const pre = await espia().h(peticion(null, { method: 'OPTIONS' }));
  assertEquals(pre.status, 204);
  assertEquals(pre.headers.get('access-control-allow-origin'), NIVL);
  assertEquals(pre.headers.get('access-control-allow-headers'), 'content-type');
  for (const origin of ['https://evil.example', 'https://nivl.app.evil.example', 'http://nivl.app', null]) {
    const { h, llamadas } = espia('ok');
    const o = await h(peticion(null, { method: 'OPTIONS', origin }));
    assertEquals(o.status, 403);
    assertEquals(o.headers.get('access-control-allow-origin'), null);
    const p = await h(peticion({ email: 'a@b.es', consentimiento: true }, { origin }));
    assertEquals(p.status, 403);
    assertEquals(p.headers.get('access-control-allow-origin'), null);
    assertEquals(llamadas.length, 0);
  }
});

Deno.test('CORS: nivl-web.vercel.app también (misma web); sus previews y www no', async () => {
  const ok = await espia().h(peticion({ email: 'a@b.es', consentimiento: true }, { origin: 'https://nivl-web.vercel.app' }));
  assertEquals(ok.status, 200);
  assertEquals(ok.headers.get('access-control-allow-origin'), 'https://nivl-web.vercel.app');
  for (const origin of ['https://nivl-web-git-main-teferi26.vercel.app', 'https://www.nivl.app', 'https://evil.vercel.app']) {
    assertEquals((await espia().h(peticion({ email: 'a@b.es', consentimiento: true }, { origin }))).status, 403);
  }
});

Deno.test('método, tipo, tamaño y JSON', async () => {
  assertEquals((await espia().h(peticion(null, { method: 'GET' }))).status, 405);
  assertEquals((await espia().h(peticion('email=a@b.es', { ct: 'application/x-www-form-urlencoded' }))).status, 415);
  assertEquals((await espia().h(peticion('{"email":"' + 'a'.repeat(3000) + '"}'))).status, 413);
  assertEquals((await espia().h(peticion('{no es json'))).status, 400);
  assertEquals((await espia().h(peticion('[1,2]'))).status, 400);
  assertEquals((await espia().h(peticion('null'))).status, 400);
});

Deno.test('origen: lo que no encaja se descarta (null), no se rechaza', () => {
  assertEquals(limpiarOrigen('bio'), 'bio');
  assertEquals(limpiarOrigen(' utm_source:tiktok '), 'utm_source:tiktok');
  assertEquals(limpiarOrigen('<script>'), null);
  assertEquals(limpiarOrigen('a'.repeat(65)), null);
  assertEquals(limpiarOrigen(42), null);
});

Deno.test('ipDe: primera IP de x-forwarded-for; sin cabecera, cadena vacía', () => {
  assertEquals(ipDe(new Request('https://x', { headers: { 'x-forwarded-for': ' 9.9.9.9 ,1.1.1.1' } })), '9.9.9.9');
  assertEquals(ipDe(new Request('https://x')), '');
});

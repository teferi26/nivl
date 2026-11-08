// NIVL · Supabase de mentira para recorrer la app sin tocar ninguna cuenta real.
//
// Servidor HTTP local (por defecto :8102) que imita lo justo de Auth, PostgREST,
// Functions y Storage. Sirve igual a los navegadores de Playwright y a los
// simuladores de iOS (localhost llega al Mac). Cualquier correo y contraseña
// entran: la sesión es de una cuenta ficticia y los datos, de `fixtures.mjs`.
//
//   node e2e/web/mock-supabase.mjs
//   EXPO_PUBLIC_SUPABASE_URL=http://localhost:8102 EXPO_PUBLIC_SUPABASE_KEY=mock \
//     EXPO_PUBLIC_GALERIA=1 npx expo start --web --port 8101 --clear
//
// `fixtures.mjs` se relee en cada petición: se puede ampliar sin reiniciar.

import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { statSync } from 'node:fs';

const PUERTO = Number(process.env.MOCK_PORT ?? 8102);
const AQUI = dirname(fileURLToPath(import.meta.url));
const RUTA_FIXTURES = join(AQUI, 'fixtures.mjs');

async function fixtures() {
  const v = statSync(RUTA_FIXTURES).mtimeMs;
  return (await import(`${pathToFileURL(RUTA_FIXTURES).href}?v=${v}`)).crear();
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

function sesion(usuario) {
  const expira = Math.floor(Date.now() / 1000) + 86400;
  const access = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: usuario.id, email: usuario.email, role: 'authenticated', aud: 'authenticated', exp: expira })}.mock`;
  return { access_token: access, refresh_token: 'mock-refresh', token_type: 'bearer', expires_in: 86400, expires_at: expira, user: usuario };
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS,HEAD',
  'Access-Control-Expose-Headers': 'Content-Range, x-nivl-mock',
};

function enviar(res, codigo, cuerpo, extra = {}) {
  const texto = cuerpo === undefined ? '' : JSON.stringify(cuerpo);
  res.writeHead(codigo, { 'Content-Type': 'application/json', ...CORS, ...extra });
  res.end(texto);
}

const leer = (req) =>
  new Promise((ok) => {
    let d = '';
    req.on('data', (c) => (d += c));
    req.on('end', () => {
      try {
        ok(d ? JSON.parse(d) : undefined);
      } catch {
        ok(d);
      }
    });
  });

/** Filtros `col=eq.valor` de PostgREST; solo si la fila tiene esa columna. */
function filtrar(filas, params) {
  let r = filas;
  for (const [col, val] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(col)) continue;
    if (!val.startsWith('eq.')) continue;
    const buscado = val.slice(3);
    r = r.filter((f) => !(col in f) || String(f[col]) === buscado);
  }
  const lim = Number(params.get('limit'));
  return lim > 0 ? r.slice(0, lim) : r;
}

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return enviar(res, 204);
  const url = new URL(req.url, `http://localhost:${PUERTO}`);
  const p = url.pathname;
  try {
    const fx = await fixtures();
    if (p.startsWith('/auth/v1/')) {
      await leer(req);
      if (p.endsWith('/token') || p.endsWith('/verify')) return enviar(res, 200, sesion(fx.usuario));
      if (p.endsWith('/user')) return enviar(res, 200, fx.usuario);
      if (p.endsWith('/signup')) return enviar(res, 200, { ...fx.usuario, confirmation_sent_at: new Date().toISOString() });
      if (p.endsWith('/settings')) return enviar(res, 200, { external: {}, mailer_autoconfirm: false });
      return enviar(res, 200, {});
    }
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      await leer(req);
      const v = fx.rpc[fn];
      return enviar(res, 200, v === undefined ? null : v);
    }
    if (p.startsWith('/rest/v1/')) {
      const tabla = p.slice('/rest/v1/'.length);
      const cuerpo = await leer(req);
      const uno = (req.headers.accept ?? '').includes('vnd.pgrst.object');
      if (req.method === 'GET' || req.method === 'HEAD') {
        const filas = filtrar(fx.tablas[tabla] ?? [], url.searchParams);
        const rango = { 'Content-Range': `0-${Math.max(0, filas.length - 1)}/${filas.length}` };
        if (uno) {
          if (filas[0]) return enviar(res, 200, filas[0], rango);
          return enviar(res, 406, { code: 'PGRST116', message: 'sin filas', details: 'mock', hint: null });
        }
        return enviar(res, 200, req.method === 'HEAD' ? undefined : filas, rango);
      }
      if (req.method === 'DELETE') return enviar(res, 204);
      const eco = Array.isArray(cuerpo) ? cuerpo : [cuerpo ?? {}];
      return enviar(res, req.method === 'POST' ? 201 : 200, uno ? eco[0] : eco);
    }
    if (p.startsWith('/functions/v1/')) {
      await leer(req);
      const fn = p.slice('/functions/v1/'.length);
      return enviar(res, 200, fx.funciones[fn] ?? {});
    }
    if (p.startsWith('/storage/v1/')) {
      await leer(req);
      return enviar(res, 200, p.includes('/list/') ? [] : { Key: 'mock', signedURL: '', signedUrl: '' });
    }
    return enviar(res, 404, { message: 'mock: ruta sin cubrir', ruta: p });
  } catch (e) {
    console.error('[mock]', p, e);
    return enviar(res, 500, { message: String(e) });
  }
}).listen(PUERTO, () => console.log(`mock de Supabase en http://localhost:${PUERTO}`));

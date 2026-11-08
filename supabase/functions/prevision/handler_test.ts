// La función `prevision`: JWT, consentimientos y que nunca use datos del cliente.
import { assertEquals } from 'jsr:@std/assert@1';
import type { Db } from '../_shared/db.ts';
import type { HoraClima } from '../_shared/mejorHora.ts';
import { crearHandler, textoBusqueda } from './handler.ts';

const USER = '00000000-0000-4000-8000-0000000000c1';
const HORA: HoraClima = { hora: '2026-11-08T19:00', temp: 14, sensacion: 13, lluvia_prob: 0, lluvia_mm: 0, viento_kmh: 5, racha_kmh: 10, uv: 0, codigo: 3, es_de_dia: false };

interface Escenario {
  usuario?: boolean;
  salud?: boolean;
  perfil?: Record<string, unknown> | null;
  perfilError?: boolean;
}

function montar(e: Escenario) {
  const llamadas: { lat: number; lon: number; tz: string }[] = [];
  const busquedas: string[] = [];
  const admin = { auth: { getUser: () => Promise.resolve(e.usuario === false ? { data: { user: null }, error: { message: 'x' } } : { data: { user: { id: USER } }, error: null }) } } as unknown as Db;
  const filtros: string[] = [];
  const sb = {
    rpc: () => Promise.resolve({ data: e.salud !== false, error: null }),
    from: (tabla: string) => {
      const q = {
        select: () => q,
        eq: (c: string, v: string) => { filtros.push(`${tabla}.${c}=${v}`); return q; },
        maybeSingle: () => Promise.resolve(
          tabla === 'profiles'
            ? { data: { timezone: 'Europe/Madrid' }, error: null }
            : { data: e.perfilError ? null : e.perfil ?? null, error: e.perfilError ? { code: '42P01' } : null },
        ),
      };
      return q;
    },
  } as unknown as Db;
  const handler = crearHandler({
    admin,
    userClient: () => sb,
    prevision: (lat, lon, tz) => { llamadas.push({ lat, lon, tz }); return Promise.resolve([HORA]); },
    buscar: (t) => { busquedas.push(t); return Promise.resolve([]); },
  });
  return { handler, llamadas, busquedas, filtros };
}

const CON_UBICACION = { ubicacion_lat: 40.42, ubicacion_lon: -3.7, ubicacion_consentida_en: '2026-11-01T10:00:00Z' };
const pedir = (ruta = '', init: RequestInit = {}) =>
  new Request(`http://x/prevision${ruta}`, { method: 'POST', headers: { authorization: 'Bearer t' }, ...init });

Deno.test('prevision: sin token, 401', async () => {
  const { handler } = montar({ perfil: CON_UBICACION });
  assertEquals((await handler(new Request('http://x/prevision', { method: 'POST' }))).status, 401);
});

Deno.test('prevision: token inválido, 401', async () => {
  const { handler } = montar({ usuario: false });
  assertEquals((await handler(pedir())).status, 401);
});

Deno.test('prevision: sin permiso de salud, 403 y no sale nada', async () => {
  const { handler, llamadas } = montar({ salud: false, perfil: CON_UBICACION });
  assertEquals((await handler(pedir())).status, 403);
  assertEquals(llamadas.length, 0);
});

Deno.test('prevision: sin ubicación consentida, 409 y no sale nada', async () => {
  for (const perfil of [null, { ubicacion_lat: null, ubicacion_lon: null, ubicacion_consentida_en: null }, { ...CON_UBICACION, ubicacion_consentida_en: null }]) {
    const { handler, llamadas } = montar({ perfil });
    assertEquals((await handler(pedir())).status, 409);
    assertEquals(llamadas.length, 0);
  }
});

Deno.test('prevision: usa la ubicación guardada, nunca la del cliente', async () => {
  const { handler, llamadas, filtros } = montar({ perfil: CON_UBICACION });
  const r = await handler(pedir('?lat=1&lon=2', { body: JSON.stringify({ lat: 1, lon: 2, user_id: 'otro' }) }));
  assertEquals(r.status, 200);
  assertEquals(await r.json(), [HORA]);
  assertEquals(llamadas, [{ lat: 40.42, lon: -3.7, tz: 'Europe/Madrid' }]);
  assertEquals(filtros.includes(`entreno_perfil.user_id=${USER}`), true);
});

Deno.test('prevision: si la tabla falla, 503 sin filtrar el motivo', async () => {
  const { handler } = montar({ perfilError: true });
  const r = await handler(pedir());
  assertEquals(r.status, 503);
  assertEquals(await r.json(), { error: 'sin_servicio' });
});

Deno.test('prevision: buscar recibe texto y no lee la ubicación', async () => {
  const { handler, busquedas, llamadas } = montar({ perfil: CON_UBICACION });
  assertEquals((await handler(pedir('?accion=buscar', { body: JSON.stringify({ buscar: 'Madrid' }) }))).status, 200);
  assertEquals(busquedas, ['Madrid']);
  assertEquals(llamadas.length, 0);
  assertEquals((await handler(pedir('?accion=buscar', { body: JSON.stringify({ buscar: 'a' }) }))).status, 400);
});

Deno.test('prevision: método no admitido', async () => {
  const { handler } = montar({});
  assertEquals((await handler(new Request('http://x/prevision', { method: 'PUT' }))).status, 405);
});

Deno.test('textoBusqueda limpia y acota', () => {
  assertEquals(textoBusqueda('  San\n  Sebastián '), 'San Sebastián');
  assertEquals(textoBusqueda('x'.repeat(81)), null);
});

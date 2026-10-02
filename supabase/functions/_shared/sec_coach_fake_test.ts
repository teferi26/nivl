// NIVL · Backend simulado para los tests de seguridad del coach (Chat 3 · c).
//
// No es un test: es el arnés que usan los `sec_coach_*_test.ts`. Sustituye
// `globalThis.fetch` por un enrutador que imita lo justo de Supabase (Auth,
// PostgREST y RPC, con los GRANT reales: las RPC de IA solo para service_role)
// y del proveedor de IA (Anthropic en SSE). Nada sale a la red y no se gasta
// un céntimo: todo lo que "cobra" el proveedor simulado es un número inventado.

export const SUPABASE_URL = 'http://fake.supabase.local';
export const SERVICE_KEY = 'service-role-key-de-prueba';
export const ANON_KEY = 'anon-key-de-prueba';
export const USER_ID = '00000000-0000-4000-8000-0000000000c1';
export const USER_TOKEN = 'jwt-de-usuario-de-prueba';

Deno.env.set('SUPABASE_URL', SUPABASE_URL);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', SERVICE_KEY);
Deno.env.set('SUPABASE_ANON_KEY', ANON_KEY);
Deno.env.set('ANTHROPIC_API_KEY', 'sk-ant-de-prueba-no-real');
Deno.env.delete('COACH_BASE_URL');
Deno.env.delete('COACH_API_KEY');

export interface Llamada {
  method: string;
  url: URL;
  body: unknown;
  headers: Headers;
  rol: 'service' | 'user' | 'anon' | 'externo';
}

export interface Opciones {
  /** RPC → resultado. Recibe los argumentos y la llamada. Lanza {status,message} para un error. */
  rpc?: Record<string, (args: any, c: Llamada) => unknown>;
  /** Filas por tabla para los GET (antes de filtrar nada: el fake no filtra). */
  filas?: Record<string, unknown[]>;
  /** El proveedor de IA. n = número de llamada (0, 1…). */
  proveedor?: (body: any, n: number, c: Llamada) => Response | Promise<Response>;
  /** Cualquier otra ruta (Auth admin, otras funciones, Expo…). undefined = sigue el enrutado normal. */
  otras?: (c: Llamada) => Response | undefined | Promise<Response | undefined>;
}

export interface Fake {
  llamadas: Llamada[];
  proveedor: Llamada[];
  escrituras: (tabla: string) => Llamada[];
  restaurar: () => void;
}

/** Las RPC que en la base real solo puede ejecutar service_role (comprobado en pg_proc.proacl). */
const SOLO_SERVICE = new Set(['ai_begin_turn', 'ai_end_turn', 'ai_state', 'ai_consent_ok']);

export function sse(eventos: unknown[]): Response {
  const cuerpo = eventos.map((e) => `event: x\ndata: ${JSON.stringify(e)}\n\n`).join('');
  return new Response(cuerpo, { headers: { 'content-type': 'text/event-stream' } });
}

/** Un turno de Anthropic con texto y un uso concreto (lo que "cuesta"). */
export function turnoTexto(texto: string, uso = { input_tokens: 100_000, output_tokens: 2_000 }): Response {
  return sse([
    { type: 'message_start', message: { model: 'claude-sonnet-5', usage: { input_tokens: uso.input_tokens, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: texto } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: uso.output_tokens } },
  ]);
}

/** Un turno de Anthropic que pide una herramienta. */
export function turnoHerramienta(nombre: string, input: unknown, id = `tu_${nombre}`): Response {
  return sse([
    { type: 'message_start', message: { model: 'claude-sonnet-5', usage: { input_tokens: 50_000, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id, name: nombre, input: {} } },
    { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify(input) } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 300 } },
  ]);
}

function rolDe(h: Headers): Llamada['rol'] {
  const auth = h.get('authorization') ?? '';
  if (auth === `Bearer ${SERVICE_KEY}`) return 'service';
  if (auth === `Bearer ${USER_TOKEN}`) return 'user';
  if (auth === `Bearer ${ANON_KEY}`) return 'anon';
  return 'externo';
}

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...extra },
  });
}

export function instalar(op: Opciones = {}): Fake {
  const original = globalThis.fetch;
  const llamadas: Llamada[] = [];
  const proveedor: Llamada[] = [];

  const rpcPorDefecto: Record<string, (args: any, c: Llamada) => unknown> = {
    ai_consent_ok: () => true,
    health_consent_ok: () => true,
    ai_begin_turn: () => ({ allowed: true, mode: 'estandar', turn_budget: 5_000_000, routes: {} }),
    ai_end_turn: () => null,
    ai_state: () => ({ entitled: true, remaining: 5_000_000, tier: 'pro' }),
  };
  const filasPorDefecto: Record<string, unknown[]> = {
    health_state: [{ revision: 1, accepted: true }],
    profiles: [{
      id: USER_ID, name: 'Gladiador de prueba', timezone: 'Europe/Madrid', wake_time: '07:00', sleep_time: '23:00',
      coach_mode: 'A', xp_total: 0, streak_days: 0, protection_stones: 0, bonus_points: 0, profile_kind: 'general',
    }],
  };

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(String(input), init);
    const url = new URL(req.url);
    const texto = req.method === 'GET' || req.method === 'HEAD' ? '' : await req.text();
    let body: unknown = texto;
    try { body = texto ? JSON.parse(texto) : null; } catch { /* no es JSON */ }
    const c: Llamada = { method: req.method, url, body, headers: req.headers, rol: rolDe(req.headers) };
    llamadas.push(c);

    const otra = op.otras ? await op.otras(c) : undefined;
    if (otra) return otra;

    if (url.hostname === 'api.anthropic.com' || url.pathname.endsWith('/chat/completions')) {
      proveedor.push(c);
      const n = proveedor.length - 1;
      return op.proveedor ? await op.proveedor(body, n, c) : turnoTexto('ok');
    }

    if (url.origin !== SUPABASE_URL) return new Response('host inesperado en el test', { status: 599 });

    if (url.pathname === '/auth/v1/user') {
      return c.headers.get('authorization') === `Bearer ${USER_TOKEN}`
        ? json(200, { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'gladiador@test.local' })
        : json(401, { msg: 'invalid JWT' });
    }

    const rpc = /^\/rest\/v1\/rpc\/(.+)$/.exec(url.pathname)?.[1];
    if (rpc) {
      if (SOLO_SERVICE.has(rpc) && c.rol !== 'service') {
        return json(403, { code: '42501', message: `permission denied for function ${rpc}` });
      }
      const fn = op.rpc?.[rpc] ?? rpcPorDefecto[rpc];
      if (!fn) return json(200, null);
      try {
        return json(200, await fn(body, c));
      } catch (e) {
        const err = e as { status?: number; message?: string };
        return json(err.status ?? 400, { message: err.message ?? 'error' });
      }
    }

    const tabla = /^\/rest\/v1\/(.+)$/.exec(url.pathname)?.[1];
    if (tabla) {
      const objeto = (c.headers.get('accept') ?? '').includes('vnd.pgrst.object');
      if (req.method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-range': '*/0' } });
      if (req.method === 'GET') {
        const filas = op.filas?.[tabla] ?? filasPorDefecto[tabla] ?? [];
        if (objeto) return filas.length ? json(200, filas[0]) : json(406, { code: 'PGRST116', message: 'no rows' });
        return json(200, filas, { 'content-range': `0-${Math.max(0, filas.length - 1)}/${filas.length}` });
      }
      // Escrituras: se apuntan y se devuelve una fila con id.
      const fila = { id: `fake-${tabla}-${llamadas.length}`, version: 1 };
      return objeto ? json(201, fila) : json(201, [fila]);
    }
    return json(404, { message: 'ruta desconocida' });
  };

  return {
    llamadas,
    proveedor,
    escrituras: (tabla: string) =>
      llamadas.filter((l) => l.url.pathname === `/rest/v1/${tabla}` && l.method !== 'GET' && l.method !== 'HEAD'),
    restaurar: () => {
      globalThis.fetch = original;
    },
  };
}

/** Una petición a la función como la haría la app. */
export function peticion(body: unknown, cabeceras: Record<string, string> = {}): Request {
  return new Request('http://localhost/functions/v1/x', {
    method: 'POST',
    headers: { authorization: `Bearer ${USER_TOKEN}`, 'content-type': 'application/json', ...cabeceras },
    body: JSON.stringify(body),
  });
}

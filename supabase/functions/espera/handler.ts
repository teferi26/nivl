// NIVL · Lista de espera de nivl.app (0054). Sin sesión: se despliega con
// --no-verify-jwt. Contrato para la web en docs/security-audit/lista-espera.md.
//
// Lo que hace aquí y no en SQL: CORS, método, tamaño, JSON, honeypot y
// consentimiento. Lo que hace en SQL (`waitlist_join`): normalizar y validar
// el correo, el freno por IP y por correo (con HMAC, sin IP en claro) y el
// alta idempotente. La respuesta nunca dice si el correo ya estaba.

/** Versión del texto de consentimiento que acepta la casilla. La fija el servidor. */
export const VERSION_CONSENTIMIENTO = 'espera-v1';
/**
 * Versión del texto según el idioma de la página (/espera en inglés y francés).
 * Lista blanca: el cliente solo elige el IDIOMA; la versión la pone el
 * servidor. 'es', ausente o cualquier otro valor → la versión en español.
 */
export const VERSIONES_POR_IDIOMA: Readonly<Record<string, string>> = Object.freeze({
  en: 'espera-v1.4-en',
  fr: 'espera-v1.4-fr',
});
export function versionDe(idioma: unknown): string {
  return typeof idioma === 'string' && Object.hasOwn(VERSIONES_POR_IDIOMA, idioma)
    ? VERSIONES_POR_IDIOMA[idioma]
    : VERSION_CONSENTIMIENTO;
}
// nivl-web.vercel.app sirve la misma web (los binarios 1.0.7 abren ahí los legales). www redirige a nivl.app.
export const ORIGENES_PERMITIDOS = ['https://nivl.app', 'https://nivl-web.vercel.app'];
const MAX_CUERPO = 2048;

export type ResultadoAlta = 'ok' | 'correo' | 'frenado';
export type Apuntar = (email: string, version: string, origen: string | null, ip: string) => Promise<ResultadoAlta>;

function cors(origin: string | null): Record<string, string> {
  if (!origin || !ORIGENES_PERMITIDOS.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(status: number, body: Record<string, unknown>, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cors(origin) },
  });
}

/** IP del cliente según el proxy de Supabase (primera de x-forwarded-for). */
export function ipDe(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') ?? '';
  return (xff.split(',')[0] ?? '').trim() || req.headers.get('cf-connecting-ip') || '';
}

/** Origen de la visita: utm, «bio» o «c:CODIGO». Lo que no encaje se descarta, no se rechaza. */
export function limpiarOrigen(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return /^[A-Za-z0-9_.:-]{1,64}$/.test(s) ? s : null;
}

export function esperaHandler(apuntar: Apuntar) {
  return async (req: Request): Promise<Response> => {
    const origin = req.headers.get('origin');
    const permitido = !!origin && ORIGENES_PERMITIDOS.includes(origin);

    if (req.method === 'OPTIONS') return new Response(null, { status: permitido ? 204 : 403, headers: cors(origin) });
    if (!permitido) return json(403, { error: 'origen' }, origin);
    if (req.method !== 'POST') return json(405, { error: 'metodo' }, origin);
    if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
      return json(415, { error: 'formato' }, origin);
    }

    const texto = await req.text().catch(() => '');
    if (texto.length > MAX_CUERPO) return json(413, { error: 'formato' }, origin);
    let cuerpo: Record<string, unknown>;
    try {
      const v = JSON.parse(texto);
      if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('no es un objeto');
      cuerpo = v as Record<string, unknown>;
    } catch {
      return json(400, { error: 'formato' }, origin);
    }

    // Honeypot: un humano no ve el campo. Se responde como un alta buena y no se guarda nada.
    if (typeof cuerpo.web === 'string' && cuerpo.web.trim() !== '') return json(200, { ok: true }, origin);
    if (cuerpo.consentimiento !== true) return json(400, { error: 'consentimiento' }, origin);
    if (typeof cuerpo.email !== 'string' || cuerpo.email.length > 254) return json(400, { error: 'correo' }, origin);

    try {
      const r = await apuntar(cuerpo.email, versionDe(cuerpo.idioma), limpiarOrigen(cuerpo.origen), ipDe(req));
      if (r === 'correo') return json(400, { error: 'correo' }, origin);
      if (r === 'frenado') return json(429, { error: 'frenado' }, origin);
      return json(200, { ok: true }, origin);
    } catch (e) {
      console.error('espera: fallo al apuntar', e instanceof Error ? e.message : 'desconocido');
      return json(500, { error: 'sistema' }, origin);
    }
  };
}

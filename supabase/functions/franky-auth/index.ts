// NIVL · Edge Function: la puerta de Franky.
//
// NIVL es de la gente de Franky: se entra con la cuenta de Franky y, si no la
// tienes, crearla desde aquí crea una cuenta Franky. Las dos plataformas viven
// en proyectos de Supabase distintos (esquemas incompatibles: las dos tienen
// `profiles`, `events`, `achievements`…), así que un JWT de Franky no vale en
// NIVL. Este puente lo resuelve sin duplicar contraseñas ni pedir dos cuentas:
//
//   1. Comprueba las credenciales contra Auth de Franky (signInWithPassword
//      con su clave pública, igual que hace la propia app de Franky).
//   2. Garantiza que existe un usuario NIVL con ese correo (lo crea confirmado
//      la primera vez, con el nombre que trae de Franky).
//   3. Emite un token de un solo uso (generateLink magiclink) y lo devuelve.
//      El móvil lo canjea con verifyOtp y obtiene una sesión NIVL normal.
//
// Registro: reenvía el alta a franky.es/api/auth/signup (el mismo endpoint
// que usa la web de Franky, con su política de contraseñas y su límite por
// IP) y a continuación hace el paso 1-3.
//
// Garantías:
//   · La contraseña viaja de la app a esta función por TLS y de aquí a Auth
//     de Franky por TLS. No se registra, no se guarda, no sale en ningún log.
//   · La sesión que Franky abre para verificar se cierra en el acto (scope
//     local: solo esa, no las demás sesiones del usuario en Franky).
//   · Sin JWT de entrada (--no-verify-jwt): quien llama todavía no tiene
//     sesión. Freno por IP aquí, más los límites propios de Auth de Franky.
//
// Despliegue:
//   supabase functions deploy franky-auth --no-verify-jwt
//   supabase secrets set FRANKY_SUPABASE_URL=https://<ref>.supabase.co \
//     FRANKY_SUPABASE_ANON_KEY=<clave pública de Franky> FRANKY_WEB_URL=https://franky.es

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FRANKY_URL = Deno.env.get('FRANKY_SUPABASE_URL') ?? '';
const FRANKY_ANON = Deno.env.get('FRANKY_SUPABASE_ANON_KEY') ?? '';
const FRANKY_WEB = (Deno.env.get('FRANKY_WEB_URL') ?? 'https://franky.es').replace(/\/$/, '');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Action = 'login' | 'register';

interface Body {
  action?: Action;
  email?: string;
  password?: string;
  name?: string;
}

class PuertaError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// ── Freno por IP ─────────────────────────────────────────────────────
// Best-effort: el aislado de una Edge Function es efímero, así que esto no
// sustituye a los límites de Auth de Franky (que aplican igual). Frena a un
// script que martillee la misma instancia; no castiga a un campus entero.
const LIMITE = 12;
const VENTANA_MS = 15 * 60_000;
const intentos = new Map<string, { n: number; hasta: number }>();

function frenar(ip: string): void {
  const ahora = Date.now();
  const v = intentos.get(ip);
  if (!v || v.hasta < ahora) {
    intentos.set(ip, { n: 1, hasta: ahora + VENTANA_MS });
    return;
  }
  v.n += 1;
  if (v.n > LIMITE) {
    throw new PuertaError('rate_limited', 429, 'Demasiados intentos. Espera unos minutos y reintenta.');
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

function limpiarEmail(raw: unknown): string {
  const e = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!e || e.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) {
    throw new PuertaError('invalid_email', 400, 'El correo no tiene un formato válido.');
  }
  return e;
}

function limpiarPassword(raw: unknown): string {
  const p = typeof raw === 'string' ? raw : '';
  if (!p || p.length > 200) {
    throw new PuertaError('invalid_password', 400, 'Escribe tu contraseña.');
  }
  return p;
}

// ── 0. Registro en Franky ────────────────────────────────────────────
async function registrarEnFranky(name: string, email: string, password: string): Promise<void> {
  const res = await fetch(`${FRANKY_WEB}/api/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'nivl-franky-auth/1' },
    body: JSON.stringify({
      name,
      email,
      password,
      attribution: { utm_source: 'nivl', utm_medium: 'app', signup_referrer: 'nivl' },
    }),
  });
  if (res.ok) return;

  let detalle: { error?: string; message?: string } = {};
  try {
    detalle = await res.json();
  } catch {
    /* sin cuerpo */
  }
  if (res.status === 409 || detalle.error === 'email_exists') {
    throw new PuertaError('email_exists', 409, 'Ese correo ya tiene cuenta en Franky. Entra con tu contraseña.');
  }
  if (res.status === 429) {
    throw new PuertaError('rate_limited', 429, 'Demasiados registros desde tu red. Espera un rato y reintenta.');
  }
  if (res.status === 400) {
    throw new PuertaError('invalid_signup', 400, detalle.message ?? 'Franky ha rechazado el alta. Revisa los datos.');
  }
  console.error('[franky-auth] signup en Franky falló', res.status, detalle.error ?? '');
  throw new PuertaError('signup_failed', 502, 'Franky no responde ahora mismo. Inténtalo en unos minutos.');
}

// ── 1. Comprobar credenciales contra Franky ──────────────────────────
async function verificarEnFranky(
  email: string,
  password: string,
): Promise<{ frankyId: string; fullName: string | null }> {
  const franky = createClient(FRANKY_URL, FRANKY_ANON, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await franky.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    const m = (error?.message ?? '').toLowerCase();
    if (m.includes('rate limit') || m.includes('too many')) {
      throw new PuertaError('rate_limited', 429, 'Demasiados intentos. Espera unos minutos y reintenta.');
    }
    if (m.includes('email not confirmed')) {
      throw new PuertaError('email_not_confirmed', 403, 'Confirma tu correo en Franky antes de entrar.');
    }
    throw new PuertaError(
      'invalid_credentials',
      401,
      'Correo o contraseña incorrectos. Si en Franky entras con Google, crea una contraseña en franky.es/recuperar.',
    );
  }
  // La sesión abierta para verificar no sirve para nada más: se revoca. Solo
  // ESTA (scope local); las sesiones del usuario en la app de Franky siguen.
  try {
    await franky.auth.signOut({ scope: 'local' });
  } catch {
    /* best-effort */
  }
  const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName = typeof meta.full_name === 'string' && meta.full_name.trim() ? meta.full_name.trim() : null;
  return { frankyId: data.user.id, fullName };
}

// ── 2 y 3. Usuario NIVL y token de un solo uso ───────────────────────
async function emitirTokenNivl(
  email: string,
  frankyId: string,
  fullName: string | null,
): Promise<{ tokenHash: string; created: boolean }> {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  let created = false;
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { franky_id: frankyId, ...(fullName ? { full_name: fullName } : {}) },
  });
  if (!createErr) {
    created = true;
  } else if (createErr.code !== 'email_exists' && !/already.*(registered|exists)/i.test(createErr.message)) {
    console.error('[franky-auth] createUser falló', createErr.code, createErr.message);
    throw new PuertaError('nivl_unavailable', 502, 'NIVL no ha podido preparar tu cuenta. Inténtalo en unos minutos.');
  }

  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    console.error('[franky-auth] generateLink falló', error?.code, error?.message);
    throw new PuertaError('nivl_unavailable', 502, 'NIVL no ha podido abrirte la puerta. Inténtalo en unos minutos.');
  }
  return { tokenHash, created };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  if (!FRANKY_URL || !FRANKY_ANON) {
    console.error('[franky-auth] faltan FRANKY_SUPABASE_URL / FRANKY_SUPABASE_ANON_KEY');
    return json(500, { error: 'misconfigured', message: 'La puerta de Franky no está configurada.' });
  }

  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconocida';
    frenar(ip);

    const body = (await req.json().catch(() => ({}))) as Body;
    const action: Action = body.action === 'register' ? 'register' : 'login';
    const email = limpiarEmail(body.email);
    const password = limpiarPassword(body.password);

    if (action === 'register') {
      const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
      if (!name) throw new PuertaError('invalid_name', 400, 'Escribe tu nombre.');
      await registrarEnFranky(name, email, password);
    }

    const { frankyId, fullName } = await verificarEnFranky(email, password);
    const { tokenHash, created } = await emitirTokenNivl(email, frankyId, fullName);

    return json(200, { token_hash: tokenHash, email, created, action });
  } catch (e) {
    if (e instanceof PuertaError) {
      return json(e.status, { error: e.code, message: e.message });
    }
    console.error('[franky-auth] error inesperado', e instanceof Error ? e.message : e);
    return json(500, { error: 'internal', message: 'Fallo inesperado en la puerta de Franky.' });
  }
});

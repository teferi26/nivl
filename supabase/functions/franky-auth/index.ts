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
//     sesión. Freno por IP y por correo aquí, más los límites de Auth de Franky.
//   · La cuenta NIVL queda atada al id de Franky (app_metadata.franky_id). Si
//     ya está atada a otro id, no se entrega sesión (409 account_conflict).
//   · Requisito de configuración (panel de Supabase de NIVL, no código): alta
//     pública DESACTIVADA y "Confirm email" ACTIVADO. Con alta abierta y
//     autoconfirmación, cualquiera puede crear en NIVL la cuenta de un correo
//     ajeno antes que su dueño (ver docs/security-audit/a-rls-auth.md).
//
// Despliegue:
//   supabase functions deploy franky-auth --no-verify-jwt
//   supabase secrets set FRANKY_SUPABASE_URL=https://<ref>.supabase.co \
//     FRANKY_SUPABASE_ANON_KEY=<clave pública de Franky> FRANKY_WEB_URL=https://franky.es

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  accionDe,
  decidirVinculo,
  Freno,
  ipDe,
  limpiarEmail,
  limpiarPassword,
  passwordAleatoria,
  PuertaError,
} from './logic.ts';

const FRANKY_URL = Deno.env.get('FRANKY_SUPABASE_URL') ?? '';
const FRANKY_ANON = Deno.env.get('FRANKY_SUPABASE_ANON_KEY') ?? '';
const FRANKY_WEB = (Deno.env.get('FRANKY_WEB_URL') ?? 'https://franky.es').replace(/\/$/, '');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Body {
  action?: unknown;
  email?: string;
  password?: string;
  name?: string;
}

// ── Frenos ───────────────────────────────────────────────────────────
// Por IP (best-effort: la cabecera puede venir del cliente) y por correo (no
// depende de cabeceras: frena el ataque dirigido a una cuenta concreta aunque
// cada intento llegue con una IP inventada). Los dos viven en la memoria del
// aislado; los límites reales siguen siendo los de Auth de Franky.
const VENTANA_MS = 15 * 60_000;
const frenoIp = new Freno(12, VENTANA_MS);
const frenoCorreo = new Freno(8, VENTANA_MS);
const DEMASIADOS = 'Demasiados intentos. Espera unos minutos y reintenta.';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
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
    throw new PuertaError('invalid_signup', 400, (typeof detalle.message === 'string' && detalle.message.trim() ? detalle.message.trim().slice(0, 200) : 'Franky ha rechazado el alta. Revisa los datos.'));
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
      throw new PuertaError('rate_limited', 429, DEMASIADOS);
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
// La cuenta NIVL se encuentra por correo pero se ATA a la cuenta Franky por
// su id, en `app_metadata.franky_id` (solo lo escribe el servidor). Sin ese
// vínculo, quien consiguiera una cuenta NIVL con el correo de otra persona
// (alta directa en Auth de NIVL o cambio de correo) recibiría la sesión de la
// víctima en cuanto esta entrara con Franky. Ver docs/security-audit/a-rls-auth.md.
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
    app_metadata: { franky_id: frankyId },
    user_metadata: fullName ? { full_name: fullName } : {},
  });
  if (!createErr) {
    created = true;
  } else if (createErr.code !== 'email_exists' && !/already.*(registered|exists)/i.test(createErr.message)) {
    console.error('[franky-auth] createUser falló', createErr.code);
    throw new PuertaError('nivl_unavailable', 502, 'NIVL no ha podido preparar tu cuenta. Inténtalo en unos minutos.');
  }

  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHash = data?.properties?.hashed_token;
  const usuario = data?.user;
  if (error || !tokenHash || !usuario) {
    console.error('[franky-auth] generateLink falló', error?.code);
    throw new PuertaError('nivl_unavailable', 502, 'NIVL no ha podido abrirte la puerta. Inténtalo en unos minutos.');
  }

  const { vinculo, reiniciarPassword } = decidirVinculo(usuario, frankyId);
  if (vinculo === 'conflicto') {
    // Sin correo ni ids en el registro: solo que pasó.
    console.error('[franky-auth] cuenta NIVL atada a otra cuenta Franky; no se entrega sesión');
    throw new PuertaError(
      'account_conflict',
      409,
      'Esta cuenta de NIVL pertenece a otra cuenta de Franky. Escríbenos desde soporte para recuperarla.',
    );
  }
  if (vinculo === 'vincular') {
    // Cuenta anterior al vínculo (o creada fuera del puente): se ata ahora. Si
    // no estaba confirmada, pudo crearla un tercero con signUp: su contraseña
    // se sustituye por una aleatoria en la MISMA llamada. Si no se puede atar,
    // no se entra: abrirla sin vínculo es justo el agujero.
    const { error: linkErr } = await admin.auth.admin.updateUserById(usuario.id, {
      app_metadata: { ...(usuario.app_metadata ?? {}), franky_id: frankyId },
      ...(reiniciarPassword ? { password: passwordAleatoria() } : {}),
    });
    if (linkErr) {
      console.error('[franky-auth] no se pudo vincular la cuenta', linkErr.code);
      throw new PuertaError('nivl_unavailable', 502, 'NIVL no ha podido abrirte la puerta. Inténtalo en unos minutos.');
    }
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
    if (!frenoIp.intentar(ipDe(req.headers))) throw new PuertaError('rate_limited', 429, DEMASIADOS);

    const body = (await req.json().catch(() => ({}))) as Body;
    const action = accionDe(body?.action);
    if (!action) return json(400, { error: 'invalid_action', message: 'Acción no admitida.' });
    const email = limpiarEmail(body.email);
    const password = limpiarPassword(body.password);
    if (!frenoCorreo.intentar(email)) throw new PuertaError('rate_limited', 429, DEMASIADOS);

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
    console.error('[franky-auth] error inesperado', e instanceof Error ? e.name : typeof e);
    return json(500, { error: 'internal', message: 'Fallo inesperado en la puerta de Franky.' });
  }
});

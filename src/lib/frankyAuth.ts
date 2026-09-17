// NIVL · Entrar con la cuenta de Franky.
//
// La app no habla con Auth de Franky directamente: llama a la Edge Function
// `franky-auth` (ver supabase/functions/franky-auth), que comprueba las
// credenciales en Franky, garantiza el usuario NIVL y devuelve un token de un
// solo uso. Aquí se canjea con verifyOtp y a partir de ahí la sesión es una
// sesión NIVL normal: AuthProvider la ve y la puerta de _layout redirige.

import { supabase } from './supabase';

export const FRANKY_WEB_URL = 'https://franky.es';
export const FRANKY_RECOVER_URL = `${FRANKY_WEB_URL}/recuperar`;
export const FRANKY_TERMS_URL = `${FRANKY_WEB_URL}/terminos`;
export const FRANKY_PRIVACY_URL = `${FRANKY_WEB_URL}/privacidad`;

interface PuertaRespuesta {
  token_hash?: string;
  created?: boolean;
  error?: string;
  message?: string;
}

export class FrankyAuthError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

function endpoint(): string {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  return `${base}/functions/v1/franky-auth`;
}

async function llamarPuerta(body: Record<string, string>): Promise<PuertaRespuesta> {
  let res: Response;
  try {
    res = await fetch(endpoint(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new FrankyAuthError('network', 'Sin conexión. Revisa tu red e inténtalo de nuevo.');
  }
  let data: PuertaRespuesta = {};
  try {
    data = (await res.json()) as PuertaRespuesta;
  } catch {
    /* sin cuerpo */
  }
  if (!res.ok || !data.token_hash) {
    throw new FrankyAuthError(
      data.error ?? `http_${res.status}`,
      data.message ?? 'La puerta de Franky no responde. Inténtalo en unos minutos.',
    );
  }
  return data;
}

async function canjear(tokenHash: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
  if (error) {
    throw new FrankyAuthError('exchange_failed', 'Franky te ha reconocido pero NIVL no ha podido abrir la sesión. Reintenta.');
  }
}

/** Entra en NIVL con el correo y la contraseña de Franky. */
export async function frankyLogin(email: string, password: string): Promise<void> {
  const r = await llamarPuerta({ action: 'login', email: email.trim(), password });
  await canjear(r.token_hash!);
}

/**
 * Crea la cuenta en Franky (misma política de contraseñas que su web) y entra.
 * Devuelve true si la cuenta NIVL es nueva (para llevarle al onboarding).
 */
export async function frankyRegister(name: string, email: string, password: string): Promise<boolean> {
  const r = await llamarPuerta({ action: 'register', name: name.trim(), email: email.trim(), password });
  await canjear(r.token_hash!);
  return r.created === true;
}

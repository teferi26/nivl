// NIVL · La cuenta propia (Supabase Auth de NIVL, sin puente de Franky).
//
// Contrato con las pantallas (Chat 4): login, registro, «he olvidado mi
// contraseña», el enlace del correo y el cierre de sesión pasan TODOS por aquí.
// Las pantallas no llaman a supabase.auth directamente.
//
// Errores: lo que el usuario puede arreglar llega como ErrorVisible en español
// (credenciales no válidas, correo sin confirmar, demasiados intentos,
// contraseña débil, enlace caducado). Todo lo demás se relanza tal cual y la
// pantalla lo pasa por mensajeSistema (sin conexión / fallo genérico).
//
// Anti-enumeración: ni el registro ni la recuperación dicen si un correo ya
// tiene cuenta. Con «Confirm email» activado en el panel, Supabase responde a
// un alta repetida igual que a una nueva; la recuperación responde siempre igual.

import * as Linking from 'expo-linking';
import { olvidarConsentimiento } from './consent';
import { olvidarCodigoPendiente } from './creators';
import { cancelarTodo } from './notifications';
import { setApiKey } from './oracle';
import { olvidarDispositivo } from './push';
import { supabase } from './supabase';
import { checkPassword, ErrorVisible, esErrorDeRed, isValidEmail, isValidName, NAME_MAX_LENGTH } from './validation';

// ── Rutas de los enlaces del correo ─────────────────────────────────
// En el binario: nivl://auth/confirmar y nivl://auth/restablecer (están en la
// allow list de Redirect URLs del panel). En Expo Go salen como exp://…/--/auth/…
export const RUTA_CONFIRMAR = 'auth/confirmar';
export const RUTA_RESTABLECER = 'auth/restablecer';

export function urlConfirmar(): string {
  return Linking.createURL(RUTA_CONFIRMAR);
}

export function urlRestablecer(): string {
  return Linking.createURL(RUTA_RESTABLECER);
}

// ── Mensajes ─────────────────────────────────────────────────────────
export const MSG_CREDENCIALES = 'Correo o contraseña incorrectos.';
export const MSG_SIN_CONFIRMAR = 'Confirma tu correo antes de entrar. Revisa tu bandeja de entrada y la de spam.';
export const MSG_DEMASIADOS = 'Demasiados intentos. Espera unos minutos y vuelve a probar.';
export const MSG_DEBIL =
  'Esa contraseña no vale: es demasiado corta, demasiado común o ha aparecido en filtraciones. Usa una frase larga que no uses en otro sitio.';
export const MSG_MISMA = 'La nueva contraseña tiene que ser distinta de la anterior.';
export const MSG_ENLACE = 'El enlace no es válido o ha caducado. Pide uno nuevo.';
export const MSG_ENLACE_OTRO_DISPOSITIVO =
  'No hemos podido abrir la sesión con este enlace. Ábrelo en el mismo móvil donde lo pediste o, si ya confirmaste el correo, entra con tu contraseña.';
export const MSG_CORREO = 'El correo no tiene un formato válido.';
export const MSG_SIN_SESION = 'Tu sesión ha caducado. Abre de nuevo el enlace del correo.';

interface ErrorAuthLike {
  code?: unknown;
  status?: unknown;
  message?: unknown;
  name?: unknown;
}

function campos(e: unknown): { code: string; status: number; message: string; name: string } {
  const o = (e && typeof e === 'object' ? e : {}) as ErrorAuthLike;
  return {
    code: typeof o.code === 'string' ? o.code : '',
    status: typeof o.status === 'number' ? o.status : 0,
    message: typeof o.message === 'string' ? o.message.toLowerCase() : '',
    name: typeof o.name === 'string' ? o.name : '',
  };
}

/**
 * Traduce un error de Supabase Auth. Devuelve ErrorVisible para lo que el
 * usuario puede arreglar; cualquier otra cosa vuelve tal cual (para
 * mensajeSistema). Nunca incluye el texto técnico ni datos de la cuenta.
 */
export function traducirErrorAuth(e: unknown): unknown {
  if (e instanceof ErrorVisible) return e;
  const { code, status, message } = campos(e);
  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return new ErrorVisible(MSG_CREDENCIALES);
  }
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return new ErrorVisible(MSG_SIN_CONFIRMAR);
  }
  if (status === 429 || code.startsWith('over_') || message.includes('rate limit') || message.includes('too many')) {
    return new ErrorVisible(MSG_DEMASIADOS);
  }
  if (code === 'weak_password' || message.includes('password should') || message.includes('weak password')) {
    return new ErrorVisible(MSG_DEBIL);
  }
  if (code === 'same_password') return new ErrorVisible(MSG_MISMA);
  return e;
}

function lanzar(e: unknown): never {
  throw traducirErrorAuth(e);
}

function limpiarCorreo(email: string): string {
  const e = email.trim().toLowerCase();
  if (!isValidEmail(e)) throw new ErrorVisible(MSG_CORREO);
  return e;
}

function exigirContrasenaNueva(password: string, email?: string): void {
  const r = checkPassword(password, email);
  if (!r.ok) throw new ErrorVisible(`La contraseña necesita: ${r.missing.join(', ')}.`);
}

// ── Registro, entrada y recuperación ─────────────────────────────────

/**
 * Crea la cuenta. 'sesion' si el servidor ya abre la sesión (confirmación de
 * correo desactivada); 'confirmar_email' si hay que pulsar el enlace del
 * correo. Un correo que YA tiene cuenta también da 'confirmar_email': no se
 * revela si existe.
 */
export async function registrar(email: string, password: string, nombre: string): Promise<'sesion' | 'confirmar_email'> {
  const correo = limpiarCorreo(email);
  if (!isValidName(nombre)) throw new ErrorVisible(`Escribe un nombre de 1 a ${NAME_MAX_LENGTH} caracteres.`);
  exigirContrasenaNueva(password, correo);
  const { data, error } = await supabase.auth.signUp({
    email: correo,
    password,
    options: { emailRedirectTo: urlConfirmar(), data: { full_name: nombre.trim() } },
  });
  if (error) {
    const { code, message } = campos(error);
    // Solo pasa con la confirmación desactivada en el panel: no se delata la cuenta.
    if (code === 'user_already_exists' || code === 'email_exists' || message.includes('already registered')) {
      return 'confirmar_email';
    }
    lanzar(error);
  }
  return data?.session ? 'sesion' : 'confirmar_email';
}

/** Entra con correo y contraseña de NIVL. */
export async function entrar(email: string, password: string): Promise<void> {
  const correo = limpiarCorreo(email);
  if (!password) throw new ErrorVisible(MSG_CREDENCIALES);
  const { error } = await supabase.auth.signInWithPassword({ email: correo, password });
  if (error) lanzar(error);
}

/**
 * Envía el correo de «restablecer contraseña». Responde SIEMPRE igual exista o
 * no la cuenta: los errores del servidor (cuenta inexistente, límite de envíos
 * por correo, …) se tragan. Solo se propaga un fallo de red, que no dice nada
 * de la cuenta y sí le sirve al usuario para reintentar.
 */
export async function pedirRecuperacion(email: string): Promise<void> {
  const correo = limpiarCorreo(email);
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(correo, { redirectTo: urlRestablecer() });
    if (error && esFalloDeRed(error)) throw error;
  } catch (e) {
    if (esFalloDeRed(e)) throw e;
  }
}

function esFalloDeRed(e: unknown): boolean {
  const { name, status } = campos(e);
  if (name === 'AuthRetryableFetchError') return true;
  return status === 0 && esErrorDeRed(e);
}

// ── El enlace del correo ─────────────────────────────────────────────

function sinQueryNiFragmento(url: string): string {
  return url.split(/[?#]/)[0];
}

function parametros(url: string): URLSearchParams {
  const p = new URLSearchParams();
  const q = url.indexOf('?');
  const h = url.indexOf('#');
  const query = q >= 0 ? url.slice(q + 1, h > q ? h : undefined) : '';
  const frag = h >= 0 ? url.slice(h + 1) : '';
  for (const parte of [query, frag]) {
    if (!parte) continue;
    new URLSearchParams(parte).forEach((v, k) => p.set(k, v));
  }
  return p;
}

/**
 * Canjea el enlace de confirmación o de recuperación que abre la app.
 *
 * Solo se aceptan las dos rutas propias (mismo esquema y ruta que se mandó en
 * el correo): cualquier otra URL se rechaza sin tocar la sesión. Admite PKCE
 * (`?code=`) y, por compatibilidad, el flujo implícito (`#access_token=…`).
 * Los tokens nunca se registran ni se devuelven.
 */
export async function completarEnlace(url: string): Promise<'confirmado' | 'recuperacion'> {
  if (typeof url !== 'string' || url.length > 4096) throw new ErrorVisible(MSG_ENLACE);
  const base = sinQueryNiFragmento(url);
  let destino: 'confirmado' | 'recuperacion';
  if (base === urlConfirmar()) destino = 'confirmado';
  else if (base === urlRestablecer()) destino = 'recuperacion';
  else throw new ErrorVisible(MSG_ENLACE);

  const p = parametros(url);
  if (p.get('error') || p.get('error_code') || p.get('error_description')) throw new ErrorVisible(MSG_ENLACE);
  if (p.get('type') === 'recovery') destino = 'recuperacion';

  const code = p.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      if (esFalloDeRed(error)) throw error;
      // Sin verificador (enlace abierto en otro móvil) o código usado/caducado.
      throw new ErrorVisible(destino === 'confirmado' ? MSG_ENLACE_OTRO_DISPOSITIVO : MSG_ENLACE);
    }
    return destino;
  }

  // Sin flujo implícito a propósito: aceptar `#access_token=…&refresh_token=…`
  // dejaría que un enlace fabricado abriera en este móvil la sesión de OTRA
  // cuenta (la del atacante) sin que nadie lo note. Con PKCE (supabase.ts) los
  // correos legítimos siempre traen `?code=`.
  throw new ErrorVisible(MSG_ENLACE);
}

/** Cambia la contraseña de la sesión abierta (p. ej. tras el enlace de recuperación). */
export async function cambiarContrasena(nueva: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const sesion = data?.session;
  if (!sesion) throw new ErrorVisible(MSG_SIN_SESION);
  exigirContrasenaNueva(nueva, sesion.user?.email ?? undefined);
  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) lanzar(error);
}

// ── Cerrar sesión ────────────────────────────────────────────────────

/**
 * Cerrar sesión de verdad en un móvil que puede pasar a otra persona.
 *
 * Lo que quedaba en el dispositivo tras un signOut pelado era del usuario
 * anterior y le llegaba al siguiente (docs/security-audit/a-rls-auth.md, A-04):
 *   · el token push seguía a su nombre en `push_tokens` (la RLS impide que el
 *     siguiente se lo quede), así que los avisos del coach del anterior —con
 *     su contenido— seguían sonando en este móvil;
 *   · los recordatorios locales programados llevan títulos de sus misiones;
 *   · la key del Oráculo, el consentimiento recordado y el código de creador.
 *
 * El token se borra ANTES del signOut: la RLS de push_tokens solo deja borrar
 * con la sesión del dueño. Cada paso va aislado: ninguno impide cerrar la
 * sesión. RevenueCat lo suelta `_layout` al ver la sesión a null.
 */
export async function cerrarSesion(): Promise<void> {
  await Promise.allSettled([
    olvidarDispositivo(),
    cancelarTodo(),
    setApiKey(''),
    olvidarCodigoPendiente(),
    Promise.resolve().then(olvidarConsentimiento),
  ]);
  await cerrarSoloSesion();
}

/**
 * Solo la sesión, sin lo del dispositivo. Es el cierre del portal de
 * creadores (`src/lib/sitio.ts`), donde no hay avisos, push, Oráculo ni
 * consentimiento que olvidar.
 */
export async function cerrarSoloSesion(): Promise<void> {
  // global: revoca también el refresh token en el servidor. Si la red falla,
  // al menos se cierra aquí (supabase-js no borra la sesión local si el
  // servidor no contesta).
  const { error } = await supabase.auth.signOut().catch((e: unknown) => ({ error: e }));
  if (error) await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
}

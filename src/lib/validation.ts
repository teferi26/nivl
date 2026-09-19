// Validación pura de credenciales (sin dependencias) — testeable en aislamiento.
//
// La política de contraseñas es la de Franky (web/src/lib/password-strength.ts),
// alineada con NIST SP 800-63B: longitud mínima de 12, sin reglas de
// composición obligatorias y rechazo de lo evidentemente basura. Una cuenta
// creada desde NIVL es una cuenta Franky, así que las reglas tienen que ser
// las mismas o el servidor rechazaría lo que la app dio por bueno.

export function isValidEmail(email: string): boolean {
  const e = email.trim();
  if (e.length > 254) return false;
  // Cubre el 99% real: algo@algo.tld, sin espacios, TLD de 2+ letras.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
}

export type PasswordStrength = 'debil' | 'media' | 'fuerte';

export interface PasswordCheck {
  ok: boolean; // cumple el mínimo para registrarse
  strength: PasswordStrength;
  score: number; // 0..4
  missing: string[]; // qué le falta para poder registrarse
}

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 200;

export function checkPassword(password: string): PasswordCheck {
  const missing: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) missing.push(`${PASSWORD_MIN_LENGTH} caracteres (una frase vale)`);
  if (password.length > PASSWORD_MAX_LENGTH) missing.push(`no pasar de ${PASSWORD_MAX_LENGTH} caracteres`);
  if (password.length > 0 && new Set(password).size < 5) missing.push('más variedad de caracteres');
  if (password.length > 0 && /^\s+$/.test(password)) missing.push('algo más que espacios');

  // La longitud manda: es lo que de verdad mueve la entropía. Una frase larga
  // en minúsculas puntúa más que "Aa1!aa1!" y eso es lo correcto.
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score += 2;
  if (password.length >= 16) score++;
  if (password.length >= 20) score++;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  if (classes >= 2) score++;
  if (classes >= 3) score++;
  if (new Set(password).size >= 10) score++;
  if (/(.)\1{2,}/.test(password)) score--;
  if (/(?:0123|1234|2345|3456|4567|5678|6789|abcd|qwer)/i.test(password)) score--;
  if (/^(password|contrase|qwerty|letmein|admin|123456|iloveyou)/i.test(password)) score = 0;
  score = Math.max(0, Math.min(4, Math.round(score / 2)));

  const strength: PasswordStrength = score <= 1 ? 'debil' : score <= 2 ? 'media' : 'fuerte';
  return { ok: missing.length === 0, strength, score, missing };
}

/** Nombre visible: lo que Franky acepta (1-80) recortado a lo que NIVL pinta (24). */
export const NAME_MAX_LENGTH = 24;

export function isValidName(name: string): boolean {
  const n = name.trim();
  return n.length >= 1 && n.length <= NAME_MAX_LENGTH;
}

// ── Errores que llegan al usuario ───────────────────────────────────
// Un `e.message` en crudo es inglés de PostgREST o de fetch ("TypeError:
// Network request failed", "JWT expired"): no es la voz del sistema y no le
// dice a nadie qué hacer. Toda alerta o aviso en pantalla pasa por aquí.

/**
 * Un error cuyo mensaje YA está escrito para el usuario (un código de amigo
 * que no existe, un tope alcanzado). `mensajeSistema` lo deja pasar tal cual.
 */
export class ErrorVisible extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErrorVisible';
  }
}

export const MENSAJE_SIN_CONEXION = 'Sin conexión. El sistema lo reintentará cuando vuelvas a tener red.';
export const MENSAJE_FALLO = 'El sistema no ha podido completar la operación.';

const PISTAS_DE_RED = /network|fetch|timeout|timed out|connection|offline|internet|abort|socket|ECONN|ENOTFOUND/i;

function textoDe(e: unknown): string {
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object') {
    const o = e as { message?: unknown; name?: unknown };
    return `${typeof o.name === 'string' ? o.name : ''} ${typeof o.message === 'string' ? o.message : ''}`;
  }
  return '';
}

/** ¿Parece un fallo de red (sin cobertura, tiempo agotado, petición abortada)? */
export function esErrorDeRed(e: unknown): boolean {
  return PISTAS_DE_RED.test(textoDe(e));
}

/** La frase que se enseña cuando algo falla. Nunca el mensaje técnico. */
export function mensajeSistema(e: unknown): string {
  if (e instanceof ErrorVisible) return e.message;
  return esErrorDeRed(e) ? MENSAJE_SIN_CONEXION : MENSAJE_FALLO;
}

// Validación pura de credenciales (sin dependencias) — testeable en aislamiento.

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
  missing: string[]; // qué le falta para ser fuerte
}

const MIN_LENGTH = 8;

export function checkPassword(password: string): PasswordCheck {
  const missing: string[] = [];
  if (password.length < MIN_LENGTH) missing.push(`${MIN_LENGTH} caracteres`);
  if (!/[a-z]/.test(password)) missing.push('una minúscula');
  if (!/[A-Z]/.test(password)) missing.push('una mayúscula');
  if (!/[0-9]/.test(password)) missing.push('un número');

  let score = 0;
  if (password.length >= MIN_LENGTH) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  score = Math.min(4, score);

  const strength: PasswordStrength = score <= 1 ? 'debil' : score <= 3 ? 'media' : 'fuerte';
  // Mínimo para registrar: 8 caracteres (más estricto que el 6 por defecto de Supabase).
  const ok = password.length >= MIN_LENGTH;
  return { ok, strength, score, missing };
}

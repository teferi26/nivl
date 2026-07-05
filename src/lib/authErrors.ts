// Traduce los errores (en inglés) de Supabase Auth a la voz del sistema en español.
export function mapAuthError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (m.includes('email not confirmed')) return 'Confirma tu correo antes de entrar. Revisa tu bandeja.';
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'Ese correo ya tiene una cuenta. Entra en su lugar.';
  }
  if (m.includes('password should be at least') || m.includes('password is too short')) {
    return 'La contraseña es demasiado corta.';
  }
  if (m.includes('unable to validate email') || m.includes('invalid format') || m.includes('invalid email')) {
    return 'El correo no tiene un formato válido.';
  }
  if (m.includes('rate limit') || m.includes('too many requests') || m.includes('over_email_send_rate')) {
    return 'Demasiados intentos. Espera un momento y reintenta.';
  }
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) {
    return 'El registro está desactivado en el servidor.';
  }
  if (m.includes('network') || m.includes('failed to fetch') || m.includes('fetch')) {
    return 'Sin conexión. Revisa tu red e inténtalo de nuevo.';
  }
  return raw;
}

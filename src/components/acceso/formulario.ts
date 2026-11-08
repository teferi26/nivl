// NIVL · Acceso: qué deja hacer el formulario de entrar (puro, sin React).
//
// Las reglas son las de `src/lib/validation.ts` (no cambian): aquí solo se
// decide qué mensaje sale y cuándo, igual que antes en login.tsx. Lo usan el
// hook (para enviar) y la vista (para pintar), y así la galería pinta los
// mismos errores sin sesión.

import { t } from '@/i18n';
import {
  checkPassword,
  isValidEmail,
  PASSWORD_MIN_LENGTH,
  type PasswordStrength,
} from '@/lib/validation';

export type ModoLogin = 'signin' | 'signup' | 'recover';

export interface CamposLogin {
  correo: string;
  contrasena: string;
  aceptado: boolean;
}

export type CampoTocable = 'correo' | 'contrasena';
export type Tocados = Record<CampoTocable, boolean>;

export const SIN_TOCAR: Tocados = { correo: false, contrasena: false };

/**
 * Nombre con el que nace la cuenta: el alta ya no lo pide (N6, N9) y
 * `registrar` lo exige. Es el nombre por defecto de la base de datos y el
 * onboarding lo pregunta después.
 */
export const NOMBRE_POR_DEFECTO = 'Gladiador'; // i18n-ok: valor de la base de datos, no se enseña como texto de interfaz

/** Segundos de bloqueo del botón «Reenviar correo» tras pulsarlo. */
export const ESPERA_REENVIO_S = 60;

/** Segundos que faltan hasta `hasta` (ms), redondeados hacia arriba. */
export function segundosRestantes(hasta: number, ahora: number): number {
  return Math.max(0, Math.ceil((hasta - ahora) / 1000));
}

/** Segmentos llenos de la barra de fuerza (de 4). */
const SEGMENTOS: Record<PasswordStrength, number> = { debil: 1, media: 3, fuerte: 4 };

/** Segmentos llenos de la barra de fuerza (de 4) y su nombre. */
export function fuerzaDe(fuerza: PasswordStrength): { segmentos: number; etiqueta: string } {
  return { segmentos: SEGMENTOS[fuerza], etiqueta: t(`acceso:fuerza.${fuerza}`) };
}

// Anti-enumeración: valen igual exista o no la cuenta (contrato de authFlow).
export function avisoRegistro(): string {
  return t('acceso:aviso.registro');
}
export function avisoRecuperacion(): string {
  return t('acceso:aviso.recuperacion');
}
export function avisoReenviado(): string {
  return t('acceso:login.reenviar.enviado');
}

/**
 * @deprecated Usa `avisoRecuperacion()`. Alias congelado, igual al texto de
 * `acceso:aviso.recuperacion` en español, solo para la galería (demo.tsx).
 */
// i18n-ok: alias congelado de acceso:aviso.recuperacion, ver arriba
export const AVISO_RECUPERACION = 'Si ese correo tiene cuenta, te hemos enviado un enlace. Ábrelo en este móvil para elegir una contraseña nueva.';

export function ayudaContrasena(): string {
  return t('acceso:ayudaContrasena', { n: PASSWORD_MIN_LENGTH });
}

export interface EvaluacionLogin {
  puedeEnviar: boolean;
  errorCorreo: string | null;
  /** Solo al crear cuenta y con algo escrito. */
  fuerza: { segmentos: number; etiqueta: string } | null;
  /** Lo que le falta a la contraseña para poder registrarse. */
  faltas: string[];
}

export function evaluarLogin(modo: ModoLogin, c: CamposLogin, tocados: Tocados): EvaluacionLogin {
  const correoValido = isValidEmail(c.correo);
  const pw = checkPassword(c.contrasena, c.correo);
  const alta = modo === 'signup';

  const puedeEnviar =
    modo === 'signin'
      ? correoValido && c.contrasena.length > 0
      : modo === 'recover'
        ? correoValido
        : correoValido && pw.ok && c.aceptado;

  return {
    puedeEnviar,
    errorCorreo: tocados.correo && c.correo.length > 0 && !correoValido ? t('acceso:error.correo') : null,
    fuerza: alta && c.contrasena.length > 0 ? fuerzaDe(pw.strength) : null,
    faltas: alta && c.contrasena.length > 0 ? pw.missing : [],
  };
}

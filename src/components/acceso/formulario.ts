// NIVL · Acceso: qué deja hacer el formulario de entrar (puro, sin React).
//
// Las reglas son las de `src/lib/validation.ts` (no cambian): aquí solo se
// decide qué mensaje sale y cuándo, igual que antes en login.tsx. Lo usan el
// hook (para enviar) y la vista (para pintar), y así la galería pinta los
// mismos errores sin sesión.

import {
  checkPassword,
  isValidEmail,
  isValidName,
  NAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  type PasswordStrength,
} from '@/lib/validation';

export type ModoLogin = 'signin' | 'signup' | 'recover';

export interface CamposLogin {
  nombre: string;
  correo: string;
  contrasena: string;
  repite: string;
  aceptado: boolean;
}

export type CampoTocable = 'nombre' | 'correo' | 'contrasena' | 'repite';
export type Tocados = Record<CampoTocable, boolean>;

export const SIN_TOCAR: Tocados = { nombre: false, correo: false, contrasena: false, repite: false };

/** Segmentos llenos de la barra de fuerza (de 4) y su nombre. */
export const FUERZA: Record<PasswordStrength, { segmentos: number; etiqueta: string }> = {
  debil: { segmentos: 1, etiqueta: 'Débil' },
  media: { segmentos: 3, etiqueta: 'Media' },
  fuerte: { segmentos: 4, etiqueta: 'Fuerte' },
};

// Anti-enumeración: valen igual exista o no la cuenta (contrato de authFlow).
export const AVISO_REGISTRO =
  'Si el correo es nuevo, te hemos enviado un enlace para confirmarlo. Ábrelo en este móvil y después entra con tu contraseña.';
export const AVISO_RECUPERACION =
  'Si ese correo tiene cuenta, te hemos enviado un enlace. Ábrelo en este móvil para elegir una contraseña nueva.';

export const AYUDA_CONTRASENA = `Sin reglas raras: ${PASSWORD_MIN_LENGTH} caracteres o más. Una frase que recuerdes es perfecta.`;

export interface EvaluacionLogin {
  puedeEnviar: boolean;
  errorNombre: string | null;
  errorCorreo: string | null;
  errorRepite: string | null;
  /** Solo al crear cuenta y con algo escrito. */
  fuerza: { segmentos: number; etiqueta: string } | null;
  /** Lo que le falta a la contraseña para poder registrarse. */
  faltas: string[];
}

export function evaluarLogin(modo: ModoLogin, c: CamposLogin, tocados: Tocados): EvaluacionLogin {
  const correoValido = isValidEmail(c.correo);
  const nombreValido = isValidName(c.nombre);
  const pw = checkPassword(c.contrasena, c.correo);
  const coinciden = c.contrasena === c.repite;
  const alta = modo === 'signup';

  const puedeEnviar =
    modo === 'signin'
      ? correoValido && c.contrasena.length > 0
      : modo === 'recover'
        ? correoValido
        : nombreValido && correoValido && pw.ok && coinciden && c.aceptado;

  return {
    puedeEnviar,
    errorNombre:
      alta && tocados.nombre && c.nombre.length > 0 && !nombreValido ? `Entre 1 y ${NAME_MAX_LENGTH} caracteres.` : null,
    errorCorreo: tocados.correo && c.correo.length > 0 && !correoValido ? 'Formato de correo no válido.' : null,
    errorRepite: alta && tocados.repite && c.repite.length > 0 && !coinciden ? 'Las contraseñas no coinciden.' : null,
    fuerza: alta && c.contrasena.length > 0 ? FUERZA[pw.strength] : null,
    faltas: alta && c.contrasena.length > 0 ? pw.missing : [],
  };
}

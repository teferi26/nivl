// NIVL · Idiomas: la preferencia y `profiles.locale` (efectos, con Supabase).
//
// Aparte de index.ts a propósito: importar supabase arrastra AsyncStorage y
// '@/i18n' tiene que poder importarse en cualquier prueba.
//
// Tolerante con la migración (la hace Seguridad): si `profiles.locale` aún no
// existe, se lee solo `onboarding_done`, no se escribe nada y la app sigue.
// Ningún fallo de aquí llega al gladiador.

import { supabase } from '@/lib/supabase';
import {
  alCambiar,
  cargarPreferencia,
  decidirPreferenciaInicial,
  fijarPreferencia,
  idiomaCoach,
  idiomaDispositivo,
  preferenciaIdioma,
  type Idioma,
} from './index';
import { guardarCuentaPreferencia, leerCuentaPreferencia } from './preferencia';

export interface IdiomaPerfil {
  onboardingHecho: boolean;
  /** undefined: la columna `locale` aún no existe en esta base de datos. */
  locale: string | null | undefined;
}

/** `onboarding_done` y `locale` del perfil, o null si no se puede leer. */
export async function leerIdiomaPerfil(userId: string): Promise<IdiomaPerfil | null> {
  try {
    const con = await supabase.from('profiles').select('onboarding_done, locale').eq('id', userId).maybeSingle();
    if (!con.error && con.data) {
      const fila = con.data as { onboarding_done?: boolean | null; locale?: string | null };
      return { onboardingHecho: !!fila.onboarding_done, locale: fila.locale ?? null };
    }
    // Sin la columna (42703) o cualquier otro fallo: se prueba sin ella.
    const sin = await supabase.from('profiles').select('onboarding_done').eq('id', userId).maybeSingle();
    if (sin.error || !sin.data) return null;
    const fila = sin.data as { onboarding_done?: boolean | null };
    return { onboardingHecho: !!fila.onboarding_done, locale: undefined };
  } catch {
    return null;
  }
}

/** Escribe el idioma efectivo en el perfil. Nunca lanza: false si no se ha podido. */
export async function escribirIdiomaPerfil(userId: string, locale: Idioma): Promise<boolean> {
  try {
    const { error } = await supabase.from('profiles').update({ locale }).eq('id', userId);
    return !error;
  } catch {
    return false;
  }
}

// Lo último que hay (o se está escribiendo) en `profiles.locale` de cada
// usuario: así el selector de Perfil y el oyente de abajo no escriben dos
// veces lo mismo. `locale: undefined` = la columna aún no existe: no se escribe.
let ultimo: { userId: string; locale: string | null | undefined } | null = null;

/**
 * Deja en `profiles.locale` el idioma efectivo del coach si ha cambiado. Con
 * la preferencia aún sin conocer, o sin la columna, no hace nada. Nunca lanza.
 */
export async function asegurarIdiomaPerfil(userId: string): Promise<boolean> {
  if (preferenciaIdioma() === null) return false;
  const previo = ultimo?.userId === userId ? ultimo.locale : null;
  if (ultimo?.userId === userId && previo === undefined) return false;
  const coach = idiomaCoach();
  if (previo === coach) return true;
  ultimo = { userId, locale: coach };
  const ok = await escribirIdiomaPerfil(userId, coach);
  if (!ok && ultimo?.userId === userId && ultimo.locale === coach) ultimo = { userId, locale: previo };
  return ok;
}

/**
 * Al entrar con sesión: carga la preferencia del teléfono, aplica la regla de
 * arranque si no la hay (cuentas existentes → `es`; nuevas → `auto`) y deja
 * `profiles.locale` con el idioma efectivo del coach. Después, cada cambio de
 * preferencia o de idioma del teléfono (con `auto`) se vuelve a escribir.
 * Devuelve cómo pararlo (al cerrar sesión o cambiar de usuario).
 */
export function sincronizarIdioma(userId: string): () => void {
  let vivo = true;
  let listo = false;

  const dejar = alCambiar(() => {
    if (vivo && listo) void asegurarIdiomaPerfil(userId);
  });

  void (async () => {
    const guardada = await cargarPreferencia();
    const perfil = await leerIdiomaPerfil(userId);
    if (!vivo || !perfil) return;
    ultimo = { userId, locale: perfil.locale };
    // La preferencia es del teléfono, pero si entra otra cuenta que ya tiene
    // idioma en su perfil (columna 0066), manda el de esa cuenta.
    const cuenta = await leerCuentaPreferencia();
    const otraCuenta = cuenta !== null && cuenta !== userId;
    if (guardada === null || otraCuenta) {
      const d = decidirPreferenciaInicial({
        guardada,
        onboardingHecho: perfil.onboardingHecho,
        locale: perfil.locale,
        dispositivo: idiomaDispositivo(),
        otraCuenta,
      });
      if (d.guardar) await fijarPreferencia(d.preferencia);
    }
    await guardarCuentaPreferencia(userId);
    if (!vivo) return;
    listo = true;
    await asegurarIdiomaPerfil(userId);
  })();

  return () => {
    vivo = false;
    dejar();
  };
}

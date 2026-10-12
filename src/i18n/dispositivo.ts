// NIVL · Idiomas: el idioma del teléfono, sin código nativo.
//
// En 1.0.10 no entra expo-localization (es nativo y su plugin declararía
// idiomas que la app aún no tiene; plan §Decisiones técnicas). Se lee con lo
// que ya trae react-native:
//   · iOS: Settings.get('AppleLanguages') (o 'AppleLocale');
//   · Android: I18nManager.getConstants().localeIdentifier;
//   · web: navigator.languages / navigator.language;
//   · en último recurso: Intl.
// Todo va en try/catch: si nada responde, null (y quien pregunta usa `es`).
// Se vuelve a leer al volver la app a primer plano: el gladiador puede haber
// cambiado el idioma del teléfono en Ajustes.

import { AppState, I18nManager, Platform, Settings } from 'react-native';

/**
 * Deja un identificador de idioma en BCP 47 corto: «en_US» → «en-US»,
 * «zh-Hans-CN» → «zh-CN», «sr_RS@latin» → «sr-RS», «ES» → «es». Sin idioma
 * reconocible, null.
 */
export function normalizarBcp47(crudo: unknown): string | null {
  if (typeof crudo !== 'string') return null;
  const limpio = crudo.trim().split('@')[0]!.split('.')[0]!;
  const partes = limpio.split(/[-_]/).filter(Boolean);
  const idioma = partes[0]?.toLowerCase();
  if (!idioma || !/^[a-z]{2,3}$/.test(idioma)) return null;
  // La región: dos letras o tres cifras (es-419). La escritura (Hans) se salta.
  const region = partes.slice(1).find((p) => /^[a-z]{2}$/i.test(p) || /^\d{3}$/.test(p));
  return region ? `${idioma}-${region.toUpperCase()}` : idioma;
}

/** La parte de idioma de un BCP 47: «pt-BR» → «pt». */
export function idiomaBase(bcp47: string | null): string | null {
  return bcp47 ? (bcp47.split('-')[0] ?? null) : null;
}

function leerCrudo(): unknown {
  try {
    if (Platform.OS === 'ios') {
      const lista: unknown = Settings?.get?.('AppleLanguages');
      if (Array.isArray(lista) && typeof lista[0] === 'string') return lista[0];
      const locale: unknown = Settings?.get?.('AppleLocale');
      if (typeof locale === 'string' && locale) return locale;
    } else if (Platform.OS === 'android') {
      const id = I18nManager?.getConstants?.().localeIdentifier;
      if (id) return id;
    } else if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      const lista = navigator.languages;
      if (lista && lista.length > 0 && lista[0]) return lista[0];
      if (navigator.language) return navigator.language;
    }
  } catch {
    // Sigue con Intl.
  }
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return null;
  }
}

let cache: string | null | undefined;

/** El idioma del teléfono en BCP 47 («es-ES», «en-US»), o null si no se sabe. */
export function idiomaDispositivo(): string | null {
  if (cache === undefined) cache = normalizarBcp47(leerCrudo());
  return cache;
}

/** Vuelve a leerlo (al volver a primer plano). Devuelve true si ha cambiado. */
export function releerDispositivo(): boolean {
  const antes = cache;
  cache = normalizarBcp47(leerCrudo());
  return antes !== undefined && antes !== cache;
}

/**
 * Avisa cuando el idioma del teléfono cambia (se mira al volver a primer
 * plano). Devuelve la función para dejar de escuchar.
 */
export function escucharDispositivo(alCambiar: () => void): () => void {
  try {
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active' && releerDispositivo()) alCambiar();
    });
    return () => sub.remove();
  } catch {
    return () => {};
  }
}

/** Solo pruebas: olvida lo leído. */
export function __olvidarDispositivo(): void {
  cache = undefined;
}

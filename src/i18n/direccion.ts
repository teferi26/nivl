// NIVL · Idiomas: la dirección de escritura (derecha a izquierda).
//
// Preparado para Modos F1 y SIN ACTIVAR: ningún idioma RTL está en IDIOMAS, así
// que `aplicarDireccion` con cualquier idioma de hoy deja la app como está (de
// izquierda a derecha) y no pide reinicio. Qué falta para encender el árabe, el
// persa, el urdu o el hebreo: docs/modos/F1-idiomas.md §RTL.
//
// React Native solo cambia la dirección al arrancar: `I18nManager.forceRTL`
// guarda la decisión y vale desde el siguiente arranque. Por eso devuelve si
// hace falta reiniciar (expo-updates `reloadAsync`, o pedirlo al gladiador).

import { I18nManager } from 'react-native';

/** Los idiomas que se escriben de derecha a izquierda (por código BCP 47 base). */
export const IDIOMAS_RTL = ['ar', 'fa', 'ur', 'he'] as const;

/** ¿Se escribe de derecha a izquierda? «ar», «ar-EG», «he» → true. */
export function esRTL(idioma: string | null | undefined): boolean {
  if (!idioma) return false;
  const base = idioma.split('-')[0]!.toLowerCase();
  return (IDIOMAS_RTL as readonly string[]).includes(base);
}

/** La dirección que pinta ahora React Native. */
export function direccionActual(): 'rtl' | 'ltr' {
  try {
    return I18nManager.isRTL ? 'rtl' : 'ltr';
  } catch {
    return 'ltr';
  }
}

/**
 * Deja guardada la dirección que pide `idioma`. Devuelve true si cambia (y
 * entonces solo se ve tras reiniciar la app). Con un idioma de izquierda a
 * derecha y la app ya en LTR, no toca nada. Nunca lanza.
 */
export function aplicarDireccion(idioma: string): boolean {
  const rtl = esRTL(idioma);
  try {
    if (!!I18nManager.isRTL === rtl) return false;
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
    return true;
  } catch {
    return false;
  }
}

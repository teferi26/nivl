// NIVL · Cifra sin dato: se pinta con un guion corto y el lector de pantalla
// oye «sin dato» en vez de «guion».

import { t } from '@/i18n';

export const SIN_DATO = '-';

/** Lo que oye el lector en vez del guion (`comun:sinDato`). Úsalo al pintar. */
export function leidoSinDato(): string {
  return t('comun:sinDato');
}

/**
 * @deprecated Usa `leidoSinDato()`: una constante no cambia de idioma. Se
 * queda, igual al texto de `comun:sinDato` en español, para el código que aún
 * no se ha migrado (tandas 5 a 7) y para sindato.test.ts.
 */
export const LEIDO_SIN_DATO = 'sin dato'; // i18n-ok: alias congelado de comun:sinDato, ver arriba

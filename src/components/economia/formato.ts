// NIVL · Economía: cómo se escriben los importes (copiado de la ruta vieja).
// Desde 1.0.10 lo hacen `decimal` y `moneda` de @/i18n/formato (igual en es).

import { decimal, moneda } from '@/i18n/formato';

export const num = (n: number, dec = 0) => decimal(n, dec);
export const eur = (n: number, dec = 0) => moneda(n, dec);
/** Con signo: negativo es gasto, positivo ingreso. El signo es la información. */
export const eurSigno = (n: number) => `${n < 0 ? '−' : '+'}${eur(Math.abs(n), 2)}`;

// NIVL · WORK y FOUNDER: las cifras de dinero, siempre con separador de miles y
// dos decimales (puro, con test).
//
// A mano y por tabla a propósito: `toLocaleString('es-ES')` no agrupa cuatro
// cifras («2150,50 €» frente a «12.450,50 €»), lo mismo le pasa a pt-PT, y en
// Hermes Intl depende del motor. Aquí la misma cantidad se lee igual siempre.

import { idiomaInterfazActual, type IdiomaInterfaz } from '@/i18n/estado';

const FORMATO: Record<IdiomaInterfaz, { miles: string; decimal: string; delante: boolean }> = {
  es: { miles: '.', decimal: ',', delante: false },
  xx: { miles: '.', decimal: ',', delante: false },
  en: { miles: ',', decimal: '.', delante: true },
  fr: { miles: ' ', decimal: ',', delante: false },
  pt: { miles: '.', decimal: ',', delante: false },
  de: { miles: '.', decimal: ',', delante: false },
  it: { miles: '.', decimal: ',', delante: false },
};

/** «1.234,50 €», «−12,00 €». Un no finito, «-». */
export function euros(n: number, idioma: IdiomaInterfaz = idiomaInterfazActual()): string {
  if (!Number.isFinite(n)) return '-';
  const f = FORMATO[idioma] ?? FORMATO.es;
  const centimos = Math.round(Math.abs(n) * 100);
  const enteros = String(Math.floor(centimos / 100)).replace(/\B(?=(\d{3})+$)/g, f.miles);
  const cifra = `${enteros}${f.decimal}${String(centimos % 100).padStart(2, '0')}`;
  const signo = n < 0 && centimos > 0 ? '−' : '';
  return f.delante ? `${signo}€${cifra}` : `${signo}${cifra} €`;
}

/** Con signo: «−12,50 €» / «+2.150,00 €». El signo es la información. */
export function eurosSigno(n: number, idioma: IdiomaInterfaz = idiomaInterfazActual()): string {
  return `${n < 0 ? '−' : '+'}${euros(Math.abs(n), idioma)}`;
}

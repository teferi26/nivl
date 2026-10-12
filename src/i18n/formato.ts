// NIVL · Idiomas: cifras, fechas y moneda (puro, con test).
//
// Para `es` el resultado es EXACTAMENTE el de antes de 1.0.10 (formato.test.ts
// lo fija): la agrupación de miles va a mano («1.840»; `toLocaleString('es-ES')`
// no agrupa cuatro cifras y en Hermes depende de Intl) y los meses y días van
// escritos. Intl solo se usa para el resto de idiomas, y si falla se vuelve a
// lo de `es`. El pseudoidioma `xx` formatea como `es`.
//
// arena/cifras.ts (formatoMiles), components/fecha.ts (fechaCorta) y
// economia/formato.ts (num, eur) delegan aquí y conservan sus exports.

import { idiomaInterfazActual, type IdiomaInterfaz } from './estado';

/** Cifra vacía: un guion, nunca la raya larga (SISTEMA.md §0). */
const VACIA = '-';

const esEspanol = (idioma: IdiomaInterfaz) => idioma === 'es' || idioma === 'xx';

function milesEs(n: number): string {
  const r = Math.round(n);
  const signo = r < 0 ? '-' : '';
  const digitos = String(Math.abs(r));
  let out = '';
  for (let i = 0; i < digitos.length; i++) {
    const quedan = digitos.length - i;
    out += digitos[i];
    if (quedan > 1 && (quedan - 1) % 3 === 0) out += '.';
  }
  return signo + out;
}

/** 1840 → «1.840»; -12500 → «-12.500». Redondea; un no finito → «-». */
export function miles(n: number, idioma: IdiomaInterfaz = idiomaInterfazActual()): string {
  if (!Number.isFinite(n)) return VACIA;
  if (esEspanol(idioma)) return milesEs(n);
  try {
    return new Intl.NumberFormat(idioma, { maximumFractionDigits: 0, useGrouping: true }).format(Math.round(n));
  } catch {
    return milesEs(n);
  }
}

/** Número con `dec` decimales fijos, como lo escribía economía (`num`). */
export function decimal(n: number, dec = 0, idioma: IdiomaInterfaz = idiomaInterfazActual()): string {
  const opciones = { minimumFractionDigits: dec, maximumFractionDigits: dec };
  if (esEspanol(idioma)) return n.toLocaleString('es-ES', opciones);
  try {
    return n.toLocaleString(idioma, opciones);
  } catch {
    return n.toLocaleString('es-ES', opciones);
  }
}

/** Euros: «1.234 €» en `es` (como `eur` de economía); el resto, con Intl. */
export function moneda(n: number, dec = 0, idioma: IdiomaInterfaz = idiomaInterfazActual()): string {
  if (esEspanol(idioma)) return `${decimal(n, dec, 'es')} €`;
  try {
    return new Intl.NumberFormat(idioma, {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    }).format(n);
  } catch {
    return `${decimal(n, dec, 'es')} €`;
  }
}

const MESES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "2026-09-14" (o un ISO con hora) → "14 sep". Si no parece una fecha, se devuelve tal cual. */
export function fechaCorta(iso: string, idioma: IdiomaInterfaz = idiomaInterfazActual()): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  if (!esEspanol(idioma)) {
    try {
      const fecha = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
      return new Intl.DateTimeFormat(idioma, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(fecha);
    } catch {
      // Sigue con el español.
    }
  }
  return `${Number(m[3])} ${MESES_ES[Number(m[2]) - 1] ?? ''}`;
}

const DIAS_ES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const LETRAS_ES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export type FormaDia = 'largo' | 'letra';

/**
 * El día de la semana por índice, con el lunes en 0 (como weekdayOfKey):
 * `largo` → «lunes» (en minúscula; quien lo quiera con mayúscula usa
 * `mayus` o `capital`), `letra` → «L» (el miércoles es «X»).
 */
export function nombreDia(indice: number, forma: FormaDia = 'largo', idioma: IdiomaInterfaz = idiomaInterfazActual()): string {
  const i = ((Math.trunc(indice) % 7) + 7) % 7;
  if (!esEspanol(idioma)) {
    try {
      // 2024-01-01 fue lunes.
      const fecha = new Date(Date.UTC(2024, 0, 1 + i));
      const largo = new Intl.DateTimeFormat(idioma, { weekday: 'long', timeZone: 'UTC' }).format(fecha);
      return forma === 'letra' ? mayus(largo.slice(0, 1), idioma) : largo;
    } catch {
      // Sigue con el español.
    }
  }
  return forma === 'letra' ? LETRAS_ES[i]! : DIAS_ES[i]!;
}

/** Mayúsculas con las reglas del idioma («día» → «DÍA»). */
export function mayus(s: string, idioma: IdiomaInterfaz = idiomaInterfazActual()): string {
  if (esEspanol(idioma)) return s.toLocaleUpperCase('es-ES');
  try {
    return s.toLocaleUpperCase(idioma);
  } catch {
    return s.toUpperCase();
  }
}

/** La primera letra en mayúscula («lunes» → «Lunes»). */
export function capital(s: string, idioma: IdiomaInterfaz = idiomaInterfazActual()): string {
  return s ? mayus(s.slice(0, 1), idioma) + s.slice(1) : s;
}

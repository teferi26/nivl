// NIVL · FOCUS: aritmética de fechas 'YYYY-MM-DD' (puro, sin zona horaria).
//
// Se calcula en UTC a propósito: una fecha de examen es un día del calendario,
// no un instante, y así el cambio de hora no resta ni suma un día.

const RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function esFecha(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const m = RE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

function aUtc(s: string): number {
  const m = RE.exec(s);
  if (!m) throw new Error(`Fecha inválida: ${s}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function deUtc(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

const DIA = 86_400_000;

export function sumarDias(fecha: string, n: number): string {
  return deUtc(aUtc(fecha) + n * DIA);
}

/** Días de `desde` a `hasta` (negativo si `hasta` es anterior). */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aUtc(hasta) - aUtc(desde)) / DIA);
}

/** 1 = lunes … 7 = domingo. */
export function diaSemana(fecha: string): number {
  const d = new Date(aUtc(fecha)).getUTCDay();
  return d === 0 ? 7 : d;
}

/** El lunes de la semana de `fecha`. */
export function lunesDe(fecha: string): string {
  return sumarDias(fecha, 1 - diaSemana(fecha));
}

/** 'HH:MM' de unos minutos desde medianoche (se recorta a 00:00…23:59). */
export function hhmm(min: number): string {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * Lee una fecha escrita a mano: «2/11/2026», «02-11-26», «2/11» (el próximo
 * 2 de noviembre desde `hoy`) o «2026-11-02». null si no es una fecha.
 */
export function leerFechaEs(s: string, hoy: string): string | null {
  const t = s.trim();
  if (esFecha(t)) return t;
  const m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/.exec(t);
  if (!m) return null;
  const d = String(Number(m[1])).padStart(2, '0');
  const mm = String(Number(m[2])).padStart(2, '0');
  if (m[3]) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    const f = `${y}-${mm}-${d}`;
    return esFecha(f) ? f : null;
  }
  const anio = Number(hoy.slice(0, 4));
  const este = `${anio}-${mm}-${d}`;
  if (!esFecha(este)) return null;
  return diasEntre(hoy, este) >= 0 ? este : `${anio + 1}-${mm}-${d}`;
}

/** «2/11/2026» para un campo. */
export function fechaCorta(f: string): string {
  return `${Number(f.slice(8, 10))}/${Number(f.slice(5, 7))}/${f.slice(0, 4)}`;
}

/** Minutos desde medianoche de 'HH:MM' (o 'H:MM'); null si no lo es. */
export function deHhmm(s: string): number | null {
  const m = /^\s*(\d{1,2})[:.h](\d{2})\s*$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

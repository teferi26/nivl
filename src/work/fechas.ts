// NIVL · WORK: fechas 'YYYY-MM-DD' y minutos locales (puro).
// ESPEJO parcial en supabase/functions/_shared/trabajo.ts: si tocas uno, toca el otro.
//
// La aritmética va en UTC a propósito: una fecha es un día del calendario, no
// un instante, y así el cambio de hora no resta ni suma un día. Lo único que
// mira la zona del dispositivo son `fechaLocal` y `minutosLocal`, las dos
// puertas por las que entra el reloj (el día de NIVL es el día local).

const RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DIA = 86_400_000;

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
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

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

export function esFinDeSemana(fecha: string): boolean {
  return diaSemana(fecha) >= 6;
}

/** El día local de un instante. */
export function fechaLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Minutos desde la medianoche local. */
export function minutosLocal(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** 'HH:MM' o 'HH:MM:SS' a minutos; null si no es una hora real. */
export function horaAMin(hora: string | null | undefined): number | null {
  if (!hora) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hora);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h > 23 || min > 59 ? null : h * 60 + min;
}

/** 'HH:MM' de unos minutos desde medianoche (recortado a 00:00…23:59). */
export function minAHora(min: number): string {
  const m = Math.max(0, Math.min(1439, Math.round(min)));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** «9/11» para un texto. */
export function fechaCorta(f: string): string {
  return `${Number(f.slice(8, 10))}/${Number(f.slice(5, 7))}`;
}

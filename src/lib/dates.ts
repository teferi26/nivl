const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Valida una clave de fecha YYYY-MM-DD. Una clave corrupta producía un
// Invalid Date silencioso que rompía comparaciones y dejaba misiones sin programar.
export function isValidKey(key: string): boolean {
  if (typeof key !== 'string' || !KEY_RE.test(key)) return false;
  const [y, m, d] = key.split('-').map(Number);
  return Number.isFinite(y) && m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseKey(key: string): Date {
  if (!isValidKey(key)) throw new Error(`Clave de fecha inválida: ${key}`);
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const date = parseKey(key);
  date.setDate(date.getDate() + n);
  return dateKey(date);
}

// 1 = lunes … 7 = domingo
export function isoWeekday(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay();
}

export function weekdayOfKey(key: string): number {
  return isoWeekday(parseKey(key));
}

export function formatLongDate(d: Date = new Date()): string {
  const s = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

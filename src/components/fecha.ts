// NIVL · Fechas cortas para la interfaz. Ninguna pantalla enseña un ISO
// («2026-09-14»): se lee «14 sep». Antes vivía en memoria/MemoriaVista.

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "2026-09-14" (o un ISO con hora) → "14 sep". Si no parece una fecha, se devuelve tal cual. */
export function fechaCorta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${MESES[Number(m[2]) - 1] ?? ''}`;
}

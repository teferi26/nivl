// NIVL · La pausa del coach: la regla pura.
//
// Sin imports: tiene su espejo idéntico en supabase/functions/_shared/coachpausa.ts
// (si tocas uno, toca el otro; un test los compara).
//
// Con 3 días o más sin que el usuario escriba al coach, no se gasta IA en él
// hasta que vuelva. Sale de `profiles.coach_last_reply_at` (0135), sin flag ni
// cron. No confundir con `coach_mode = 'pausa'`, el régimen que elige él.
//
// Se cuentan días completos de calendario EN SU ZONA: de lunes 09:00 a jueves
// 09:00 son 3 días aunque un cambio de hora los deje en 71 o 73 horas.

export const DIAS_PARA_PAUSA = 3;

const DIA_MS = 86_400_000;

interface Pared {
  /** Días desde la época para esa fecha local. */
  dia: number;
  /** Segundos desde la medianoche local. */
  segundo: number;
}

function pared(instante: Date, timezone: string): Pared | null {
  try {
    const partes: Record<string, string> = {};
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    for (const p of fmt.formatToParts(instante)) partes[p.type] = p.value;
    const dia = Date.UTC(Number(partes.year), Number(partes.month) - 1, Number(partes.day)) / DIA_MS;
    const segundo = (Number(partes.hour) % 24) * 3600 + Number(partes.minute) * 60 + Number(partes.second);
    return Number.isFinite(dia) && Number.isFinite(segundo) ? { dia, segundo } : null;
  } catch {
    return null;
  }
}

/**
 * Días completos sin escribir al coach. Sin dato o con una fecha que no se lee,
 * 0: ante la duda el coach sigue activo. Una zona inválida cuenta por horas.
 */
export function diasSinResponder(
  ultima: string | null | undefined,
  ahora: Date,
  timezone: string | null | undefined,
): number {
  if (!ultima) return 0;
  const desde = new Date(ultima);
  if (Number.isNaN(desde.getTime()) || desde.getTime() >= ahora.getTime()) return 0;
  const a = pared(desde, timezone || 'UTC');
  const b = pared(ahora, timezone || 'UTC');
  if (!a || !b) return Math.floor((ahora.getTime() - desde.getTime()) / DIA_MS);
  return Math.max(0, b.dia - a.dia - (b.segundo < a.segundo ? 1 : 0));
}

export function coachEnPausa(
  ultima: string | null | undefined,
  ahora: Date,
  timezone: string | null | undefined,
): boolean {
  return diasSinResponder(ultima, ahora, timezone) >= DIAS_PARA_PAUSA;
}

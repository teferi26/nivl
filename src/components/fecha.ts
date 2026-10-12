// NIVL · Fechas cortas para la interfaz. Ninguna pantalla enseña un ISO
// («2026-09-14»): se lee «14 sep». Antes vivía en memoria/MemoriaVista. Desde
// 1.0.10 lo hace `fechaCorta` de @/i18n/formato (igual en es).

import { fechaCorta as fechaCortaI18n } from '@/i18n/formato';

/** "2026-09-14" (o un ISO con hora) → "14 sep". Si no parece una fecha, se devuelve tal cual. */
export function fechaCorta(iso: string): string {
  return fechaCortaI18n(iso);
}

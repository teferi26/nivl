// NIVL · Campañas: el plazo en la voz del sistema (puro). Movido tal cual de
// las pantallas de la lista y del detalle.

import { SIN_DATO } from '@/components/ui/sinDato';
import { t } from '@/i18n';
import { fechaCorta as fechaCortaFormato } from '@/i18n/formato';

/** Plazo de una fila de la lista: «3 d de retraso», «Hoy», «Mañana», «12 días». */
export function diasHasta(fecha: string | null): { texto: string; urgente: boolean } | null {
  if (!fecha) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const objetivo = new Date(`${fecha}T00:00:00`);
  const dias = Math.round((objetivo.getTime() - hoy.getTime()) / 86_400_000);
  if (dias < 0) return { texto: t('campanas:plazo.retraso', { n: -dias }), urgente: true };
  if (dias === 0) return { texto: t('campanas:plazo.hoy'), urgente: true };
  if (dias === 1) return { texto: t('campanas:plazo.manana'), urgente: true };
  return { texto: t('campanas:plazo.dias', { n: dias }), urgente: dias <= 3 };
}

/**
 * Días que quedan hasta la fecha límite, en la voz del sistema. `vencida`
 * (la fecha ya pasó) pone la tarjeta del plazo en alerta; `urgente` solo
 * sube el dato a blanco puro.
 */
export function plazo(fecha: string | null): { valor: string; label: string; urgente: boolean; vencida: boolean } {
  if (!fecha) return { valor: SIN_DATO, label: t('campanas:comun.sinFecha'), urgente: false, vencida: false };
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const objetivo = new Date(`${fecha}T00:00:00`);
  const dias = Math.round((objetivo.getTime() - hoy.getTime()) / 86_400_000);
  if (dias < 0) return { valor: `${-dias}`, label: t('campanas:plazo.diasRetraso'), urgente: true, vencida: true };
  if (dias === 0) return { valor: t('campanas:plazo.hoy'), label: t('campanas:plazo.fechaLimite'), urgente: true, vencida: false };
  // El rótulo va sin la cifra (la pinta la franja): dos rótulos, no un plural con count.
  const label = dias === 1 ? t('campanas:plazo.diaRestante') : t('campanas:plazo.diasRestantes');
  return { valor: `${dias}`, label, urgente: dias <= 3, vencida: false };
}

/** «2026-10-14» (o un ISO con hora) → «14 oct 2026». Sin fecha válida, null. */
export function fechaCorta(fecha: string | null): string | null {
  if (!fecha) return null;
  const [a, m, d] = fecha.slice(0, 10).split('-').map(Number);
  if (!a || !m || !d || m < 1 || m > 12) return null;
  // El día y el mes corto salen de @/i18n/formato («14 oct»); el año, detrás.
  return `${fechaCortaFormato(fecha.slice(0, 10))} ${a}`;
}

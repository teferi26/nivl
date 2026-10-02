// NIVL · Campañas: el plazo en la voz del sistema (puro). Movido tal cual de
// las pantallas de la lista y del detalle.

import { SIN_DATO } from '@/components/ui/sinDato';

/** Plazo de una fila de la lista: «3 d de retraso», «Hoy», «Mañana», «12 días». */
export function diasHasta(fecha: string | null): { texto: string; urgente: boolean } | null {
  if (!fecha) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const objetivo = new Date(`${fecha}T00:00:00`);
  const dias = Math.round((objetivo.getTime() - hoy.getTime()) / 86_400_000);
  if (dias < 0) return { texto: `${-dias} d de retraso`, urgente: true };
  if (dias === 0) return { texto: 'Hoy', urgente: true };
  if (dias === 1) return { texto: 'Mañana', urgente: true };
  return { texto: `${dias} días`, urgente: dias <= 3 };
}

/**
 * Días que quedan hasta la fecha límite, en la voz del sistema. `vencida`
 * (la fecha ya pasó) pone la tarjeta del plazo en alerta; `urgente` solo
 * sube el dato a blanco puro.
 */
export function plazo(fecha: string | null): { valor: string; label: string; urgente: boolean; vencida: boolean } {
  if (!fecha) return { valor: SIN_DATO, label: 'Sin fecha', urgente: false, vencida: false };
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const objetivo = new Date(`${fecha}T00:00:00`);
  const dias = Math.round((objetivo.getTime() - hoy.getTime()) / 86_400_000);
  if (dias < 0) return { valor: `${-dias}`, label: 'Días de retraso', urgente: true, vencida: true };
  if (dias === 0) return { valor: 'Hoy', label: 'Fecha límite', urgente: true, vencida: false };
  return { valor: `${dias}`, label: dias === 1 ? 'Día restante' : 'Días restantes', urgente: dias <= 3, vencida: false };
}

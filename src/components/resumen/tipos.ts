// NIVL · Recuerdos: nombres compartidos por la lista y el pase. Puro.

import { t } from '@/i18n';
import type { Recap, Slide } from '@/lib/photos';

/** Rótulo pequeño de cada diapositiva: dice qué es antes de leerla. */
export function eyebrowSlide(tipo: Slide['tipo']): string {
  return t(`resumen:eyebrowSlide.${tipo}`);
}

/** «Semana del 28/09/2026» · «Mes del 01/09/2026». */
export function nombrePeriodo(r: Recap): string {
  const [y, m, d] = r.period_start.slice(0, 10).split('-');
  const fecha = y && m && d ? `${d}/${m}/${y}` : r.period_start;
  return t(r.kind === 'mensual' ? 'resumen:periodo.mensual' : 'resumen:periodo.semanal', { fecha });
}

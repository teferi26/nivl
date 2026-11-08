// NIVL · WORK: de los códigos del núcleo al texto de la pantalla.

import { t } from '@/i18n';
import { diaSemana, diasEntre, sumarDias } from '@/work/fechas';
import type { Motivo } from '@/work/tipos';

export function textoMotivo(m: Motivo): string {
  return t(`trabajo:motivo.${m.codigo}`, m.vars as Record<string, unknown>);
}

/** El número de semana ISO de `fecha` (la del jueves de esa semana). */
export function semanaDelAno(fecha: string): number {
  const jueves = sumarDias(fecha, 4 - diaSemana(fecha));
  return Math.floor(diasEntre(`${jueves.slice(0, 4)}-01-01`, jueves) / 7) + 1;
}

/** Minutos para una cifra corta: «45 min», «9 h». */
export function textoDuracion(minutos: number): string {
  if (minutos < 60) return t('trabajo:ahora.min', { minutos });
  return t('trabajo:heroe.horas', { horas: Math.round(minutos / 60) });
}

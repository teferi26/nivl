// NIVL · FOCUS: claves de i18n armadas en tiempo de ejecución (método y paso,
// día de la semana, instrucciones de cada sistema). Todas existen en
// src/i18n/es/focus.json: src/focus/__tests__/textos.test.ts lo comprueba.

import { formatoHoras } from '@/focus/horario';
import { t } from '@/i18n';

export const tf = t as unknown as (clave: string, opciones?: Record<string, unknown>) => string;

/** «45 min», «3 h» o «3 h 05». */
export function textoHoras(min: number): string {
  const { h, m } = formatoHoras(min);
  if (h === 0) return t('focus:horas.min', { m });
  if (m === 0) return t('focus:horas.h', { h });
  return t('focus:horas.hMin', { h, m: String(m).padStart(2, '0') });
}

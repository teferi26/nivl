// NIVL · WORK: de los códigos del núcleo al texto de la pantalla.

import { t } from '@/i18n';
import type { Motivo } from '@/work/tipos';

export function textoMotivo(m: Motivo): string {
  return t(`trabajo:motivo.${m.codigo}`, m.vars as Record<string, unknown>);
}

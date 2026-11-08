// NIVL · Medición: el sello de una sesión apuntada.
//
// Solo informa: jamás cambia XP, racha ni penalización, y no se ofrece como
// «verificado» ni se compara entre personas. Con `sin_datos` no pinta nada: si
// no, marcaría cada sesión de quien no tiene reloj y sin reloj no puede verse
// como inferior. No existe un estado «no coincide».

import { Tag } from '@/components/ui';
import { t } from '@/i18n';
import type { ResultadoContraste } from '@/lib/medicion/contraste';

/** Lo que oye el lector, o null si no hay sello que leer. */
export function selloLeido(resultado: ResultadoContraste | undefined): string | null {
  return !resultado || resultado.estado === 'sin_datos' ? null : t(resultado.detalle.clave);
}

export function SelloMedicion({ resultado }: { resultado: ResultadoContraste | undefined }) {
  if (!resultado || resultado.estado === 'sin_datos') return null;
  return <Tag>{t(resultado.estado === 'medido' ? 'medicion:sello.medido' : 'medicion:sello.coherente')}</Tag>;
}

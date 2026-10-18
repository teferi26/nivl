// NIVL · IRON · Texto de una clave que viene de los datos de un ejercicio
// («iron:ejercicios.<id>.nombre» o, en la fase 2, «iron-<grupo>:...»). `t`
// solo acepta claves literales; estas las valida el test del esquema
// (src/iron/__tests__/esquema.test.ts).
import { existe, t } from '@/i18n';
import { NAMESPACES } from '@/i18n/recursos';
import type { ClaveI18n } from '@/iron/tipos';

export function textoIron(clave: ClaveI18n, opciones?: Record<string, string | number>): string {
  return (t as unknown as (k: string, o?: Record<string, string | number>) => string)(clave, opciones);
}

/**
 * El nombre de un músculo, grupo o material. Los del motor están en `iron`;
 * los que añade cada grupo en la fase 2, en su `iron-<grupo>`.
 */
export function nombreIron(seccion: 'musculo' | 'grupo' | 'material' | 'nivel', id: string): string {
  const base = `iron:${seccion}.${id}`;
  if (existe(base)) return textoIron(base as ClaveI18n);
  for (const ns of NAMESPACES) {
    const clave = `${ns}:${seccion}.${id}`;
    if (ns.startsWith('iron-') && existe(clave)) return textoIron(clave as ClaveI18n);
  }
  return id;
}

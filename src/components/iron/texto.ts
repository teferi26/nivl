// NIVL · IRON · Texto de una clave que viene de los datos de un ejercicio
// («iron:ejercicios.<id>.nombre»). `t` solo acepta claves literales; estas
// las valida el test del esquema (src/iron/__tests__/esquema.test.ts).
import { t } from '@/i18n';
import type { ClaveI18n } from '@/iron/tipos';

export function textoIron(clave: ClaveI18n, opciones?: Record<string, string | number>): string {
  return (t as unknown as (k: string, o?: Record<string, string | number>) => string)(clave, opciones);
}

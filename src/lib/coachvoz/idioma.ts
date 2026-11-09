// NIVL · El idioma del dictado y de la voz: el mismo en que habla la interfaz
// y, por tanto, el coach. Con `idiomas_activos` apagado es siempre español.

import { idiomaInterfaz } from '@/i18n';
import { idiomaBase, idiomaDispositivo } from '@/i18n/dispositivo';

/** El locale de cada idioma cuando el teléfono no dice otra variante. */
const POR_DEFECTO: Readonly<Record<string, string>> = {
  es: 'es-ES',
  en: 'en-US',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-PT',
};

/**
 * El locale para un idioma: la variante del teléfono si es ese idioma con
 * región («es-MX», «pt-BR»), o el de `POR_DEFECTO`.
 */
export function localeDeVoz(idioma: string, dispositivo: string | null): string {
  if (dispositivo && idiomaBase(dispositivo) === idioma && /^[a-z]{2}-[A-Z]{2}$/.test(dispositivo)) return dispositivo;
  return POR_DEFECTO[idioma] ?? POR_DEFECTO.es!;
}

/** El locale con el que dictar y hablar ahora mismo. */
export function idiomaVozActual(): string {
  return localeDeVoz(idiomaInterfaz(), idiomaDispositivo());
}

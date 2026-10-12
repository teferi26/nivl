// NIVL · Idiomas: los tipos y el idioma de la interfaz (puro, sin dependencias).
//
// Vive aparte de index.ts para que formato.ts (y con él arena/cifras,
// components/fecha y economia/formato) sepa el idioma sin arrastrar i18next
// ni react-native a las pruebas puras.

/** Los idiomas que NIVL sabe hablar (el coach en 1.0.10; la interfaz, desde 1.1.0). */
export const IDIOMAS = ['es', 'en', 'fr', 'de', 'pt', 'it'] as const;
export type Idioma = (typeof IDIOMAS)[number];

/** `xx` es el pseudoidioma de desarrollo (⟦ ⟧ alrededor de cada texto). */
export type IdiomaInterfaz = Idioma | 'xx';

/** Lo que elige el gladiador: un idioma o seguir al teléfono. */
export type Preferencia = 'auto' | Idioma;

/** El nombre de cada idioma en su propia lengua: no se traduce. */
export const NOMBRE_IDIOMA: Record<Idioma, string> = {
  es: 'Español',
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  it: 'Italiano',
};

export function esIdioma(v: unknown): v is Idioma {
  return typeof v === 'string' && (IDIOMAS as readonly string[]).includes(v);
}

export function esPreferencia(v: unknown): v is Preferencia {
  return v === 'auto' || esIdioma(v);
}

let interfaz: IdiomaInterfaz = 'es';

/** El idioma en que se pinta la interfaz. En 1.0.10 siempre `es` (salvo pruebas y `xx` en desarrollo). */
export function idiomaInterfazActual(): IdiomaInterfaz {
  return interfaz;
}

/** Solo index.ts: cambia el idioma de la interfaz a la vez que i18next. */
export function __fijarInterfaz(idioma: IdiomaInterfaz): void {
  interfaz = idioma;
}

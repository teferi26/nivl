// NIVL · Textos de las librerías puras que salen del catálogo (QA F1, M4).
//
// Las tablas de game.ts, kinds.ts y proplans.ts se exportan como siempre
// (`STAT_LABEL.FUE`, `KINDS.deportista.label`...), pero cada texto se lee del
// catálogo AL USARLO, nunca al cargar el módulo: el idioma de la interfaz
// puede cambiar después (como `t()`, que no se llama a nivel de módulo). Los
// getters son enumerables, así que `{ ...x }`, `Object.entries` y
// `JSON.stringify` ven el texto ya traducido. En español, el catálogo dice
// exactamente lo de antes (textosLibEs.test.ts).

/** Un registro clave → texto donde cada texto sale de `texto(clave)` al leerlo. */
export function registroVivo<K extends string>(claves: readonly K[], texto: (clave: K) => string): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const k of claves) Object.defineProperty(out, k, { enumerable: true, get: () => texto(k) });
  return out;
}

/** `base` con los campos de `textos` leídos del catálogo al usarlos. */
export function conTextos<T extends object, K extends string>(base: T, textos: Record<K, () => string>): T & Record<K, string> {
  const out = { ...base } as T & Record<K, string>;
  for (const [campo, texto] of Object.entries(textos) as [K, () => string][]) {
    Object.defineProperty(out, campo, { enumerable: true, get: texto });
  }
  return out;
}

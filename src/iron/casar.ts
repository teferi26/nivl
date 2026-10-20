// NIVL · IRON · Casado de un nombre de ejercicio escrito a mano con el
// catálogo (puro, sin i18n ni Supabase; test en __tests__/casar.test.ts).
//
// En Gimnasio el ejercicio se guarda como texto libre (`exercise_name`). Si
// ese texto, normalizado, es el nombre de un ejercicio de IRON (en el idioma
// activo o en español) o uno de sus alias (alias.ts: «press banca»,
// «dominadas», «OHP»), la fila enseña «Ver técnica». Normalizar es: a
// minúsculas, sin tildes ni diéresis, sin signos y con los espacios
// colapsados. Nada de parecidos: un casado dudoso enseñaría la técnica de
// otro movimiento, y eso es peor que no enseñar nada.

/** Un ejercicio del catálogo con todos los nombres que valen para casarlo. */
export interface EntradaCasado {
  readonly id: string;
  readonly nombres: readonly string[];
  /** Cómo se escribe en la libreta (alias.ts). Nunca pisan un nombre oficial. */
  readonly alias?: readonly string[];
}

/** Las marcas que deja `normalize('NFD')` (U+0300 a U+036F): tildes, diéresis... */
const DIACRITICOS = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, 'g');

/** «  Press  de BANCA (barra) » → «press de banca barra». */
export function normalizarNombre(s: string): string {
  return s
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Índice nombre normalizado → id. Primero todos los nombres oficiales y luego
 * los alias: un alias nunca le quita su nombre a otro ejercicio. Dentro de
 * cada pasada, el primero que llega gana (el orden del catálogo).
 */
export function indiceCasado(entradas: readonly EntradaCasado[]): ReadonlyMap<string, string> {
  const mapa = new Map<string, string>();
  const meter = (id: string, nombres: readonly string[] | undefined) => {
    for (const n of nombres ?? []) {
      const k = normalizarNombre(n);
      if (k && !mapa.has(k)) mapa.set(k, id);
    }
  };
  for (const e of entradas) meter(e.id, e.nombres);
  for (const e of entradas) meter(e.id, e.alias);
  return mapa;
}

/** El id del ejercicio cuyo nombre es exactamente `nombre` (normalizado), o null. */
export function casarEjercicio(nombre: string, indice: ReadonlyMap<string, string>): string | null {
  const k = normalizarNombre(nombre);
  return k ? (indice.get(k) ?? null) : null;
}

/**
 * Búsqueda del selector: los ejercicios con todas las palabras de la consulta
 * en alguno de sus nombres o alias, en el orden del catálogo. Consulta vacía:
 * todos.
 */
export function buscarEjercicios<T extends EntradaCasado>(consulta: string, entradas: readonly T[]): T[] {
  const palabras = normalizarNombre(consulta).split(' ').filter(Boolean);
  if (palabras.length === 0) return [...entradas];
  return entradas.filter((e) =>
    [...e.nombres, ...(e.alias ?? [])].some((n) => {
      const k = normalizarNombre(n);
      return palabras.every((p) => k.includes(p));
    }),
  );
}

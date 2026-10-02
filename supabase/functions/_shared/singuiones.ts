// Sin guiones largos: orden literal del dueño (02/10/2026). Ningún texto que
// genere la IA puede llevar «—» (U+2014) ni «–» (U+2013). No basta con pedirlo
// en el prompt: todo texto del modelo pasa por aquí antes de guardarse,
// emitirse o enviarse en un push.
//
// Puro y sin dependencias: hay copia exacta en src/lib/singuiones.ts para que
// el cliente sanee al pintar mensajes antiguos (test de paridad).

const GUION = /[–—]/;
const GUIONES = /[–—]/g;

/** ¿Lleva algún guion largo o semiguion? */
export function tieneGuiones(texto: string): boolean {
  return GUION.test(texto);
}

/**
 * Sustituye «—» y «–» por la puntuación natural:
 *   · entre números (rangos, marcadores): «-» → «8-12», «3-1»;
 *   · al empezar una línea (viñeta): «- »;
 *   · antes de una enumeración o explicación al final de una etiqueta corta
 *     («Hoy —» seguido de salto o de una lista): «: »;
 *   · entre cláusulas: «, »; al final de una frase, se quita.
 * Después limpia espacios dobles y comas duplicadas o pegadas a otra puntuación.
 */
export function sinGuiones(texto: string): string {
  if (!texto || !GUION.test(texto)) return texto;
  let t = texto;
  // Rangos y marcadores numéricos: 8–12, 3 — 1, 07:00–09:00.
  t = t.replace(/(\d)\s*[–—]\s*(\d)/g, '$1-$2');
  // Viñeta al principio de línea.
  t = t.replace(/(^|\n)([ \t]*)[–—][ \t]*/g, '$1$2- ');
  // Antes de un salto de línea o al final del texto: la cláusula termina ahí.
  t = t.replace(/[ \t]*[–—][ \t]*(?=\n|$)/g, ':');
  t = t.replace(/:(?=$)/g, '');
  // Etiqueta corta (1 o 2 palabras desde el inicio de línea) seguida de guion: «Hoy — pierna» → «Hoy: pierna».
  t = t.replace(/(^|\n)([ \t]*[^\s–—,.;:!?][^\n,.;:!?–—]{0,24}?)[ \t]*[–—][ \t]*/g, (m: string, ini: string, etiqueta: string, offset: number, todo: string) =>
    etiqueta.trim().split(/\s+/).length <= 2 && !/[–—]/.test(restoDeLinea(todo, offset + m.length))
      ? `${ini}${etiqueta.trimEnd()}: `
      : m);
  // Entre cláusulas.
  t = t.replace(/[ \t]*[–—][ \t]*/g, ', ');
  // Limpieza.
  t = t.replace(GUIONES, ', ');
  t = t.replace(/,\s*,+/g, ',');
  t = t.replace(/,\s*([.;:!?)\]»])/g, '$1');
  t = t.replace(/([(\[«¿¡])\s*,\s*/g, '$1');
  t = t.replace(/:\s*,\s*/g, ': ');
  t = t.replace(/:[ \t]*([.;!?])/g, '$1');
  t = t.replace(/(^|\n)([ \t]*)[,:]\s+/g, '$1$2');
  t = t.replace(/[ \t]{2,}/g, ' ');
  t = t.replace(/[ \t]+([,.;:!?])/g, '$1');
  return t;
}

/**
 * Filtro para texto en streaming: un «—» y su contexto pueden llegar partidos
 * entre fragmentos. Se suelta texto solo por líneas completas (todas las
 * reglas de sinGuiones son de línea), así lo emitido es idéntico a sanear el
 * texto entero. fin() suelta la última línea.
 */
export class FiltroGuiones {
  private pendiente = '';

  /** Devuelve lo que ya se puede emitir (líneas completas, saneadas). */
  push(delta: string): string {
    if (!delta) return '';
    this.pendiente += delta;
    const corte = this.pendiente.lastIndexOf('\n');
    if (corte < 0) return '';
    const listo = this.pendiente.slice(0, corte + 1);
    this.pendiente = this.pendiente.slice(corte + 1);
    return sinGuiones(listo);
  }

  /** Suelta lo retenido al terminar. */
  fin(): string {
    const resto = this.pendiente;
    this.pendiente = '';
    return sinGuiones(resto);
  }
}

/** Sanea todas las cadenas de un valor (entradas de herramientas, JSON). */
export function sinGuionesProfundo<T>(valor: T): T {
  if (typeof valor === 'string') return sinGuiones(valor) as unknown as T;
  if (Array.isArray(valor)) return valor.map((v) => sinGuionesProfundo(v)) as unknown as T;
  if (valor && typeof valor === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) out[k] = sinGuionesProfundo(v);
    return out as T;
  }
  return valor;
}

// Lo que queda de la línea desde `desde` (para saber si hay otro guion: inciso).
function restoDeLinea(todo: string, desde: number): string {
  const fin = todo.indexOf('\n', desde);
  return todo.slice(desde, fin < 0 ? undefined : fin);
}

/** La regla del prompt. Nombra los dos caracteres a propósito: es lo único que no se sanea. */
export const REGLA_SIN_GUIONES = 'Nunca uses el guion largo (—) ni el semiguion (–). Usa comas, dos puntos o punto.';

/** sinGuiones respetando la propia regla dentro del texto. */
export function sinGuionesProtegido(texto: string): string {
  if (!texto.includes(REGLA_SIN_GUIONES)) return sinGuiones(texto);
  return texto.split(REGLA_SIN_GUIONES).map(sinGuiones).join(REGLA_SIN_GUIONES);
}

// deno-lint-ignore no-explicit-any
type Bloque = any;

function sanearBloque(b: Bloque): Bloque {
  if (!b || typeof b !== 'object') return b;
  if (b.type === 'text' && typeof b.text === 'string') return { ...b, text: sinGuionesProtegido(b.text) };
  if (b.type === 'tool_use' && b.input !== undefined) return { ...b, input: sinGuionesProfundo(b.input) };
  if (b.type === 'tool_result') {
    if (typeof b.content === 'string') return { ...b, content: sinGuiones(b.content) };
    if (Array.isArray(b.content)) return { ...b, content: b.content.map(sanearBloque) };
  }
  // thinking / redacted_thinking / image: intactos (la API exige el pensamiento tal cual).
  return b;
}

/**
 * Lo que se le manda al modelo, sin guiones: el modelo imita el estilo de lo
 * que lee (las instrucciones, el conocimiento, las herramientas y el historial
 * estaban llenos de «—»). Determinista, así que la caché sigue igual de estable.
 */
// deno-lint-ignore no-explicit-any
export function sanearPeticion<T extends { system?: any[]; messages?: any[]; tools?: unknown[] }>(opts: T): T {
  return {
    ...opts,
    ...(opts.system ? { system: opts.system.map((s) => (typeof s?.text === 'string' ? { ...s, text: sinGuionesProtegido(s.text) } : s)) } : {}),
    ...(opts.messages
      ? {
        messages: opts.messages.map((m) =>
          typeof m.content === 'string'
            ? { ...m, content: sinGuionesProtegido(m.content) }
            : Array.isArray(m.content)
            ? { ...m, content: m.content.map(sanearBloque) }
            : m
        ),
      }
      : {}),
    ...(opts.tools ? { tools: sinGuionesProfundo(opts.tools) } : {}),
  };
}

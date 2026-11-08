// NIVL · FOCUS: pegar un temario o unas tarjetas (puro, con tests).

import { sinGuiones } from '@/lib/singuiones';

export const MAX_TEMA = 160;
export const MAX_SECCION = 80;
export const MAX_ANVERSO = 500;
export const MAX_REVERSO = 1000;

export interface TemaImportado {
  nombre: string;
  seccion: string | null;
}

export interface TemasImportados {
  temas: TemaImportado[];
  /** Cuántos se han recortado por largos. */
  recortados: number;
}

const lineas = (s: string) => s.split(/\r\n|\r|\n/).map((l) => l.trim());
const sinVineta = (l: string) => l.replace(/^[-*•·]\s+/, '').trim();
const recorta = (s: string, n: number) => (s.length > n ? s.slice(0, n).trimEnd() : s);

/** Una línea por tema; `# Bloque I` abre una sección para los que vienen detrás. */
export function temasDesdeTexto(texto: string): TemasImportados {
  const temas: TemaImportado[] = [];
  let seccion: string | null = null;
  let recortados = 0;
  for (const cruda of lineas(texto)) {
    if (!cruda) continue;
    const s = /^#+\s*(.*)$/.exec(cruda);
    if (s) {
      seccion = s[1] ? recorta(s[1].trim(), MAX_SECCION) : null;
      continue;
    }
    const n = sinVineta(cruda);
    if (!n) continue;
    if (n.length > MAX_TEMA) recortados++;
    temas.push({ nombre: recorta(n, MAX_TEMA), seccion });
  }
  return { temas, recortados };
}

export interface TarjetaImportada {
  anverso: string;
  reverso: string;
}

export interface TarjetasImportadas {
  tarjetas: TarjetaImportada[];
  /** Líneas sin separador o sin una de las dos caras. */
  descartadas: number;
}

const sinDobles = (s: string) => s.replace(/""/g, '"').trim();

/** CSV con comillas: `"a, b","c"`, `"a";"c"` o `a,"c, d"`. */
function partirCsv(l: string): [string, string] | null {
  const primera = /^"((?:[^"]|"")*)"\s*[,;\t]\s*(?:"((?:[^"]|"")*)"|(.*))$/.exec(l);
  if (primera) return [sinDobles(primera[1] as string), sinDobles(primera[2] ?? primera[3] ?? '')];
  const segunda = /^([^",;\t|]+)[,;\t]\s*"((?:[^"]|"")*)"$/.exec(l);
  return segunda ? [(segunda[1] as string).trim(), sinDobles(segunda[2] as string)] : null;
}

function partirTarjeta(l: string): [string, string] | null {
  const csv = partirCsv(l);
  if (csv) return csv;
  for (const sep of ['|', '\t', ';']) {
    const i = l.indexOf(sep);
    if (i === -1) continue;
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }
  // Una sola coma: `pregunta,respuesta`. Con más, no se sabe dónde cortar.
  const coma = l.indexOf(',');
  if (coma !== -1 && l.indexOf(',', coma + 1) === -1) return [l.slice(0, coma).trim(), l.slice(coma + 1).trim()];
  return null;
}

const CABECERA_A = /^(pregunta|anverso|front|frente)$/i;
const CABECERA_B = /^(respuesta|reverso|back|dorso)$/i;

/** Una línea por tarjeta: `pregunta | respuesta`, con tabulador, `;` o CSV. */
export function tarjetasDesdeTexto(texto: string): TarjetasImportadas {
  const tarjetas: TarjetaImportada[] = [];
  let descartadas = 0;
  for (const cruda of texto.split(/\r\n|\r|\n/)) {
    const l = sinVineta(cruda.replace(/^ +| +$/g, ''));
    if (!l) continue;
    const p = partirTarjeta(l);
    if (!p || !p[0] || !p[1]) {
      descartadas++;
      continue;
    }
    if (CABECERA_A.test(p[0]) && CABECERA_B.test(p[1])) continue;
    tarjetas.push({ anverso: recorta(p[0], MAX_ANVERSO), reverso: recorta(p[1], MAX_REVERSO) });
  }
  return { tarjetas, descartadas };
}

/** Lo más largo que se acepta al pegar (y lo que admite el atajo de IA). */
export const MAX_TEXTO_LOTE = 40_000;

/** La respuesta del atajo `estudio/flashcards`, sin fiarse de nada: `[{frente, dorso}]`. */
export function tarjetasDeIa(resultado: unknown): TarjetaImportada[] {
  if (!Array.isArray(resultado)) return [];
  const vistas = new Set<string>();
  const out: TarjetaImportada[] = [];
  for (const r of resultado as unknown[]) {
    if (!r || typeof r !== 'object') continue;
    const { frente, dorso } = r as { frente?: unknown; dorso?: unknown };
    if (typeof frente !== 'string' || typeof dorso !== 'string') continue;
    const anverso = recorta(sinGuiones(frente).trim(), MAX_ANVERSO);
    const reverso = recorta(sinGuiones(dorso).trim(), MAX_REVERSO);
    const clave = anverso.toLowerCase();
    if (!anverso || !reverso || vistas.has(clave)) continue;
    vistas.add(clave);
    out.push({ anverso, reverso });
  }
  return out;
}

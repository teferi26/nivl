// NIVL · FOCUS: cómo se enseña un temario largo (puro, con tests). Numeración,
// filtro por estado, plegado por sección, vueltas y qué pierde un toque.

import type { EstadoTema, Tema } from './tipos';

export type FiltroTema = 'todos' | EstadoTema;

export const FILTROS_TEMA: readonly FiltroTema[] = ['todos', 'pendiente', 'repasando', 'dominado'];

const CON_ROTULO = /^(tema|t\.|unidad|ud\.?|ut\.?|bloque|lecci[oó]n|cap[ií]tulo|cap\.|art[ií]culo|art\.|parte|m[oó]dulo)\s*\d+/i;
const CON_CIFRA = /^\d+\s*(?:[.):ºª-]|\s)/;
const CON_ROMANO = /^[IVXLC]+[.)]\s/;

/** El nombre ya trae su número («Tema 12», «3. Las Cortes», «IV. La Corona»). */
export function yaNumerado(nombre: string): boolean {
  const n = nombre.trim();
  return CON_ROTULO.test(n) || CON_CIFRA.test(n) || CON_ROMANO.test(n);
}

/** El número que se pinta delante; null si el nombre ya lleva el suyo («Tema 1 · Tema 1»). */
export function numeroDeTema(nombre: string, sitio: number): number | null {
  return yaNumerado(nombre) ? null : sitio;
}

export function conteoPorEstado(temas: readonly Pick<Tema, 'estado'>[]): Record<FiltroTema, number> {
  const c: Record<FiltroTema, number> = { todos: temas.length, pendiente: 0, repasando: 0, dominado: 0 };
  for (const x of temas) c[x.estado]++;
  return c;
}

export function filtrarTemas<T extends Pick<Tema, 'estado'>>(temas: readonly T[], filtro: FiltroTema): T[] {
  return filtro === 'todos' ? [...temas] : temas.filter((x) => x.estado === filtro);
}

export interface GrupoTemas<T> {
  seccion: string | null;
  temas: T[];
  /** Los que ya no están por estudiar. */
  vistos: number;
}

/** Por sección, en el orden en que aparecen en el temario. Sin sección va junto. */
export function agruparPorSeccion<T extends Pick<Tema, 'estado' | 'seccion'>>(temas: readonly T[]): GrupoTemas<T>[] {
  const grupos = new Map<string | null, GrupoTemas<T>>();
  for (const x of temas) {
    const k = x.seccion && x.seccion.trim() ? x.seccion.trim() : null;
    const g = grupos.get(k) ?? { seccion: k, temas: [], vistos: 0 };
    g.temas.push(x);
    if (x.estado !== 'pendiente') g.vistos++;
    grupos.set(k, g);
  }
  return [...grupos.values()];
}

/** La sección que se abre sola: la primera con algo por estudiar (o la primera). */
export function seccionQueToca<T>(grupos: readonly GrupoTemas<T>[]): string | null {
  const g = grupos.find((x) => x.vistos < x.temas.length) ?? grupos[0];
  return g ? g.seccion : null;
}

/** Con todo el temario visto ya se puede empezar otra vuelta. */
export function puedeEmpezarVuelta(temas: readonly Pick<Tema, 'estado'>[]): boolean {
  return temas.length > 0 && temas.every((x) => x.estado !== 'pendiente');
}

/** Volver a «pendiente» un tema con repasos programados se lleva su calendario. */
export function pierdeCalendario(tema: Pick<Tema, 'repasoEl'>, siguiente: EstadoTema): boolean {
  return siguiente === 'pendiente' && tema.repasoEl !== null;
}

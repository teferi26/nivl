// NIVL · WORK: las prioridades del día (puro, con tests).
// El orden tiene ESPEJO en supabase/functions/_shared/trabajo.ts: si tocas uno, toca el otro.
//
// El orden y el corte a tres. Una prioridad es una misión normal de WORK que
// lleva `work_day`: dura un día (la retira `retirarPrioridadesCaducadas`).
//
// OJO con `link`: una prioridad va con link 'ninguno' explícito, NUNCA
// 'trabajo'. propagarActo marca TODAS las misiones enlazadas al acto: con
// 'trabajo', un solo bloque cerraría las tres prioridades. La que se ataca la
// paga su bloque por `questId`; 'trabajo' es para misiones fijas genéricas
// («bloque de trabajo profundo») que cumple cualquier bloque.

import { diaSemana } from './fechas';
import { MAX_PRIORIDADES, MAX_TITULO_PRIORIDAD, normal, type MisionTrabajo } from './tipos';

/** Lo que se inserta en `quests` por cada prioridad escrita. */
export interface FilaPrioridad {
  title: string;
  stat: 'INT';
  difficulty: 'media';
  days_of_week: number[];
  requires_evidence: false;
  is_bonus: false;
  health_data: false;
  modes: ['work'];
  link: 'ninguno';
  work_day: string;
  work_rank: number;
}

/** Las hechas al final; dentro de cada grupo, las escritas hoy primero y en su orden. */
export function ordenarPrioridades<T extends MisionTrabajo>(misiones: readonly T[], hoy: string): T[] {
  const deHoy = (m: T) => (m.diaPrioridad === hoy ? 0 : 1);
  return [...misiones].sort(
    (a, b) =>
      Number(a.hecha) - Number(b.hecha) ||
      deHoy(a) - deHoy(b) ||
      (a.rango ?? 99) - (b.rango ?? 99) ||
      b.xp - a.xp ||
      (a.creadaEn ?? '').localeCompare(b.creadaEn ?? '') ||
      a.id.localeCompare(b.id),
  );
}

export interface PrioridadesDelDia<T> {
  /** Como mucho tres. Lo pendiente desplaza a lo hecho. */
  visibles: T[];
  /** Lo que no cabe en las tres, en orden. */
  resto: T[];
  /** Las de penalización van aparte: restauran, no son trabajo. */
  penalizaciones: T[];
  hechas: number;
  total: number;
}

export function prioridadesDelDia<T extends MisionTrabajo>(misiones: readonly T[], hoy: string): PrioridadesDelDia<T> {
  const normales = misiones.filter((m) => !m.penalizacion);
  const ordenadas = ordenarPrioridades(normales, hoy);
  return {
    visibles: ordenadas.slice(0, MAX_PRIORIDADES),
    resto: ordenadas.slice(MAX_PRIORIDADES),
    penalizaciones: misiones.filter((m) => m.penalizacion),
    hechas: normales.filter((m) => m.hecha).length,
    total: normales.length,
  };
}

/** Las pendientes y atacables, en orden. */
export function pendientes<T extends MisionTrabajo>(misiones: readonly T[], hoy: string): T[] {
  return ordenarPrioridades(
    misiones.filter((m) => !m.hecha && !m.penalizacion),
    hoy,
  );
}

/** Lo que ha escrito el usuario: sin vacíos, sin repetidos, acotado y como mucho tres. */
export function limpiarEntradas(textos: readonly string[]): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const crudo of textos) {
    const t = crudo.replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim().slice(0, MAX_TITULO_PRIORIDAD).trim();
    const n = normal(t);
    if (!n || vistos.has(n)) continue;
    vistos.add(n);
    out.push(t);
    if (out.length === MAX_PRIORIDADES) break;
  }
  return out;
}

/** Cuántas caben aún hoy, contando las ya escritas hoy (hechas o no). */
export function huecosDePrioridad(misiones: readonly MisionTrabajo[], hoy: string): number {
  return Math.max(0, MAX_PRIORIDADES - misiones.filter((m) => m.diaPrioridad === hoy).length);
}

/**
 * Las filas a insertar. `rangoDesde` es el primer rango libre (1 si no hay
 * ninguna hoy). Dificultad media siempre: 50 XP por cada una, 150 al día como
 * mucho, dentro del presupuesto diario, y el usuario no elige sus puntos.
 */
export function filasDePrioridad(titulos: readonly string[], hoy: string, rangoDesde = 1): FilaPrioridad[] {
  const libres = Math.max(0, MAX_PRIORIDADES - (rangoDesde - 1));
  return limpiarEntradas(titulos)
    .slice(0, libres)
    .map((title, i) => ({
      title,
      stat: 'INT' as const,
      difficulty: 'media' as const,
      days_of_week: [diaSemana(hoy)],
      requires_evidence: false as const,
      is_bonus: false as const,
      health_data: false as const,
      modes: ['work'] as ['work'],
      link: 'ninguno' as const,
      work_day: hoy,
      work_rank: rangoDesde + i,
    }));
}

/** Soltarla sin coste solo vale el día que se escribió (closing.ts: lo creado hoy se puede corregir). */
export function sePuedeSoltar(m: Pick<MisionTrabajo, 'diaPrioridad' | 'hecha' | 'penalizacion'>, hoy: string): boolean {
  return m.diaPrioridad === hoy && !m.hecha && !m.penalizacion;
}

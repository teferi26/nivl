// NIVL · Hábitos: lo que se deriva de los datos (puro, con test).
//
// Sin Supabase ni React: recibe los hábitos, las fechas cumplidas de cada uno
// y el día, y devuelve lo que pinta la vista. El día llega desde fuera para
// que la galería y los tests no dependan del reloj.

import { t } from '@/i18n';
import { HABIT_TARGET_DAYS, ordenarPorCercania, progresoHabito, type ProgresoHabito } from '@/lib/habits';
import type { Quest, Rule } from '@/lib/types';

export interface HabitosClasificados {
  progresos: Map<string, ProgresoHabito>;
  /** Sin adquirir, los consolidables primero y luego por racha. */
  enCurso: Quest[];
  adquiridos: Quest[];
}

/** Racha de cada hábito y reparto entre los que están en forja y los adquiridos. */
export function clasificarHabitos(todos: Quest[], fechas: Map<string, Set<string>>, hoy: string): HabitosClasificados {
  const progresos = new Map<string, ProgresoHabito>();
  for (const q of todos) progresos.set(q.id, progresoHabito(q, fechas.get(q.id) ?? new Set(), hoy));
  return {
    progresos,
    enCurso: ordenarPorCercania(
      todos.filter((q) => !q.acquired_at),
      progresos,
    ),
    adquiridos: todos.filter((q) => q.acquired_at),
  };
}

export interface ResumenHabitos {
  enForja: number;
  /** Mejor racha de los que están en forja (0 sin ninguno). */
  mejorRacha: number;
  /** Cuántos se pueden dar ya por adquiridos. */
  listos: number;
  adquiridos: number;
}

export function resumenHabitos(
  enCurso: Quest[],
  adquiridos: Quest[],
  progresos: Map<string, ProgresoHabito>,
): ResumenHabitos {
  return {
    enForja: enCurso.length,
    mejorRacha: Math.max(0, ...enCurso.map((q) => progresos.get(q.id)?.racha ?? 0)),
    listos: enCurso.filter((q) => progresos.get(q.id)?.consolidable).length,
    adquiridos: adquiridos.length,
  };
}

/** Reglas del contrato que siguen sin marcar hoy. */
export function reglasPendientes(reglas: Rule[], cumplidas: Set<string>): number {
  return reglas.filter((r) => !cumplidas.has(r.id)).length;
}

/** «Listo para ser tuyo», «Falta 1 día», «Faltan 8 días». */
export function textoRestantes(p: ProgresoHabito): string {
  if (p.consolidable) return t('habitos:derivar.listo');
  return t('habitos:derivar.faltan', { count: p.restantes });
}

/** Lo que oye el lector de una tarjeta de hábito. */
export function resumenHabito(titulo: string, p: ProgresoHabito): string {
  return t('habitos:derivar.resumen', { titulo, count: p.racha, objetivo: p.objetivo, restantes: textoRestantes(p) });
}

/** «A los 21 días seguidos un hábito es tuyo…» */
export function subtituloHabitos(): string {
  return t('habitos:derivar.subtitulo', { dias: HABIT_TARGET_DAYS });
}

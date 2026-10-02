// NIVL · Hábitos: lo que se deriva de los datos (puro, con test).
//
// Sin Supabase ni React: recibe los hábitos, las fechas cumplidas de cada uno
// y el día, y devuelve lo que pinta la vista. El día llega desde fuera para
// que la galería y los tests no dependan del reloj.

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

/** «Listo para consolidar», «Falta 1 día», «Faltan 8 días». */
export function textoRestantes(p: ProgresoHabito): string {
  if (p.consolidable) return 'Listo para consolidar';
  return p.restantes === 1 ? 'Falta 1 día' : `Faltan ${p.restantes} días`;
}

/** Lo que oye el lector de una tarjeta de hábito. */
export function resumenHabito(titulo: string, p: ProgresoHabito): string {
  const dias = p.racha === 1 ? 'día' : 'días';
  return `${titulo}. Racha de ${p.racha} ${dias} de ${p.objetivo}. ${textoRestantes(p)}.`;
}

/** «A los 21 días seguidos un hábito es tuyo…» */
export const SUBTITULO_HABITOS = `A los ${HABIT_TARGET_DAYS} días seguidos un hábito es tuyo. Cada uno cuenta su propia racha.`;

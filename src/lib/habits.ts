// NIVL · Hábitos: la racha de cada misión por separado.
//
// La racha del perfil es global: se rompe si fallas CUALQUIER misión del día.
// Eso está bien para juzgar el día entero, pero no dice nada sobre si estás
// cogiendo el hábito de leer. Esto cuenta cada uno por su cuenta.
//
// Módulo puro, sin Supabase, para que tenga tests: aquí se decide cuándo un
// hábito se puede dar por adquirido, y eso no se puede equivocar.

import { addDays, weekdayOfKey } from './dates';
import type { Quest } from './types';

/** Días seguidos que consolidan un hábito. */
export const HABIT_TARGET_DAYS = 21;

export interface ProgresoHabito {
  /** Días programados seguidos cumplidos, contando hacia atrás desde hoy. */
  racha: number;
  objetivo: number;
  /** Ya se puede consolidar: llegó al umbral y sigue vivo. */
  consolidable: boolean;
  /** Cuántos días programados faltan para el umbral. */
  restantes: number;
}

/**
 * Racha de un hábito concreto.
 *
 * Solo cuentan los días en los que TOCABA. Un hábito de lunes a viernes no se
 * rompe el domingo — si contáramos todos los días naturales, ninguna misión de
 * días alternos podría consolidarse jamás.
 *
 * Se cuenta hacia atrás desde hoy. El día de hoy cuenta solo si ya está hecho;
 * si aún no lo está, no rompe nada, porque el día no ha terminado.
 */
export function rachaDeHabito(
  quest: Quest,
  fechasCompletadas: Set<string>,
  hoy: string,
): number {
  const dias = quest.days_of_week ?? [];
  if (!dias.length) return 0;

  let racha = 0;
  let dia = hoy;

  // Si hoy tocaba y todavía no está hecho, se empieza a contar desde ayer: el
  // día sigue abierto y penalizarlo sería contar un fallo que aún no existe.
  if (dias.includes(weekdayOfKey(hoy)) && !fechasCompletadas.has(hoy)) {
    dia = addDays(hoy, -1);
  }

  // Tope de seguridad: sin él, un hábito perfecto desde hace años recorrería
  // miles de días en cada pintado de la pantalla.
  for (let i = 0; i < 400; i++) {
    if (!dias.includes(weekdayOfKey(dia))) {
      dia = addDays(dia, -1);
      continue;
    }
    if (!fechasCompletadas.has(dia)) break;
    racha += 1;
    dia = addDays(dia, -1);
  }

  return racha;
}

export function progresoHabito(
  quest: Quest,
  fechasCompletadas: Set<string>,
  hoy: string,
  objetivo = HABIT_TARGET_DAYS,
): ProgresoHabito {
  const racha = rachaDeHabito(quest, fechasCompletadas, hoy);
  return {
    racha,
    objetivo,
    consolidable: racha >= objetivo && !quest.acquired_at,
    restantes: Math.max(0, objetivo - racha),
  };
}

/**
 * Un hábito consolidado deja de programarse: no pide marcarse y no puede
 * romperte la racha del día. Es la recompensa por los 21 días.
 */
export function estaAdquirido(quest: Quest): boolean {
  return !!quest.acquired_at;
}

/** Los que aún se están construyendo, ordenados por lo cerca que están. */
export function ordenarPorCercania(
  quests: Quest[],
  progresos: Map<string, ProgresoHabito>,
): Quest[] {
  return [...quests].sort((a, b) => {
    const pa = progresos.get(a.id);
    const pb = progresos.get(b.id);
    // Los consolidables primero: son una decisión pendiente, no un pendiente más.
    if (pa?.consolidable !== pb?.consolidable) return pa?.consolidable ? -1 : 1;
    return (pb?.racha ?? 0) - (pa?.racha ?? 0);
  });
}

// Lógica PURA del cierre de días (sin red ni Supabase) — testeable en aislamiento.
// engine.ts la ejecuta y persiste el resultado.

import { addDays, weekdayOfKey } from './dates';
import { DAILY_PENALTY_CAP, MAX_STONES, PENALTY_FACTOR, STONE_EVERY_STREAK_DAYS, XP_BY_DIFFICULTY } from './game';
import type { Quest } from './types';

export function questsScheduledOn(quests: Quest[], date: string): Quest[] {
  const wd = weekdayOfKey(date);
  return quests.filter((q) => {
    if (!q.active) return false;
    if (q.is_penalty) return q.penalty_date === date;
    // Un hábito consolidado ya no se pide. Esa es exactamente la recompensa por
    // los 21 días: deja de exigir el toque diario y deja de poder romperte la
    // racha. Se sigue pudiendo marcar a mano desde Hábitos si apetece.
    if (q.acquired_at) return false;
    return q.days_of_week.includes(wd);
  });
}

/**
 * Cuántas misiones puedes fallar en un día sin romper la racha.
 *
 * Todo o nada no funcionaba. Con ocho misiones diarias, un día perfecto es
 * raro y dos seguidos casi imposible: en dos semanas de uso real hubo tres
 * días perfectos, ninguno consecutivo, así que la racha nunca pasó de 1 y AGI
 * —la stat de la constancia— se quedó clavada en 0. El día que fue al
 * gimnasio, escribió el diario, se pesó, leyó y registró las comidas se leía
 * igual que el día que no abrió la app. Eso no es exigencia, es ruido.
 *
 * El 30% se redondea hacia abajo, así que los días pequeños siguen pidiéndolo
 * todo (con tres misiones no perdonas ninguna) y el margen solo aparece cuando
 * el día es grande de verdad. Es proporcional al tamaño del día, no un regalo
 * fijo.
 *
 * Lo que NO cambia: cada misión fallada sigue costando su XP. La tolerancia
 * salva la racha, no el bolsillo. Y así se respeta mejor el invariante de no
 * castigar dos veces el mismo fallo — antes un despiste costaba el XP Y la
 * racha entera.
 */
export const TOLERANCIA_DIA = 0.3;

export function fallosPermitidos(programadas: number): number {
  return Math.floor(programadas * TOLERANCIA_DIA);
}

/**
 * La racha que se le enseña, contando el día de hoy si ya está cerrado.
 *
 * `profiles.streak_days` solo cuenta días CERRADOS: se recalcula al procesar el
 * día siguiente. Eso es correcto para la economía —el multiplicador de XP tiene
 * que ser el mismo para todas las misiones del día, o completarlas en un orden
 * u otro pagaría distinto— pero como número a la vista es desmoralizante:
 * cumples las tres misiones del día y el contador sigue igual hasta mañana.
 *
 * Esto devuelve lo que el cazador ha ganado de verdad. Las penalizaciones no
 * cuentan, igual que en el cierre.
 */
export function rachaVisible(
  streakDays: number,
  questsHoy: Quest[],
  completadasHoy: Set<string>,
): { valor: number; hoyCerrado: boolean; perfecto: boolean; faltan: number } {
  const pendientes = questsHoy.filter((q) => !q.is_penalty);
  const fallos = pendientes.filter((q) => !completadasHoy.has(q.id)).length;
  // El mismo criterio que el cierre, o el número a la vista mentiría: verías
  // "hoy cerrado" y mañana la racha rota, o al revés.
  const hoyCerrado = pendientes.length > 0 && fallos <= fallosPermitidos(pendientes.length);
  return {
    valor: streakDays + (hoyCerrado ? 1 : 0),
    hoyCerrado,
    perfecto: pendientes.length > 0 && fallos === 0,
    faltan: Math.max(0, fallos - fallosPermitidos(pendientes.length)),
  };
}

/**
 * Reglas incumplidas en los días ya cerrados.
 *
 * El criterio es el mismo que con las misiones: no marcarla es fallarla. Pero
 * el castigo se AGREGA por día y se topa igual que el de misiones — sin tope,
 * seis reglas por seis días de ausencia serían 900 XP de golpe, y eso no es un
 * sistema exigente, es uno del que te vas.
 *
 * Se devuelve una entrada por día con reglas rotas para que el ejecutor cree
 * UNA consecuencia agregada, no seis.
 */
export function reglasIncumplidas(input: {
  fromDate: string;
  today: string;
  reglas: { id: string; text: string; consequence: string }[];
  checksPorDia: Map<string, Set<string>>;
  freezeUntil: string | null;
  xpPorRegla: number;
  topeDiario: number;
}): { date: string; rotas: { id: string; text: string; consequence: string }[]; xp: number }[] {
  if (!input.reglas.length) return [];

  // Nunca se juzga a alguien que todavía no ha empezado a marcar.
  //
  // El día que esta función existe, el historial entero está sin marcar: sin
  // esta guarda, el primer cierre castigaría semanas enteras por no haber usado
  // algo que no existía. Y quien nunca ha marcado nada no está incumpliendo,
  // está sin enterarse — eso se arregla explicándolo, no cobrando.
  //
  // El juicio arranca el día de la primera marca. A partir de ahí, el silencio
  // sí cuenta como roto.
  const diasConMarcas = [...input.checksPorDia.entries()]
    .filter(([, set]) => set.size > 0)
    .map(([dia]) => dia)
    .sort();
  if (!diasConMarcas.length) return [];
  const desdeCuando = diasConMarcas[0]!;

  const freezeUntil = input.freezeUntil ? input.freezeUntil.slice(0, 10) : null;
  const salida: { date: string; rotas: { id: string; text: string; consequence: string }[]; xp: number }[] = [];

  let day = input.fromDate;
  while (day < input.today) {
    if (freezeUntil && day <= freezeUntil) {
      day = addDays(day, 1);
      continue;
    }
    if (day < desdeCuando) {
      day = addDays(day, 1);
      continue;
    }
    const marcadas = input.checksPorDia.get(day) ?? new Set<string>();
    const rotas = input.reglas.filter((r) => !marcadas.has(r.id));
    if (rotas.length) {
      salida.push({
        date: day,
        rotas,
        xp: Math.min(rotas.length * input.xpPorRegla, input.topeDiario),
      });
    }
    day = addDays(day, 1);
  }
  return salida;
}

export interface CloseInput {
  fromDate: string;
  today: string;
  quests: Quest[];
  completedKeys: Set<string>;
  streak: number;
  /** Días perfectos seguidos: es lo que forja la piedra, no la racha normal. */
  perfectStreak?: number;
  stones: number;
  freezeUntil: string | null;
}

export interface CloseOutput {
  streak: number;
  perfectStreak: number;
  stones: number;
  penaltyXp: number;
  missedTitles: string[];
  streakLost: boolean;
  stonesUsed: number;
  stonesEarned: number;
  frozenDays: number;
}

export function computeDayClose(input: CloseInput): CloseOutput {
  let { streak, stones } = input;
  let perfectStreak = input.perfectStreak ?? 0;
  let penaltyXp = 0;
  let streakLost = false;
  let stonesUsed = 0;
  let stonesEarned = 0;
  let frozenDays = 0;
  const missedTitles: string[] = [];

  // Normaliza por si freeze_until llega de Supabase como timestamp
  // ('2026-06-10T00:00:00'): la comparación lexicográfica exige 'YYYY-MM-DD'.
  const freezeUntil = input.freezeUntil ? input.freezeUntil.slice(0, 10) : null;
  let day = input.fromDate;
  while (day < input.today) {
    if (freezeUntil && day <= freezeUntil) {
      frozenDays += 1;
      day = addDays(day, 1);
      continue;
    }

    // Las misiones de penalización no entran en el juicio del día.
    //
    // Son una oportunidad de recuperar lo perdido, no una obligación nueva. Si
    // contaran, ignorarla castigaría DOS VECES el mismo fallo: el día que
    // fallaste ya te costó la racha y el XP, y al día siguiente la penalización
    // sin tocar volvía a ponerte la racha a cero aunque hubieras cumplido todo
    // lo demás. Eso hacía imposible arrancar de nuevo mientras hubiera una
    // pendiente, que es justo el momento en el que hace falta poder.
    //
    // Ignorarla sigue teniendo su precio: consolida la pérdida de XP.
    const scheduled = questsScheduledOn(input.quests, day).filter((q) => !q.is_penalty);
    const missed = scheduled.filter((q) => !input.completedKeys.has(`${day}|${q.id}`));

    // El XP de lo fallado se cobra igual esté el día cumplido o no: la
    // tolerancia protege la racha, no el bolsillo.
    const cobrarFallos = () => {
      let dayPenalty = 0;
      for (const q of missed) {
        dayPenalty += Math.round(XP_BY_DIFFICULTY[q.difficulty] * PENALTY_FACTOR);
        missedTitles.push(q.title);
      }
      penaltyXp += Math.min(dayPenalty, DAILY_PENALTY_CAP);
    };

    if (scheduled.length > 0) {
      const perfecto = missed.length === 0;
      const cumplido = missed.length <= fallosPermitidos(scheduled.length);

      if (cumplido) {
        streak += 1;
        // La piedra se gana con días PERFECTOS, no con días cumplidos. Si la
        // racha se ablanda y la piedra viene con ella, las válvulas pasarían de
        // ganarse a regalarse — y una piedra absorbe un día entero de fallos.
        perfectStreak = perfecto ? perfectStreak + 1 : 0;
        if (perfectStreak > 0 && perfectStreak % STONE_EVERY_STREAK_DAYS === 0 && stones < MAX_STONES) {
          stones += 1;
          stonesEarned += 1;
        }
        if (!perfecto) cobrarFallos();
      } else if (stones > 0) {
        // La piedra absorbe el día entero: sin penalización y la racha sobrevive
        // (aunque no suma).
        stones -= 1;
        stonesUsed += 1;
        perfectStreak = 0;
      } else {
        streak = 0;
        perfectStreak = 0;
        streakLost = true;
        cobrarFallos();
      }
    }
    day = addDays(day, 1);
  }

  return { streak, perfectStreak, stones, penaltyXp, missedTitles, streakLost, stonesUsed, stonesEarned, frozenDays };
}

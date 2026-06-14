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
    return q.days_of_week.includes(wd);
  });
}

export interface CloseInput {
  fromDate: string;
  today: string;
  quests: Quest[];
  completedKeys: Set<string>;
  streak: number;
  stones: number;
  freezeUntil: string | null;
}

export interface CloseOutput {
  streak: number;
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

    const scheduled = questsScheduledOn(input.quests, day);
    const missed = scheduled.filter((q) => !input.completedKeys.has(`${day}|${q.id}`));

    if (scheduled.length > 0) {
      if (missed.length === 0) {
        streak += 1;
        if (streak > 0 && streak % STONE_EVERY_STREAK_DAYS === 0 && stones < MAX_STONES) {
          stones += 1;
          stonesEarned += 1;
        }
      } else if (stones > 0) {
        // La piedra absorbe el día entero: sin penalización y la racha sobrevive
        // (aunque no suma).
        stones -= 1;
        stonesUsed += 1;
      } else {
        streak = 0;
        streakLost = true;
        let dayPenalty = 0;
        for (const q of missed) {
          if (q.is_penalty) continue;
          dayPenalty += Math.round(XP_BY_DIFFICULTY[q.difficulty] * PENALTY_FACTOR);
          missedTitles.push(q.title);
        }
        penaltyXp += Math.min(dayPenalty, DAILY_PENALTY_CAP);
      }
    }
    day = addDays(day, 1);
  }

  return { streak, stones, penaltyXp, missedTitles, streakLost, stonesUsed, stonesEarned, frozenDays };
}

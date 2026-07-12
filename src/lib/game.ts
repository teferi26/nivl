import type { Difficulty, DungeonRank, Quest, Stat, StatXpColumn } from './types';

export const XP_BY_DIFFICULTY: Record<Difficulty, number> = {
  trivial: 10,
  facil: 25,
  media: 50,
  dificil: 100,
  epica: 250,
};

export const DIFFICULTIES: Difficulty[] = ['trivial', 'facil', 'media', 'dificil', 'epica'];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  trivial: 'Trivial',
  facil: 'Fácil',
  media: 'Media',
  dificil: 'Difícil',
  epica: 'Épica',
};

export const STATS: Stat[] = ['FUE', 'VIT', 'INT', 'AGI', 'PER'];

export const STAT_LABEL: Record<Stat, string> = {
  FUE: 'Fuerza',
  VIT: 'Vitalidad',
  INT: 'Inteligencia',
  AGI: 'Agilidad',
  PER: 'Percepción',
};

export const STAT_COLUMN: Record<Stat, StatXpColumn> = {
  FUE: 'xp_fue',
  VIT: 'xp_vit',
  INT: 'xp_int',
  AGI: 'xp_agi',
  PER: 'xp_per',
};

export const EVIDENCE_BONUS = 0.25;
export const PENALTY_FACTOR = 0.5;

export function xpCostForLevel(level: number): number {
  return Math.round(100 * Math.pow(level, 1.5));
}

export function levelFromXp(xpTotal: number): { level: number; into: number; next: number } {
  let level = 1;
  let rest = Math.max(0, xpTotal);
  while (level < 999 && rest >= xpCostForLevel(level)) {
    rest -= xpCostForLevel(level);
    level += 1;
  }
  // Nivel tope: estado terminal. next=0 => los consumidores pintan barra llena
  // y evitan la división into/next que antes desbordaba el ratio (>1).
  if (level >= 999) return { level: 999, into: 0, next: 0 };
  return { level, into: rest, next: xpCostForLevel(level) };
}

export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export function rankForLevel(level: number): Rank {
  if (level <= 10) return 'E';
  if (level <= 25) return 'D';
  if (level <= 45) return 'C';
  if (level <= 70) return 'B';
  if (level <= 99) return 'A';
  return 'S';
}

export function streakMultiplier(streakDays: number): number {
  // Clamp inferior: una racha negativa (corrupción/edición manual) nunca debe
  // reducir el XP por debajo de ×1.
  const weeks = Math.max(0, Math.floor(streakDays / 7));
  return Math.min(1.5, 1 + 0.1 * weeks);
}

export function statPoints(statXp: number): number {
  return Math.floor(statXp / 100);
}

// Las misiones de penalización restauran exactamente el XP perdido:
// sin bonus de evidencia ni multiplicador de racha.
export function questXp(quest: Quest, opts: { evidence: boolean; streakDays: number }): number {
  if (quest.is_penalty) return quest.penalty_xp ?? 0;
  const base = XP_BY_DIFFICULTY[quest.difficulty];
  const bonus = opts.evidence ? 1 + EVIDENCE_BONUS : 1;
  return Math.round(base * bonus * streakMultiplier(opts.streakDays));
}

// ── Válvulas de escape (fase 1.5) ──────────────────────────────────
// Un día normal cumplido ≈ 150-300 XP; el tope evita la espiral de "ya da igual".
export const DAILY_PENALTY_CAP = 150;
export const MAX_STONES = 3;
export const STONE_EVERY_STREAK_DAYS = 7;

// ── Mazmorras (fase 2) ─────────────────────────────────────────────
// Tareas dan XP base (sin racha/evidencia); jefes ×2; botín único al despejar.
export const BOSS_MULTIPLIER = 2;
export const DUNGEON_CLEAR_XP: Record<DungeonRank, number> = {
  E: 50,
  D: 100,
  C: 150,
  B: 250,
  A: 400,
  S: 600,
};
export const DUNGEON_RANKS: DungeonRank[] = ['E', 'D', 'C', 'B', 'A', 'S'];

export function dungeonTaskXp(difficulty: Difficulty, isBoss: boolean): number {
  return XP_BY_DIFFICULTY[difficulty] * (isBoss ? BOSS_MULTIPLIER : 1);
}

// ── Cuerpo y mente (fases 3-4) — recurrentes pequeños, anti-inflación ──
export const GYM_SESSION_XP = 50;
export const PR_XP = 25;
export const JOURNAL_XP = 15;

// ── El Contrato (regla 6 del cuaderno): Puntos Bonus ────────────────
// Las misiones extra (is_bonus) dan PB en vez de XP: moneda secundaria
// canjeable por descanso. Cualitativa → no infla el nivel.
export const BONUS_BY_DIFFICULTY: Record<Difficulty, number> = {
  trivial: 1,
  facil: 3,
  media: 5,
  dificil: 10,
  epica: 25,
};
export const REDEEM_COST = 10; // 10 PB = 1 h de descanso
export const REDEEM_WEEKLY_CAP = 30; // máx 30 PB canjeados / 7 días
// Romper una regla del contrato: −25 XP inmediatos + misión de consecuencia
// que restaura exactamente eso si se cumple el castigo el mismo día.
export const RULE_BREAK_XP = 25;

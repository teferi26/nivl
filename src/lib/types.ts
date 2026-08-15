export type Stat = 'FUE' | 'VIT' | 'INT' | 'AGI' | 'PER';

export type Difficulty = 'trivial' | 'facil' | 'media' | 'dificil' | 'epica';

export type DungeonRank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export interface Profile {
  id: string;
  name: string;
  avatar_url: string | null;
  xp_total: number;
  xp_fue: number;
  xp_vit: number;
  xp_int: number;
  xp_agi: number;
  xp_per: number;
  streak_days: number;
  last_day_processed: string | null;
  protection_stones: number;
  freeze_until: string | null;
  freeze_reason: string | null;
  equipped_title: string | null;
  bonus_points: number;
  onboarding_done: boolean;
  // Horarios y régimen pactados con el coach (migración 0008). wake_time y
  // sleep_time llegan de Postgres como 'HH:MM:SS'.
  wake_time: string;
  sleep_time: string;
  timezone: string;
  coach_mode: 'A' | 'B' | 'pausa';
  created_at: string;
}

export interface Quest {
  id: string;
  user_id: string;
  title: string;
  stat: Stat;
  difficulty: Difficulty;
  days_of_week: number[];
  requires_evidence: boolean;
  active: boolean;
  is_penalty: boolean;
  penalty_date: string | null;
  penalty_xp: number | null;
  is_bonus: boolean;
  created_at: string;
}

export interface Completion {
  id: string;
  user_id: string;
  quest_id: string;
  date: string;
  completed_at: string;
  xp_awarded: number;
  evidence_url: string | null;
}

export interface Dungeon {
  id: string;
  user_id: string;
  title: string;
  rank: DungeonRank;
  description: string | null;
  stat: Stat;
  deadline: string | null;
  status: 'active' | 'cleared' | 'abandoned';
  created_at: string;
  cleared_at: string | null;
}

export interface DungeonTask {
  id: string;
  dungeon_id: string;
  user_id: string;
  title: string;
  is_boss: boolean;
  difficulty: Difficulty;
  done: boolean;
  done_at: string | null;
  due_date: string | null;
  position: number;
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  date: string;
  time: string | null;
  notes: string | null;
  created_at: string;
}

export interface GymDay {
  id: string;
  user_id: string;
  day_of_week: number;
  name: string;
}

export interface GymExercise {
  id: string;
  gym_day_id: string;
  user_id: string;
  name: string;
  sets: number;
  reps: number;
  weight: number | null;
  position: number;
}

export interface GymSession {
  id: string;
  user_id: string;
  date: string;
  gym_day_id: string | null;
  xp_awarded: number;
  notes: string | null;
  created_at: string;
}

export interface GymLift {
  id: string;
  session_id: string;
  user_id: string;
  exercise_name: string;
  weight: number;
  reps: number;
  // Esfuerzo percibido de la serie (1-10). Null en las series registradas
  // antes de la migración 0012.
  rpe: number | null;
  set_index: number;
}

export type MealSlotName = 'desayuno' | 'comida' | 'merienda' | 'cena' | 'snack';

export interface MealSlot {
  id: string;
  user_id: string;
  day_of_week: number;
  slot: MealSlotName;
  description: string;
  ingredients: string | null;
  // Los pone el coach al planificar la semana (migración 0012). Null en las
  // comidas escritas a mano desde la pantalla de Dieta.
  kcal: number | null;
  protein_g: number | null;
}

export interface ShoppingItem {
  id: string;
  user_id: string;
  name: string;
  qty: string | null;
  done: boolean;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  date: string;
  mood: number | null;
  energy: number | null;
  text: string | null;
  plan: string | null;
  created_at: string;
}

export interface Rule {
  id: string;
  user_id: string;
  position: number;
  text: string;
  consequence: string;
  active: boolean;
  created_at: string;
}

export interface RuleBreak {
  id: string;
  user_id: string;
  rule_id: string;
  date: string;
  note: string | null;
  created_at: string;
}

export interface BonusRedemption {
  id: string;
  user_id: string;
  amount: number;
  reward: string;
  created_at: string;
}

export interface Letter {
  id: string;
  user_id: string;
  body: string;
  sealed_at: string;
  open_at: string;
  opened_at: string | null;
}

export interface JournalPhoto {
  id: string;
  user_id: string;
  date: string;
  path: string;
  created_at: string;
}

export interface BodyMetric {
  id: string;
  user_id: string;
  date: string;
  weight_kg: number;
  notes: string | null;
  created_at: string;
}

export type GoalMetric = 'peso_corporal' | 'ejercicio' | 'libre';

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  metric_type: GoalMetric;
  exercise_name: string | null;
  start_value: number;
  target_value: number;
  current_value: number | null;
  unit: string;
  deadline: string | null;
  status: 'active' | 'achieved' | 'abandoned';
  created_at: string;
  achieved_at: string | null;
}

export interface AchievementRow {
  id: string;
  user_id: string;
  code: string;
  unlocked_at: string;
}

export type StatXpColumn = 'xp_fue' | 'xp_vit' | 'xp_int' | 'xp_agi' | 'xp_per';

import { computeDayClose, questsScheduledOn } from './closing';
import { fetchCompletionsSince, insertEvent, updateProfile, uploadEvidence } from './data';
import { addDays, dateKey } from './dates';
import { levelFromXp, questXp, STAT_COLUMN } from './game';
import { supabase } from './supabase';
import type { Profile, Quest } from './types';

export { questsScheduledOn };

export interface DayCloseResult {
  penaltyXp: number;
  missedTitles: string[];
  streakLost: boolean;
  levelsLost: number;
  stonesUsed: number;
  stonesEarned: number;
}

// Cierra los días pendientes desde el último procesado hasta ayer.
// Orden de defensas: congelación → piedras de protección → penalización
// (con tope diario). Detalle puro en closing.ts.
export async function processPendingDays(
  profile: Profile,
  quests: Quest[],
): Promise<{ profile: Profile; result: DayCloseResult | null }> {
  const today = dateKey();
  const yesterday = addDays(today, -1);

  // Limpia una congelación vencida aunque hoy no haya días que cerrar; antes solo
  // se limpiaba dentro del cierre, así que un freeze vencido quedaba pegado en BD.
  if (profile.freeze_until && profile.freeze_until < today) {
    await updateProfile(profile.id, { freeze_until: null, freeze_reason: null });
    profile = { ...profile, freeze_until: null, freeze_reason: null };
  }

  if (!profile.last_day_processed) {
    await updateProfile(profile.id, { last_day_processed: yesterday });
    return { profile: { ...profile, last_day_processed: yesterday }, result: null };
  }
  if (profile.last_day_processed >= yesterday) {
    return { profile, result: null };
  }

  const fromDate = addDays(profile.last_day_processed, 1);
  const completions = await fetchCompletionsSince(fromDate);
  const completedKeys = new Set(completions.map((c) => `${c.date}|${c.quest_id}`));

  const close = computeDayClose({
    fromDate,
    today,
    quests,
    completedKeys,
    streak: profile.streak_days,
    stones: profile.protection_stones,
    freezeUntil: profile.freeze_until,
  });

  const levelBefore = levelFromXp(profile.xp_total).level;
  const newTotal = Math.max(0, profile.xp_total - close.penaltyXp);
  const levelAfter = levelFromXp(newTotal).level;

  const patch: Partial<Profile> = {
    last_day_processed: yesterday,
    streak_days: close.streak,
    protection_stones: close.stones,
    xp_total: newTotal,
  };
  // La congelación expira sola cuando el último día congelado queda cerrado
  if (profile.freeze_until && profile.freeze_until < today) {
    patch.freeze_until = null;
    patch.freeze_reason = null;
  }
  await updateProfile(profile.id, patch);

  if (close.penaltyXp > 0) {
    await supabase.from('quests').insert({
      user_id: profile.id,
      title: 'Misión de penalización',
      stat: 'AGI',
      difficulty: 'media',
      days_of_week: [],
      requires_evidence: false,
      is_penalty: true,
      penalty_date: today,
      penalty_xp: close.penaltyXp,
    });
    await insertEvent(profile.id, 'penalty', { xp: close.penaltyXp, missed: close.missedTitles });
  }
  if (close.stonesUsed > 0) {
    await insertEvent(profile.id, 'stone_used', { count: close.stonesUsed });
  }
  if (close.stonesEarned > 0) {
    await insertEvent(profile.id, 'stone_earned', { count: close.stonesEarned });
  }
  if (close.streakLost) {
    await insertEvent(profile.id, 'streak_lost', { missed: close.missedTitles });
  }

  const result: DayCloseResult | null =
    close.penaltyXp > 0 || close.streakLost || close.stonesUsed > 0
      ? {
          penaltyXp: close.penaltyXp,
          missedTitles: close.missedTitles,
          streakLost: close.streakLost,
          levelsLost: Math.max(0, levelBefore - levelAfter),
          stonesUsed: close.stonesUsed,
          stonesEarned: close.stonesEarned,
        }
      : null;

  return { profile: { ...profile, ...patch }, result };
}

export interface CompleteResult {
  xp: number;
  leveledUp: boolean;
  newLevel: number;
  profile: Profile;
  wasPenalty: boolean;
}

export async function completeQuest(
  profile: Profile,
  quest: Quest,
  evidenceBase64: string | null,
): Promise<CompleteResult> {
  const today = dateKey();

  let evidencePath: string | null = null;
  if (evidenceBase64) {
    evidencePath = await uploadEvidence(profile.id, quest.id, today, evidenceBase64);
  }

  const xp = questXp(quest, { evidence: evidencePath !== null, streakDays: profile.streak_days });

  const { error } = await supabase.from('completions').insert({
    user_id: profile.id,
    quest_id: quest.id,
    date: today,
    xp_awarded: xp,
    evidence_url: evidencePath,
  });
  if (error) throw error;

  const patch: Partial<Profile> = { xp_total: profile.xp_total + xp };
  if (!quest.is_penalty) {
    const col = STAT_COLUMN[quest.stat];
    patch[col] = profile[col] + xp;
  }
  await updateProfile(profile.id, patch);

  const before = levelFromXp(profile.xp_total).level;
  const after = levelFromXp(profile.xp_total + xp).level;
  await insertEvent(profile.id, 'quest_completed', {
    quest: quest.title,
    xp,
    evidence: evidencePath !== null,
  });
  if (after > before) {
    await insertEvent(profile.id, 'level_up', { level: after });
  }

  return {
    xp,
    leveledUp: after > before,
    newLevel: after,
    profile: { ...profile, ...patch },
    wasPenalty: quest.is_penalty,
  };
}

// Otorga XP fuera de misiones (mazmorras, gym, diario) respetando el mismo flujo.
export async function awardXp(
  profile: Profile,
  amount: number,
  stat: keyof typeof STAT_COLUMN | null,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<{ profile: Profile; leveledUp: boolean; newLevel: number }> {
  const patch: Partial<Profile> = { xp_total: profile.xp_total + amount };
  if (stat) {
    const col = STAT_COLUMN[stat];
    patch[col] = profile[col] + amount;
  }
  await updateProfile(profile.id, patch);

  const before = levelFromXp(profile.xp_total).level;
  const after = levelFromXp(profile.xp_total + amount).level;
  await insertEvent(profile.id, eventType, { ...payload, xp: amount });
  if (after > before) {
    await insertEvent(profile.id, 'level_up', { level: after });
  }
  return { profile: { ...profile, ...patch }, leveledUp: after > before, newLevel: after };
}

// Congelación manual (modo examen / enfermedad / vacaciones)
export async function setFreeze(
  profile: Profile,
  until: string | null,
  reason: string | null,
): Promise<Profile> {
  await updateProfile(profile.id, { freeze_until: until, freeze_reason: reason });
  await insertEvent(profile.id, until ? 'freeze_on' : 'freeze_off', { until, reason });
  return { ...profile, freeze_until: until, freeze_reason: reason };
}

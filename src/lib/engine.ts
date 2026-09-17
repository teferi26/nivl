import { computeDayClose, questsScheduledOn, reglasIncumplidas } from './closing';
import { fetchRuleChecksRange, fetchRules } from './contract';
import {
  applyDayCloseRpc,
  awardXpRpc,
  completeQuestRpc,
  fetchCompletionsSince,
  insertEvent,
  updateProfile,
  uploadEvidence,
} from './data';
import { addDays, dateKey } from './dates';
import { BONUS_BY_DIFFICULTY, DAILY_PENALTY_CAP, levelFromXp, questXp, RULE_BREAK_XP, STAT_COLUMN } from './game';
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
    const fresh = await applyDayCloseRpc({ lastDay: yesterday });
    return { profile: fresh, result: null };
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
    perfectStreak: profile.perfect_streak_days,
    stones: profile.protection_stones,
    freezeUntil: profile.freeze_until,
  });

  // Las reglas del contrato se juzgan igual que las misiones: no marcarla como
  // cumplida es haberla roto. Se agrega por día y se topa, porque seis reglas
  // por seis días de ausencia sin tope serían 900 XP de golpe.
  const [reglasActivas, checksPorDia] = await Promise.all([
    fetchRules(),
    fetchRuleChecksRange(fromDate, yesterday),
  ]);
  const diasConReglasRotas = reglasIncumplidas({
    fromDate,
    today,
    reglas: reglasActivas.map((r) => ({ id: r.id, text: r.text, consequence: r.consequence })),
    checksPorDia,
    freezeUntil: profile.freeze_until,
    xpPorRegla: RULE_BREAK_XP,
    topeDiario: DAILY_PENALTY_CAP,
  });
  const xpReglas = diasConReglasRotas.reduce((a, d) => a + d.xp, 0);

  const levelBefore = levelFromXp(profile.xp_total).level;

  // Un solo viaje atómico: día procesado, racha, piedras y penalización.
  // La congelación expira sola cuando el último día congelado queda cerrado.
  const updated = await applyDayCloseRpc({
    lastDay: yesterday,
    streak: close.streak,
    perfectStreak: close.perfectStreak,
    stones: close.stones,
    penaltyXp: close.penaltyXp + xpReglas,
    clearFreeze: !!(profile.freeze_until && profile.freeze_until < today),
  });
  const levelAfter = levelFromXp(updated.xp_total).level;

  // Las roturas quedan registradas una a una (para el histórico de cada regla),
  // pero la consecuencia es UNA sola: seis misiones de castigo el mismo día no
  // se hacen, se abandonan.
  if (diasConReglasRotas.length > 0) {
    const roturas = diasConReglasRotas.flatMap((d) =>
      d.rotas.map((r) => ({ user_id: profile.id, rule_id: r.id, date: d.date })),
    );
    await supabase.from('rule_breaks').insert(roturas).then(undefined, () => {
      /* Que falle el histórico no puede tumbar el cierre del día. */
    });

    const ultimo = diasConReglasRotas[diasConReglasRotas.length - 1]!;
    const cuantas = new Set(diasConReglasRotas.flatMap((d) => d.rotas.map((r) => r.id))).size;
    await supabase.from('quests').insert({
      user_id: profile.id,
      title:
        cuantas === 1
          ? `Consecuencia: ${ultimo.rotas[0]!.consequence}`
          : `Consecuencia: ${cuantas} reglas rotas`,
      stat: 'AGI',
      difficulty: 'media',
      days_of_week: [],
      requires_evidence: false,
      is_penalty: true,
      penalty_date: today,
      penalty_xp: xpReglas,
    });
  }

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

  return { profile: updated, result };
}

export interface CompleteResult {
  xp: number;
  bonusEarned: number;
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

  // Misión extra (contrato, regla 6): da Puntos Bonus canjeables por descanso,
  // no XP. La completion se registra igual (cuenta para la racha del día).
  const isBonus = quest.is_bonus;
  const pb = isBonus ? BONUS_BY_DIFFICULTY[quest.difficulty] : 0;
  const xp = isBonus
    ? 0
    : questXp(quest, { evidence: evidencePath !== null, streakDays: profile.streak_days });

  // Completion y recompensa viajan en la misma transacción. Si la misión ya
  // estaba completada hoy (doble toque, reintento de red), awarded viene a
  // false y no se otorga nada: el doble-XP es imposible, no "improbable".
  const { awarded, profile: updated } = await completeQuestRpc({
    questId: quest.id,
    date: today,
    xp,
    bonus: pb,
    // Las misiones de penalización devuelven XP al total pero no suben stats:
    // restauran lo perdido, no premian.
    applyStat: !quest.is_penalty,
    evidenceUrl: evidencePath,
  });

  const before = levelFromXp(profile.xp_total).level;
  const after = levelFromXp(updated.xp_total).level;
  if (awarded && after > before) {
    await insertEvent(profile.id, 'level_up', { level: after });
  }

  // La evidencia se apunta ADEMÁS como recuerdo. Es la misma foto y el mismo
  // gesto, pero sirve para dos cosas distintas: la evidencia es el contrato
  // (+25 % XP) y el recuerdo es lo que el domingo se convierte en el pase de
  // diapositivas. Pedir la foto dos veces sería absurdo.
  //
  // Solo si `awarded`: en un doble toque la completada ya existía y duplicar la
  // foto llenaría el resumen de repetidas.
  if (awarded && evidencePath) {
    await supabase
      .from('quest_photos')
      .insert({
        user_id: profile.id,
        quest_id: quest.id,
        date: today,
        path: evidencePath,
      })
      .then(undefined, () => {
        /* Que falle el recuerdo no puede tumbar la misión ya completada. */
      });
  }

  return {
    xp: awarded ? xp : 0,
    bonusEarned: awarded ? pb : 0,
    leveledUp: awarded && after > before,
    newLevel: after,
    profile: updated,
    wasPenalty: quest.is_penalty,
  };
}

// Otorga XP fuera de misiones (campañas, gym, diario) respetando el mismo flujo.
export async function awardXp(
  profile: Profile,
  amount: number,
  stat: keyof typeof STAT_COLUMN | null,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<{ profile: Profile; leveledUp: boolean; newLevel: number }> {
  // La RPC aplica el delta y registra el evento en la misma transacción.
  const updated = await awardXpRpc(amount, stat, eventType, payload);

  const before = levelFromXp(profile.xp_total).level;
  const after = levelFromXp(updated.xp_total).level;
  if (after > before) {
    await insertEvent(profile.id, 'level_up', { level: after });
  }
  return { profile: updated, leveledUp: after > before, newLevel: after };
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

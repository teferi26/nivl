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
import { ErrorVisible } from './validation';

export { questsScheduledOn };

export interface DayCloseResult {
  penaltyXp: number;
  missedTitles: string[];
  streakLost: boolean;
  levelsLost: number;
  stonesUsed: number;
  stonesEarned: number;
}

type CierreResultado = { profile: Profile; result: DayCloseResult | null };

// Un cierre en vuelo por usuario. Hoy recarga en cada foco: volver a la
// pestaña mientras el primer cierre aún espera a la red lanzaba un segundo
// cierre con el mismo perfil obsoleto, y como `apply_day_close` no compara
// `last_day_processed`, descontaba dos veces y creaba dos misiones de
// penalización idénticas (QA Chat 5, H3). El segundo llamante recibe el
// resultado del primero. Entre dos DISPOSITIVOS esto no basta: eso lo cierra
// el servidor (PROPUESTA 0035, docs/qa-audit).
const cierresEnVuelo = new Map<string, Promise<CierreResultado>>();

// Misiones de recuperación que no se pudieron crear tras un cierre ya
// aplicado. Se reintentan en el siguiente cierre de esta sesión.
type Recuperacion = Record<string, unknown> & { penalty_date: string };
const recuperacionesPendientes = new Map<string, Recuperacion[]>();
const INTENTOS_RECUPERACION = 3;

async function insertarRecuperacion(fila: Recuperacion): Promise<boolean> {
  for (let i = 0; i < INTENTOS_RECUPERACION; i++) {
    try {
      // supabase-js no lanza: devuelve `{ error }`. Antes se ignoraba, y un
      // fallo de red aquí dejaba el XP descontado sin misión que lo devolviera.
      const { error } = await supabase.from('quests').insert(fila);
      if (!error) return true;
    } catch {
      /* se reintenta */
    }
  }
  return false;
}

// Cierra los días pendientes desde el último procesado hasta ayer.
// Orden de defensas: congelación → piedras de protección → penalización
// (con tope diario). Detalle puro en closing.ts.
export function processPendingDays(profile: Profile, quests: Quest[]): Promise<CierreResultado> {
  const enVuelo = cierresEnVuelo.get(profile.id);
  if (enVuelo) return enVuelo;
  const cierre = cerrarDias(profile, quests).finally(() => cierresEnVuelo.delete(profile.id));
  cierresEnVuelo.set(profile.id, cierre);
  return cierre;
}

async function reintentarRecuperaciones(userId: string, today: string): Promise<void> {
  const pendientes = recuperacionesPendientes.get(userId);
  if (!pendientes?.length) return;
  const quedan: Recuperacion[] = [];
  for (const fila of pendientes) {
    // Una recuperación solo vale el día de su cierre (invariante 2): pasado
    // ese día, la pérdida se habría consolidado igualmente.
    if (fila.penalty_date !== today) continue;
    if (!(await insertarRecuperacion(fila))) quedan.push(fila);
  }
  if (quedan.length) recuperacionesPendientes.set(userId, quedan);
  else recuperacionesPendientes.delete(userId);
}

async function cerrarDias(profile: Profile, quests: Quest[]): Promise<CierreResultado> {
  const today = dateKey();
  await reintentarRecuperaciones(profile.id, today);
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

  // El servidor no deja bajar de 0 (greatest(0, …)): quien tenía 120 XP y
  // pierde 200 solo pierde 120. La recuperación devuelve lo DESCONTADO, no lo
  // calculado, o volver de una ausencia larga regalaría XP (invariante 2:
  // "exactamente"). Primero las misiones, luego las reglas.
  const calculado = close.penaltyXp + xpReglas;
  const descontado = updated.xp_total > 0 ? calculado : Math.min(calculado, profile.xp_total);
  const recuperaMisiones = Math.min(close.penaltyXp, descontado);
  const recuperaReglas = Math.min(xpReglas, descontado - recuperaMisiones);

  const recuperaciones: Recuperacion[] = [];

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
    if (recuperaReglas > 0) recuperaciones.push({
      health_data: diasConReglasRotas.some(d => d.rotas.some(r => reglasActivas.some(original => original.id === r.id && original.health_data))),
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
      penalty_xp: recuperaReglas,
    });
  }

  if (recuperaMisiones > 0) {
    recuperaciones.push({
      user_id: profile.id,
      title: 'Misión de penalización',
      stat: 'AGI',
      difficulty: 'media',
      days_of_week: [],
      requires_evidence: false,
      is_penalty: true,
      penalty_date: today,
      penalty_xp: recuperaMisiones,
    });
  }

  // El XP ya está descontado: cada recuperación tiene que existir o el fallo
  // tiene que verse (invariante 2). Lo atómico de verdad es crearlas en la
  // misma transacción que el cierre (PROPUESTA 0035); mientras, se reintenta,
  // se apunta en el evento y se avisa.
  const fallidas: Recuperacion[] = [];
  for (const fila of recuperaciones) {
    if (!(await insertarRecuperacion(fila))) fallidas.push(fila);
  }
  if (fallidas.length) {
    recuperacionesPendientes.set(profile.id, [...(recuperacionesPendientes.get(profile.id) ?? []), ...fallidas]);
  }
  const recuperacionFallida = fallidas.some((f) => f.title === 'Misión de penalización');

  if (close.penaltyXp > 0) {
    await insertEvent(profile.id, 'penalty', { xp: close.penaltyXp, missed: close.missedTitles,
      health_data: quests.some(q => q.health_data && close.missedTitles.includes(q.title)),
      ...(recuperacionFallida ? { recuperacion: 'fallida' } : {}),
    }).catch(() => {
      /* el aviso de abajo sigue saliendo */
    });
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

  if (fallidas.length) {
    throw new ErrorVisible(
      'El día se cerró, pero no se pudo crear la misión para recuperar lo perdido. Vuelve a abrir Hoy con conexión para reintentarlo.',
    );
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
  /** false si la misión ya estaba completada hoy (doble toque, otro dispositivo). */
  awarded: boolean;
}

export async function completeQuest(
  profile: Profile,
  quest: Quest,
  evidenceBase64: string | null,
): Promise<CompleteResult> {
  const today = dateKey();

  // Hoy no se recarga sola a medianoche: una pantalla cargada el día D y
  // tocada el D+1 completaba la misión con fecha D+1. La de penalización se
  // cobraba fuera de su día (invariante 2: solo ese día) y una diaria quedaba
  // fallada en D y "hecha" en D+1. El espejo del coach (_shared/tools.ts) ya
  // rechaza lo mismo.
  if (questsScheduledOn([quest], today).length === 0) {
    throw new ErrorVisible(
      quest.is_penalty
        ? 'Esta misión de penalización caducó a medianoche: la pérdida ya se consolidó.'
        : 'El día ha cambiado. Vuelve a abrir Hoy para ver las misiones de hoy.',
    );
  }

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
    awarded,
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

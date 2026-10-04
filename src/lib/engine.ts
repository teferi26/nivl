import {
  computeDayClose,
  questsScheduledOn,
  recuperacionDesbloqueada,
  reglasIncumplidas,
  rotosSeguidosAntes,
  TOPE_DIARIO_CONJUNTO,
} from './closing';
import { fetchRuleChecksRange, fetchRules } from './contract';
import {
  applyDayCloseRpc,
  awardXpRpc,
  completeQuestRpc,
  fetchCompletionsForDate,
  fetchCompletionsSince,
  fetchQuests,
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
  /**
   * XP REALMENTE descontado por el cierre: misiones + reglas, acotado a lo
   * que había (el servidor no baja de 0). Es lo que debe decir la tarjeta.
   */
  penaltyXp: number;
  /** De ese total, lo que corresponde a reglas del contrato. */
  penaltyReglas: number;
  /**
   * Las reglas del contrato que causaron `penaltyReglas` (su texto, sin
   * repetir). Vacío o ausente si las reglas no costaron nada.
   */
  reglasRotas?: string[];
  missedTitles: string[];
  streakLost: boolean;
  levelsLost: number;
  stonesUsed: number;
  stonesEarned: number;
  /** Días rotos que ya no se cobran por ser del cuarto en adelante (RET-02). */
  diasSinCobrar: number;
  /** Días cerrados como cumplidos en este cierre (logro `first_day`). */
  diasCumplidos: number;
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
type Recuperacion = Record<string, unknown> & { id: string; penalty_date: string };

// Clave de idempotencia, no un secreto: el id lo pone el cliente para que un
// reintento tras una respuesta perdida no cree una segunda misión que
// devolvería otra vez todo lo perdido.
function idRecuperacion(): string {
  const h = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-';
    else if (i === 14) out += '4';
    else if (i === 19) out += h[8 + Math.floor(Math.random() * 4)];
    else out += h[Math.floor(Math.random() * 16)];
  }
  return out;
}
const recuperacionesPendientes = new Map<string, Recuperacion[]>();
const INTENTOS_RECUPERACION = 3;

async function insertarRecuperacion(fila: Recuperacion): Promise<boolean> {
  for (let i = 0; i < INTENTOS_RECUPERACION; i++) {
    try {
      // supabase-js no lanza: devuelve `{ error }`. Antes se ignoraba, y un
      // fallo de red aquí dejaba el XP descontado sin misión que lo devolviera.
      const { error } = await supabase
        .from('quests')
        .upsert(fila, { onConflict: 'id', ignoreDuplicates: true });
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

// close_day_v2 (0035): cierre con compare-and-set sobre last_day_processed y
// recuperaciones en la misma transacción. Devuelve null si el servidor aún no
// la tiene (la OTA puede llegar antes que la migración): entonces se usa el
// cierre de siempre.
let sinCloseDayV2 = false;
async function cerrarConV2(a: {
  expectedLastDay: string | null;
  lastDay: string;
  streak: number;
  perfectStreak: number;
  stones: number;
  penaltyXp: number;
  clearFreeze: boolean;
  recoveries: { title: string; xp: number; health_data: boolean }[];
}): Promise<{ applied: boolean; profile: Profile } | null> {
  if (sinCloseDayV2) return null;
  const { data, error } = await supabase.rpc('close_day_v2', {
    p_expected_last_day: a.expectedLastDay,
    p_last_day: a.lastDay,
    p_streak: a.streak,
    p_stones: a.stones,
    p_penalty_xp: a.penaltyXp,
    p_clear_freeze: a.clearFreeze,
    p_perfect_streak: a.perfectStreak,
    p_recoveries: a.recoveries,
  });
  if (error) {
    // PGRST202: PostgREST no encuentra la función. 42883: Postgres tampoco.
    if (error.code === 'PGRST202' || error.code === '42883') {
      sinCloseDayV2 = true;
      return null;
    }
    throw error;
  }
  const row = data as { applied?: boolean; profile?: Profile } | null;
  if (!row || typeof row.applied !== 'boolean' || !row.profile) {
    throw new Error('Respuesta de cierre incompleta.');
  }
  return { applied: row.applied, profile: row.profile };
}

async function cerrarDias(profile: Profile, quests: Quest[]): Promise<CierreResultado> {
  const today = dateKey();
  await reintentarRecuperaciones(profile.id, today);
  const yesterday = addDays(today, -1);

  // Limpia una congelación vencida aunque hoy no haya días que cerrar; antes solo
  // se limpiaba dentro del cierre, así que un freeze vencido quedaba pegado en BD.
  //
  // PERO solo si no hay días que cerrar: si los hay, el cierre necesita saber
  // hasta cuándo estuvo congelado para no juzgar esos días, y ya la limpia él
  // (clearFreeze). Limpiarla antes cobraba las vacaciones a quien volvía
  // después de que venciera la congelación (QA Chat 5; estaba en bf32d28).
  const hayDiasQueCerrar = !!profile.last_day_processed && profile.last_day_processed < yesterday;
  if (profile.freeze_until && profile.freeze_until < today && !hayDiasQueCerrar) {
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
  // Una semana más atrás para saber cuántos días rotos seguidos traía (RET-02).
  const completions = await fetchCompletionsSince(addDays(fromDate, -7));
  const completedKeys = new Set(completions.map((c) => `${c.date}|${c.quest_id}`));

  const close = computeDayClose({
    rotosSeguidosPrevios: rotosSeguidosAntes({ fromDate, quests, completedKeys, freezeUntil: profile.freeze_until }),
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
    reglas: reglasActivas.map((r) => ({
      id: r.id, text: r.text, consequence: r.consequence,
      creadaEl: r.created_at ? dateKey(new Date(r.created_at)) : null,
    })),
    checksPorDia,
    freezeUntil: profile.freeze_until,
    xpPorRegla: RULE_BREAK_XP,
    topeDiario: DAILY_PENALTY_CAP,
    diasExentos: new Set(close.diasExentos),
  });

  // RET-08: misiones y reglas comparten UN tope de 150 por día. Primero se
  // cobran las misiones; las reglas, lo que quede hasta el tope.
  const misionesPorDia = new Map(close.porDia.map((d) => [d.date, d.xp]));
  let penaMisiones = 0;
  let xpReglas = 0;
  const reglasCobradas = new Set<string>();
  for (const d of diasConReglasRotas) {
    const yaMisiones = misionesPorDia.get(d.date) ?? 0;
    const cabe = Math.max(0, TOPE_DIARIO_CONJUNTO - yaMisiones);
    const xp = Math.min(d.xp, cabe);
    xpReglas += xp;
    if (xp > 0) reglasCobradas.add(d.date);
  }
  for (const d of close.porDia) penaMisiones += Math.min(d.xp, TOPE_DIARIO_CONJUNTO);

  const levelBefore = levelFromXp(profile.xp_total).level;
  const calculado = penaMisiones + xpReglas;
  const clearFreeze = !!(profile.freeze_until && profile.freeze_until < today);

  // Las recuperaciones: UNA por misiones y UNA por reglas (seis misiones de
  // castigo el mismo día no se hacen, se abandonan). Devuelven lo DESCONTADO,
  // no lo calculado: el servidor no deja bajar de 0, y quien tenía 120 XP y
  // pierde 200 solo pierde 120 (invariante 2: "exactamente"). Primero las
  // misiones, luego las reglas. El servidor (0035) vuelve a acotarlo exacto.
  const estimado = Math.min(calculado, profile.xp_total);
  const planes: { titulo: string; xp: number; health_data: boolean; deMisiones: boolean }[] = [];
  if (penaMisiones > 0) {
    planes.push({ titulo: 'Misión de penalización', xp: penaMisiones, health_data: false, deMisiones: true });
  }
  if (diasConReglasRotas.length > 0) {
    const ultimo = diasConReglasRotas[diasConReglasRotas.length - 1]!;
    const cuantas = new Set(diasConReglasRotas.flatMap((d) => d.rotas.map((r) => r.id))).size;
    planes.push({
      titulo: cuantas === 1 ? `Consecuencia: ${ultimo.rotas[0]!.consequence}` : `Consecuencia: ${cuantas} reglas rotas`,
      xp: xpReglas,
      health_data: diasConReglasRotas.some((d) => d.rotas.some((r) => reglasActivas.some((o) => o.id === r.id && o.health_data))),
      deMisiones: false,
    });
  }
  const repartir = (total: number) => {
    let queda = total;
    return planes.map((pl) => {
      const xp = Math.min(pl.xp, queda);
      queda -= xp;
      return { ...pl, xp };
    });
  };

  const v2 = await cerrarConV2({
    expectedLastDay: profile.last_day_processed,
    lastDay: yesterday,
    streak: close.streak,
    perfectStreak: close.perfectStreak,
    stones: close.stones,
    penaltyXp: calculado,
    clearFreeze,
    recoveries: repartir(estimado)
      .filter((pl) => pl.xp > 0)
      .map((pl) => ({ title: pl.titulo, xp: pl.xp, health_data: pl.health_data })),
  });
  // Otro cierre (otro dispositivo) se adelantó: ese ya descontó y creó la
  // recuperación. Aquí no se toca nada (QA Chat 5, H3 entre dispositivos).
  if (v2 && !v2.applied) return { profile: v2.profile, result: null };

  // Sin 0035 en el servidor: el cierre de siempre, y la recuperación aparte.
  const updated =
    v2?.profile ??
    (await applyDayCloseRpc({
      lastDay: yesterday,
      streak: close.streak,
      perfectStreak: close.perfectStreak,
      stones: close.stones,
      penaltyXp: calculado,
      clearFreeze,
    }));
  const levelAfter = levelFromXp(updated.xp_total).level;
  const descontado = updated.xp_total > 0 ? calculado : estimado;
  const reparto = repartir(descontado);
  const recuperaMisiones = reparto.find((pl) => pl.deMisiones)?.xp ?? 0;

  // Las roturas quedan registradas una a una (para el histórico de cada regla).
  if (diasConReglasRotas.length > 0) {
    const roturas = diasConReglasRotas.flatMap((d) =>
      d.rotas.map((r) => ({ user_id: profile.id, rule_id: r.id, date: d.date })),
    );
    await supabase.from('rule_breaks').insert(roturas).then(undefined, () => {
      /* Que falle el histórico no puede tumbar el cierre del día. */
    });
  }

  // Camino antiguo: el XP ya está descontado, así que cada recuperación tiene
  // que existir o el fallo tiene que verse (invariante 2). Se reintenta, se
  // apunta en el evento y se avisa. Con 0035 ya viajan en la misma transacción.
  const fallidas: Recuperacion[] = [];
  if (!v2) {
    for (const pl of reparto) {
      if (pl.xp <= 0) continue;
      const fila: Recuperacion = {
        id: idRecuperacion(),
        user_id: profile.id,
        title: pl.titulo,
        stat: 'AGI',
        difficulty: 'media',
        days_of_week: [],
        requires_evidence: false,
        is_penalty: true,
        penalty_date: today,
        penalty_xp: pl.xp,
        ...(pl.health_data ? { health_data: true } : {}),
      };
      if (!(await insertarRecuperacion(fila))) fallidas.push(fila);
    }
  }
  if (fallidas.length) {
    recuperacionesPendientes.set(profile.id, [...(recuperacionesPendientes.get(profile.id) ?? []), ...fallidas]);
  }
  const recuperacionFallida = fallidas.some((f) => f.title === 'Misión de penalización');

  if (penaMisiones > 0) {
    // Lo descontado de verdad, no lo calculado (invariante 6: auditable).
    await insertEvent(profile.id, 'penalty', { xp: recuperaMisiones, missed: close.missedTitles,
      health_data: quests.some(q => q.health_data && close.missedTitles.includes(q.title)),
      recuperacion: recuperacionFallida ? 'fallida' : 'ok',
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
    descontado > 0 || close.streakLost || close.stonesUsed > 0 || close.diasExentos.length > 0 || close.diasCumplidos > 0
      ? {
          penaltyXp: descontado,
          penaltyReglas: Math.max(0, descontado - (reparto.find((pl) => pl.deMisiones)?.xp ?? 0)),
          reglasRotas: [
            ...new Set(
              diasConReglasRotas.filter((d) => reglasCobradas.has(d.date)).flatMap((d) => d.rotas.map((r) => r.text)),
            ),
          ],
          missedTitles: close.missedTitles,
          streakLost: close.streakLost,
          levelsLost: Math.max(0, levelBefore - levelAfter),
          stonesUsed: close.stonesUsed,
          stonesEarned: close.stonesEarned,
          diasSinCobrar: close.diasExentos.length,
          diasCumplidos: close.diasCumplidos,
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

  // RET-03 «Regreso a la arena»: la recuperación se abre con un acto real de
  // hoy (una misión normal ya completada). Cero XP extra.
  if (quest.is_penalty) {
    const [todas, hechas] = await Promise.all([fetchQuests(), fetchCompletionsForDate(today)]);
    const abierta = recuperacionDesbloqueada(
      questsScheduledOn(todas, today),
      new Set(hechas.map((c) => c.quest_id)),
      today,
    );
    if (!abierta) {
      throw new ErrorVisible(
        'Primero vuelve a la arena: completa hoy una de tus misiones y la recuperación quedará abierta.',
      );
    }
  }

  let evidencePath: string | null = null;
  if (evidenceBase64) {
    evidencePath = await uploadEvidence(profile.id, quest.id, today, evidenceBase64);
  }

  // Misión extra (contrato, regla 6): da Puntos Bonus canjeables por descanso,
  // no XP. La completion se registra igual, pero NO cuenta para la racha ni se
  // penaliza si falta (closing.ts excluye las extra del juicio del día).
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

// Arnés de QA (Chat 5): un servidor falso en memoria que reproduce la
// SEMÁNTICA de las RPC desplegadas, no una versión idealizada.
//
// - `apply_day_close_safe` (0017, renombrada en 0030): aplica el cierre que le
//   manda el cliente SIN comparar `last_day_processed`. El wrapper de 0030 toma
//   un advisory lock, pero solo serializa: dos llamadas con el mismo estado
//   obsoleto descuentan las dos.
// - `complete_quest` (0009/0030): unique(user_id, quest_id, date) + on conflict
//   do nothing → awarded=false en el segundo intento.
// - `award_xp`: delta directo.
// - `supabase.from(t).insert()` NO lanza: resuelve `{ error }`, como supabase-js.
//
// Cada operación cede el turno (`await tick()`) para que dos flujos
// concurrentes se entrelacen igual que dos peticiones reales en vuelo.

import type { Completion, Profile, Quest } from '../../types';

export const tick = () => new Promise<void>((r) => setImmediate(r));

export interface Fallos {
  /** Inserts de `quests` que devolverán `{ error }` antes de funcionar. */
  insertQuest: number;
  /** Lecturas de misiones (fetchQuests) que lanzarán antes de funcionar. */
  fetchQuests: number;
  /** complete_quest que confirman en BD y pierden la respuesta (timeout). */
  respuestaPerdida: number;
  /** Inserts de `quests` que se guardan y pierden la respuesta. */
  insertQuestPerdido: number;
}

export interface Servidor {
  profile: Profile;
  quests: Quest[];
  completions: Completion[];
  events: { type: string; payload: Record<string, unknown> }[];
  fallos: Fallos;
  llamadas: Record<string, number>;
  data: Record<string, (...args: any[]) => any>;
  contract: Record<string, (...args: any[]) => any>;
  dayplan: Record<string, (...args: any[]) => any>;
  supabase: { from: (t: string) => any };
}

export function perfil(over: Partial<Profile> = {}): Profile {
  return {
    id: 'u1', name: 'Gladiador', avatar_url: null,
    xp_total: 1000, xp_fue: 0, xp_vit: 0, xp_int: 0, xp_agi: 0, xp_per: 0,
    streak_days: 3, perfect_streak_days: 0, last_day_processed: null,
    protection_stones: 0, freeze_until: null, freeze_reason: null, equipped_title: null,
    bonus_points: 0, onboarding_done: true, wake_time: '07:00:00', sleep_time: '23:00:00',
    timezone: 'Europe/Madrid', coach_mode: 'A', profile_kind: 'general', created_at: '2026-09-01',
    ...over,
  };
}

export function mision(over: Partial<Quest> = {}): Quest {
  return {
    id: 'q1', user_id: 'u1', title: 'Misión', stat: 'FUE', difficulty: 'media',
    days_of_week: [1, 2, 3, 4, 5, 6, 7], requires_evidence: false, active: true,
    is_penalty: false, penalty_date: null, penalty_xp: null, is_bonus: false,
    acquired_at: null, acquired_streak: null, created_at: '2026-09-01', link: null,
    ...over,
  };
}

const COLUMNA: Record<string, keyof Profile> = {
  FUE: 'xp_fue', VIT: 'xp_vit', INT: 'xp_int', AGI: 'xp_agi', PER: 'xp_per',
};

export function crearServidor(): Servidor {
  let seq = 0;
  const s = {
    profile: perfil(),
    quests: [] as Quest[],
    completions: [] as Completion[],
    events: [] as { type: string; payload: Record<string, unknown> }[],
    fallos: { insertQuest: 0, fetchQuests: 0, respuestaPerdida: 0, insertQuestPerdido: 0 },
    llamadas: {} as Record<string, number>,
  } as Servidor;
  const cuenta = (k: string) => { s.llamadas[k] = (s.llamadas[k] ?? 0) + 1; };

  s.data = {
    async applyDayCloseRpc(a: { lastDay?: string | null; streak?: number | null; perfectStreak?: number | null;
      stones?: number | null; penaltyXp?: number; clearFreeze?: boolean }) {
      cuenta('apply_day_close');
      await tick();
      const p = s.profile;
      s.profile = {
        ...p,
        last_day_processed: a.lastDay ?? p.last_day_processed,
        streak_days: a.streak ?? p.streak_days,
        perfect_streak_days: a.perfectStreak ?? p.perfect_streak_days,
        protection_stones: a.stones ?? p.protection_stones,
        xp_total: Math.max(0, p.xp_total - (a.penaltyXp ?? 0)),
        freeze_until: a.clearFreeze ? null : p.freeze_until,
        freeze_reason: a.clearFreeze ? null : p.freeze_reason,
      };
      return { ...s.profile };
    },
    async completeQuestRpc(a: { questId: string; date: string; xp: number; bonus?: number; applyStat?: boolean }) {
      cuenta('complete_quest');
      await tick();
      const q = s.quests.find((x) => x.id === a.questId);
      if (!q) throw new Error('Misión no encontrada');
      const ya = s.completions.some((c) => c.quest_id === a.questId && c.date === a.date);
      if (ya) return { awarded: false, profile: { ...s.profile } };
      s.completions.push({ id: `c${++seq}`, user_id: 'u1', quest_id: a.questId, date: a.date,
        completed_at: '', xp_awarded: q.is_bonus ? 0 : a.xp, evidence_url: null });
      if (q.is_bonus) s.profile = { ...s.profile, bonus_points: s.profile.bonus_points + (a.bonus ?? 0) };
      else {
        const col = COLUMNA[q.stat];
        s.profile = { ...s.profile, xp_total: s.profile.xp_total + a.xp,
          [col]: (s.profile[col] as number) + ((a.applyStat ?? true) ? a.xp : 0) };
      }
      if (s.fallos.respuestaPerdida > 0) {
        s.fallos.respuestaPerdida -= 1;
        throw new Error('Network request failed');
      }
      return { awarded: true, profile: { ...s.profile } };
    },
    async awardXpRpc(amount: number, stat: string | null, type: string | null, payload: Record<string, unknown> = {}) {
      cuenta('award_xp');
      await tick();
      const col = stat ? COLUMNA[stat] : null;
      s.profile = { ...s.profile, xp_total: Math.max(0, s.profile.xp_total + amount),
        ...(col ? { [col]: Math.max(0, (s.profile[col] as number) + amount) } : {}) };
      if (type) s.events.push({ type, payload: { ...payload, xp: amount } });
      return { ...s.profile };
    },
    async fetchQuests() {
      cuenta('fetchQuests');
      await tick();
      if (s.fallos.fetchQuests > 0) { s.fallos.fetchQuests -= 1; throw new Error('Network request failed'); }
      return s.quests.map((q) => ({ ...q }));
    },
    async fetchCompletionsSince(from: string) { await tick(); return s.completions.filter((c) => c.date >= from); },
    async fetchCompletionsForDate(d: string) { await tick(); return s.completions.filter((c) => c.date === d); },
    async insertEvent(_u: string, type: string, payload: Record<string, unknown>) { await tick(); s.events.push({ type, payload }); },
    async updateProfile(_u: string, patch: Partial<Profile>) { await tick(); s.profile = { ...s.profile, ...patch }; },
    async uploadEvidence() { return 'u1/foto.jpg'; },
    async ensureProfile() { return { ...s.profile }; },
  };

  s.contract = {
    async fetchRules() { return []; },
    async fetchRuleChecksRange() { return new Map(); },
    async marcarReglaCumplida() {},
  };
  s.dayplan = { async fetchPlan() { return null; }, async setBlockDone() {} };

  const insertar = async (tabla: string, fila: any) => {
    await tick();
    if (tabla === 'quests') {
      cuenta('insert_quest');
      if (s.fallos.insertQuest > 0) { s.fallos.insertQuest -= 1; return { data: null, error: { message: 'Network request failed' } }; }
      const filas = (Array.isArray(fila) ? fila : [fila])
        .map((f: any) => mision({ ...f, id: f.id ?? `pq${++seq}` }))
        // upsert ignoreDuplicates: on conflict (id) do nothing.
        .filter((f: Quest) => !s.quests.some((q) => q.id === f.id));
      s.quests.push(...filas);
      if (s.fallos.insertQuestPerdido > 0) { s.fallos.insertQuestPerdido -= 1; return { data: null, error: { message: 'Network request failed' } }; }
      return { data: filas, error: null };
    }
    return { data: null, error: null };
  };
  s.supabase = {
    from(tabla: string) {
      return {
        insert(fila: any) {
          const p = insertar(tabla, fila);
          return Object.assign(p, { select: () => p });
        },
        upsert(fila: any) {
          const p = insertar(tabla, fila);
          return Object.assign(p, { select: () => p });
        },
        select() { return Promise.resolve({ count: 0, data: [], error: null }); },
      };
    },
  };
  return s;
}

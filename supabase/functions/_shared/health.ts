import type { Db } from './db.ts';
export const HEALTH_REQUIRED = 'sin_consentimiento_salud';
const revisions = new WeakMap<Db, number>();
export async function healthConsent(sb: Db, userId: string): Promise<boolean | null> {
  const { data, error } = await sb.rpc('health_consent_ok', { p_user: userId });
  if (error) return null;
  if (data !== true) return false;
  const expected = revisions.get(sb);
  if (expected === undefined) return true;
  const current = await sb.from('health_state').select('revision').eq('user_id', userId).maybeSingle();
  return current.error ? null : Number(current.data?.revision) === expected;
}
export async function requireHealth(sb: Db, userId: string): Promise<void> {
  if (await healthConsent(sb, userId) !== true) throw new Error(HEALTH_REQUIRED);
}

/** A provider response is held until the request's consent revision is checked again. */
export async function healthGuardedResult<T>(sb: Db, userId: string, operation: () => Promise<T>): Promise<T> {
  await requireHealth(sb, userId);
  const result = await operation();
  await requireHealth(sb, userId);
  return result;
}

export async function healthRevision(sb: Db, userId: string): Promise<number> {
  await requireHealth(sb, userId);
  const { data, error } = await sb.from('health_state').select('revision,accepted').eq('user_id', userId).maybeSingle();
  const revision = Number(data?.revision);
  if (error || data?.accepted !== true || !Number.isSafeInteger(revision) || revision < 1) throw new Error(HEALTH_REQUIRED);
  return revision;
}

// AI output is a known mixed source. Tag every mutation, including dynamically
// selected tool tables; never ask the model to classify its own sensitive data.
const MIXED = new Set(['quests', 'rules', 'dungeons', 'dungeon_tasks', 'calendar_events', 'shopping_items', 'goals', 'events', 'letters']);
const MUTATIONS = new Set(['insert', 'upsert', 'update']);
const FINANCIAL_TEXT = new Map([['money_plan', 'rationale'], ['budgets', 'rationale'], ['category_rules', 'pattern'], ['transactions', 'description']]);
export function healthScopedClient(client: Db, revision: number): Db {
  const tagged = (data: unknown, table: string): unknown => {
    if (Array.isArray(data)) return data.map(row => tagged(row, table));
    if (!data || typeof data !== 'object') return data;
    if (MIXED.has(table)) return { ...data, health_data: true };
    const field = FINANCIAL_TEXT.get(table);
    return field && Object.prototype.hasOwnProperty.call(data, field) ? { ...data, health_note: true } : data;
  };
  const scoped = new Proxy(client, { get(target, key) {
    if (key === 'from') return (table: string) => {
      const builder = target.from(table);
      if (!MIXED.has(table) && !FINANCIAL_TEXT.has(table)) return builder;
      return new Proxy(builder, { get(query, action) {
        const value = Reflect.get(query, action, query);
        if (MUTATIONS.has(String(action))) return (data: unknown, ...options: unknown[]) => value.call(query, tagged(data, table), ...options);
        return typeof value === 'function' ? value.bind(query) : value;
      } });
    };
    const value = Reflect.get(target, key, target);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
  revisions.set(scoped, revision);
  return scoped;
}

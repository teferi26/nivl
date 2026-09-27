// Metro substitutes this module ONLY in the isolated screenshot build.
// No real Supabase client is created. Unknown operations fail explicitly.
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  screenshotAiStatus, screenshotBoard, screenshotDate, screenshotSession,
  screenshotTables, screenshotUser, type ScreenshotRow,
} from './fixtures';

if (process.env.EXPO_PUBLIC_SCREENSHOT_MODE !== '1') {
  throw new Error('The local NIVL screenshot adapter requires EXPO_PUBLIC_SCREENSHOT_MODE=1.');
}

export interface ScreenshotError { message: string; code: string; details: string; hint: string }
export interface ScreenshotResult { data: unknown; error: ScreenshotError | null; count: number | null; status: number; statusText: string }
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const ok = (data: unknown, count: number | null = null): ScreenshotResult => ({ data: clone(data), error: null, count, status: 200, statusText: 'OK' });
const fail = (message: string, code = 'SCREENSHOT_UNSUPPORTED'): ScreenshotResult => ({
  data: null, error: { message: `[NIVL screenshots] ${message}`, code, details: 'Local fixture adapter; no network request was made.', hint: 'Add a verified fixture or keep the capture read-only.' },
  count: null, status: 400, statusText: 'Fixture error',
});

function read(row: ScreenshotRow, column: string): unknown {
  return column.split('.').reduce<unknown>((value, part) => value && typeof value === 'object' ? (value as ScreenshotRow)[part] : undefined, row);
}
function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

class ScreenshotQuery implements PromiseLike<ScreenshotResult> {
  private predicates: ((r: ScreenshotRow) => boolean)[] = [];
  private ordering: { column: string; ascending: boolean }[] = [];
  private maxRows: number | null = null;
  private startRow = 0;
  private one: 'single' | 'maybe' | null = null;
  private head = false;
  private counted = false;
  private columns = '*';
  private invalid: ScreenshotResult | null = null;

  constructor(private table: string) {}
  select(columns = '*', options?: { count?: string; head?: boolean }) {
    this.columns = columns;
    this.head = options?.head === true;
    this.counted = !!options?.count;
    return this;
  }
  eq(column: string, value: unknown) { this.predicates.push(r => read(r, column) === value); return this; }
  neq(column: string, value: unknown) { this.predicates.push(r => read(r, column) !== value); return this; }
  gt(column: string, value: unknown) { this.predicates.push(r => compare(read(r, column), value) > 0); return this; }
  gte(column: string, value: unknown) { this.predicates.push(r => compare(read(r, column), value) >= 0); return this; }
  lt(column: string, value: unknown) { this.predicates.push(r => compare(read(r, column), value) < 0); return this; }
  lte(column: string, value: unknown) { this.predicates.push(r => compare(read(r, column), value) <= 0); return this; }
  in(column: string, values: unknown[]) { this.predicates.push(r => values.includes(read(r, column))); return this; }
  is(column: string, value: unknown) { return this.eq(column, value); }
  not(column: string, operator: string, value: unknown) {
    if (operator === 'is' || operator === 'eq') return this.neq(column, value);
    this.invalid = fail(`Unsupported not operator: ${operator}`); return this;
  }
  order(column: string, options?: { ascending?: boolean }) {
    this.ordering.push({ column, ascending: options?.ascending !== false }); return this;
  }
  limit(n: number) { this.maxRows = n; return this; }
  range(from: number, to: number) { this.startRow = from; this.maxRows = to - from + 1; return this; }
  single() { this.one = 'single'; return this; }
  maybeSingle() { this.one = 'maybe'; return this; }
  private write(operation: string) {
    this.invalid = fail(`Writes are disabled: ${this.table}.${operation}`, 'SCREENSHOT_READ_ONLY'); return this;
  }
  insert(..._args: unknown[]) { return this.write('insert'); }
  upsert(..._args: unknown[]) { return this.write('upsert'); }
  update(..._args: unknown[]) { return this.write('update'); }
  delete(..._args: unknown[]) { return this.write('delete'); }

  private execute(): ScreenshotResult {
    if (this.invalid) return this.invalid;
    if (!Object.prototype.hasOwnProperty.call(screenshotTables, this.table)) return fail(`Unknown table: ${this.table}`);
    let rows = clone(screenshotTables[this.table]!);
    if (this.table === 'gym_lifts' && this.columns.includes('gym_sessions')) {
      rows = rows.map(row => ({ ...row, gym_sessions: screenshotTables.gym_sessions!.find(s => s.id === row.session_id) ?? null }));
    }
    rows = rows.filter(r => this.predicates.every(predicate => predicate(r)));
    const count = rows.length;
    rows.sort((a, b) => {
      for (const { column, ascending } of this.ordering) {
        const n = compare(read(a, column), read(b, column));
        if (n !== 0) return ascending ? n : -n;
      }
      return 0;
    });
    rows = rows.slice(this.startRow, this.maxRows === null ? undefined : this.startRow + this.maxRows);
    if (this.one) {
      if (rows.length > 1 || (this.one === 'single' && rows.length !== 1)) return fail(`Expected one ${this.table} row, found ${rows.length}`, 'PGRST116');
      return ok(rows[0] ?? null, this.counted ? count : null);
    }
    // Returning a superset of requested scalar columns is sufficient for UI
    // fixtures. Predicates, ordering, nested relation, count and cardinality are real.
    return ok(this.head ? null : rows, this.counted ? count : null);
  }
  then<TResult1 = ScreenshotResult, TResult2 = never>(
    onfulfilled?: ((value: ScreenshotResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

export async function screenshotRpc(name: string, args: Record<string, unknown> = {}): Promise<ScreenshotResult> {
  switch (name) {
    case 'my_age_confirmation': return ok(true);
    case 'my_ai_consent': return ok({ current_version: '2026-09-27', granted: true, action: 'accept', version: '2026-09-27', at: `${screenshotDate(-30)}T08:00:00.000Z` });
    case 'ai_status':
      return ok((globalThis as { __NIVL_SCREENSHOT_OFFER__?: boolean }).__NIVL_SCREENSHOT_OFFER__
        ? { entitled: false, tier: 'free', plan: null, budget: 0, spent: 0, remaining: 0,
          trial: false, trial_available: false, deep_allowed: false, deep_remaining: 0, deep_turns: 0 }
        : screenshotAiStatus);
    case 'friends_board':
      return Number(args.p_days ?? 7) === 7
        ? ok(screenshotBoard)
        : fail('The screenshot leaderboard contains a seven-day sample; capture the Semana tab.');
    case 'friend_requests': return ok([]);
    case 'elite_badges': return ok([]);
    case 'my_elite_group': return ok({ eligible: false, group: null, requested: false, requested_goal: null });
    case 'elite_group_board': return ok([]);
    case 'my_referral': return ok(null);
    case 'founder_seats_left': return ok(100);
    default: return fail(`RPC is not available in the screenshot fixture: ${name}`);
  }
}

type AuthListener = (event: string, session: typeof screenshotSession | null) => void;
const listeners = new Set<AuthListener>();
let signedIn = true;
const adapter = {
  from: (table: string) => new ScreenshotQuery(table),
  rpc: screenshotRpc,
  auth: {
    getSession: async () => ({ data: { session: signedIn ? clone(screenshotSession) : null }, error: null }),
    getUser: async () => ({ data: { user: signedIn ? clone(screenshotUser) : null }, error: null }),
    onAuthStateChange: (callback: AuthListener) => {
      listeners.add(callback);
      return { data: { subscription: { unsubscribe: () => { listeners.delete(callback); } } } };
    },
    signOut: async () => { signedIn = false; listeners.forEach(f => f('SIGNED_OUT', null)); return { error: null }; },
    signInWithPassword: async () => ({ data: { user: null, session: null }, error: fail('Authentication is supplied locally; login is disabled.').error }),
    setSession: async () => ({ data: { user: null, session: null }, error: fail('External sessions cannot be used in screenshots.').error }),
    startAutoRefresh: () => {}, stopAutoRefresh: () => {},
  },
  storage: {
    from: (bucket: string) => ({
      createSignedUrl: async () => fail(`No remote images are used: ${bucket}.createSignedUrl`),
      upload: async () => fail(`Storage writes disabled: ${bucket}.upload`, 'SCREENSHOT_READ_ONLY'),
      remove: async () => fail(`Storage writes disabled: ${bucket}.remove`, 'SCREENSHOT_READ_ONLY'),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
    }),
  },
  functions: { invoke: async (name: string) => fail(`Live functions disabled: ${name}`) },
};

export const supabase = adapter as unknown as SupabaseClient;

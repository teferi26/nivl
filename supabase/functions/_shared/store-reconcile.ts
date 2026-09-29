// RevenueCat v1 Customer Info is read on the server with a pinned project key.
// A public SDK key supports this endpoint; never accept a key or entitlement
// from the caller. No receipt, price, or original transaction is invented here.
// https://www.revenuecat.com/docs/api-v1/customers
import type { Db } from './db.ts';

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): value is ObjectValue => !!value && typeof value === 'object' && !Array.isArray(value);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRODUCTS = new Set(['nivl_pro_mensual', 'nivl_pro_anual', 'nivl_elite_mensual', 'nivl_elite_anual', 'nivl_elite_fundador']);
type Reservation = { user_id: string; revision: number };
export type StoreSnapshot = Reservation & { requested_ms: number; subscriptions: StoreSubscription[] };
export type StoreSubscription = {
  product_id: string; provider: 'apple' | 'google'; environment: 'SANDBOX' | 'PRODUCTION';
  expires_at: string; trial: boolean; refunded: boolean;
};

function date(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Malformed known products fail closed; unknown products never grant access. */
export function parseCustomerInfo(value: unknown, reservation: Reservation, now = Date.now()): StoreSnapshot {
  if (!object(value) || !Number.isSafeInteger(value.request_date_ms) || !object(value.subscriber) ||
      !object(value.subscriber.subscriptions)) throw new Error('Invalid customer snapshot');
  const requested = value.request_date_ms as number;
  if (requested < now - 120_000 || requested > now + 60_000) throw new Error('Stale customer snapshot');
  const subscriptions: StoreSubscription[] = [];
  for (const [identifier, raw] of Object.entries(value.subscriber.subscriptions)) {
    const product = identifier.split(':')[0];
    if (!PRODUCTS.has(product)) continue;
    if (!object(raw)) throw new Error('Invalid subscription');
    // A project may also contain Stripe/promotional purchases. They do not
    // create a native-store right or replace a manual/Stripe subscription.
    if (raw.store !== 'app_store' && raw.store !== 'play_store' && raw.store !== 'mac_app_store') continue;
    const expiration = date(raw.expires_date);
    const grace = raw.grace_period_expires_date == null ? null : date(raw.grace_period_expires_date);
    if (expiration === null || (raw.grace_period_expires_date != null && grace === null) ||
        typeof raw.is_sandbox !== 'boolean' || !['normal', 'intro', 'trial', 'promotional', 'prepaid'].includes(String(raw.period_type)) ||
        (raw.refunded_at != null && date(raw.refunded_at) === null)) throw new Error('Invalid subscription fields');
    subscriptions.push({
      product_id: product, provider: raw.store === 'play_store' ? 'google' : 'apple',
      environment: raw.is_sandbox ? 'SANDBOX' : 'PRODUCTION',
      expires_at: new Date(Math.max(expiration, grace ?? expiration)).toISOString(),
      trial: raw.period_type === 'trial', refunded: raw.refunded_at != null,
    });
  }
  return { ...reservation, requested_ms: requested, subscriptions };
}

export function eventUsers(event: ObjectValue): string[] {
  const candidates = event.type === 'TRANSFER'
    ? [...(Array.isArray(event.transferred_from) ? event.transferred_from : []), ...(Array.isArray(event.transferred_to) ? event.transferred_to : [])]
    : [event.app_user_id, event.original_app_user_id, ...(Array.isArray(event.aliases) ? event.aliases : [])];
  return [...new Set(candidates.filter((uid): uid is string => typeof uid === 'string' && UUID.test(uid)).map(uid => uid.toLowerCase()))].sort();
}

export async function reconcileStore(
  admin: Db, users: string[], apiKey: string, event?: ObjectValue, fetcher: typeof fetch = fetch,
): Promise<{ ok: boolean; pending?: boolean }> {
  if (!apiKey.trim()) throw new Error('Store verification not configured');
  if (users.length > 20 || users.some(uid => !UUID.test(uid))) throw new Error('Invalid store identities');
  // Reserve BEFORE the HTTP request. A newer reservation invalidates an older
  // response, even when network responses arrive in the opposite order.
  const { data: reserved, error } = await admin.rpc('begin_store_reconciliation', { p_users: users });
  if (error || !Array.isArray(reserved)) throw new Error('Cannot reserve store verification');
  const reservations: Reservation[] = reserved.map(value => {
    if (!object(value) || typeof value.user_id !== 'string' || !users.includes(value.user_id) ||
        !Number.isSafeInteger(value.revision) || Number(value.revision) < 1) throw new Error('Invalid store reservation');
    return { user_id: value.user_id, revision: Number(value.revision) };
  });
  const results = await Promise.allSettled(reservations.map(async reservation => {
    const response = await fetcher(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(reservation.user_id)}`, {
      method: 'GET', headers: { Authorization: `Bearer ${apiKey.trim()}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    // Never treat an upstream error, including a 404, as "no subscription".
    if (!response.ok) throw new Error('Store verification unavailable');
    const snapshot = parseCustomerInfo(await response.json(), reservation);
    if (event && typeof event.event_timestamp_ms === 'number' && snapshot.requested_ms < event.event_timestamp_ms) {
      throw new Error('Snapshot predates webhook');
    }
    return snapshot;
  }));
  const snapshots = results.map(result => {
    if (result.status === 'rejected') throw new Error('Store verification unavailable');
    return result.value;
  });
  if (!event && snapshots.length !== 1) throw new Error('Account unavailable');
  const { data: applied, error: applyError } = await admin.rpc('apply_store_reconciliation', {
    p_snapshots: snapshots, p_event: event ?? null,
  });
  if (applyError || !object(applied) || typeof applied.ok !== 'boolean') throw new Error('Cannot apply store verification');
  return { ok: applied.ok, ...(applied.ok ? {} : { pending: true }) };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const storeReconcileHandler = (admin: Db, apiKey: string, fetcher: typeof fetch = fetch) => async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') return json(405, { error: 'Método no permitido' });
  const authorization = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(authorization);
  if (!match) return json(401, { error: 'No autenticado' });
  try {
    const { data, error } = await admin.auth.getUser(match[1]);
    if (error || !data.user || !UUID.test(data.user.id)) return json(401, { error: 'Sesión inválida' });
    // Body intentionally unused: a client cannot choose another user, a
    // RevenueCat project, a product, or a paid-through date.
    const result = await reconcileStore(admin, [data.user.id], apiKey, undefined, fetcher);
    return json(result.ok ? 200 : 202, result);
  } catch {
    return json(503, { ok: false, pending: true, error: 'La tienda aún no ha confirmado el acceso. Reintenta restaurar.' });
  }
};
